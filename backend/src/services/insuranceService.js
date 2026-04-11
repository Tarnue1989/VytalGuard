// 📁 backend/src/services/insuranceService.js

import {
  sequelize,
  InsuranceClaim,
  Invoice,
  Organization,
} from "../models/index.js";

export const insuranceService = {
  /* ============================================================
     🔢 GENERATE CLAIM NUMBER (SAFE + ENTERPRISE)
  ============================================================ */
  async generateClaimNumber({ organization_id, transaction }) {
    const org = await Organization.findByPk(organization_id, {
      attributes: ["code"],
      transaction,
    });

    const orgCode = org?.code || "ORG";

    const lastClaim = await InsuranceClaim.findOne({
      where: { organization_id },
      order: [["created_at", "DESC"]],
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });

    let nextNumber = 1;

    if (lastClaim?.claim_number) {
      const parts = lastClaim.claim_number.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) nextNumber = lastSeq + 1;
    }

    const sequence = String(nextNumber).padStart(6, "0");

    return `CLM-${orgCode}-${sequence}`;
  },

  /* ============================================================
     🏥 CREATE / UPDATE CLAIM FROM INVOICE (FINAL FIXED)
  ============================================================ */
  async createClaimFromInvoice({ invoice_id, user, transaction }) {
    const t = transaction || (await sequelize.transaction());

    try {
      /* ============================
         🔒 LOAD INVOICE + ITEMS
      ============================ */
      const invoice = await Invoice.findByPk(invoice_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!invoice) throw new Error("❌ Invoice not found");

      if (!invoice.insurance_provider_id) {
        throw new Error("❌ No insurance provider on invoice");
      }

      const items = await invoice.getItems({ transaction: t });

      /* ============================
         💰 FINAL CLAIM AMOUNT (FROM ITEMS)
      ============================ */
      const claimAmount = (items || []).reduce(
        (sum, i) => sum + Number(i.insurance_amount || 0),
        0
      );

      /* ============================
         🔍 CHECK EXISTING CLAIM
      ============================ */
      const existing = await InsuranceClaim.findOne({
        where: { invoice_id },
        transaction: t,
      });

      /* ============================
         🔁 UPDATE EXISTING CLAIM
      ============================ */
      if (existing) {
        await existing.update(
          {
            amount_claimed: claimAmount,
          },
          { transaction: t }
        );

        if (!transaction) await t.commit();
        return existing;
      }

      /* ============================
         🔢 GENERATE CLAIM NUMBER
      ============================ */
      const claimNumber = await this.generateClaimNumber({
        organization_id: invoice.organization_id,
        transaction: t,
      });

      /* ============================
         🏥 CREATE CLAIM
      ============================ */
      const claim = await InsuranceClaim.create(
        {
          organization_id: invoice.organization_id,
          facility_id: invoice.facility_id,

          invoice_id: invoice.id,
          patient_id: invoice.patient_id,
          provider_id: invoice.insurance_provider_id,

          claim_number: claimNumber,

          currency: invoice.currency,
          amount_claimed: claimAmount, // ✅ FINAL VALUE

          amount_approved: 0,
          amount_paid: 0,

          status: "submitted",

          claim_date: new Date(),

          created_by_id: user?.id || null,
        },
        { transaction: t }
      );

      /* ============================
         🔁 LINK CLAIM TO INVOICE
      ============================ */
      await invoice.update(
        {
          insurance_claim_id: claim.id,
        },
        { transaction: t }
      );

      if (!transaction) await t.commit();

      return claim;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },
};