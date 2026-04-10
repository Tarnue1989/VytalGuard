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
     Example: CLM-VYTG-000001
  ============================================================ */
  async generateClaimNumber({ organization_id, transaction }) {
    const org = await Organization.findByPk(organization_id, {
      attributes: ["code"],
      transaction,
    });

    const orgCode = org?.code || "ORG";

    /* ================= SAFE LAST RECORD ================= */
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
     🏥 CREATE CLAIM FROM INVOICE (ENTERPRISE FINAL)
  ============================================================ */
  async createClaimFromInvoice({ invoice_id, user, transaction }) {
    const t = transaction || (await sequelize.transaction());

    try {
      /* ============================
         🔒 LOAD INVOICE
      ============================ */
      const invoice = await Invoice.findByPk(invoice_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!invoice) throw new Error("❌ Invoice not found");

      if (!invoice.insurance_provider_id) {
        throw new Error("❌ No insurance provider on invoice");
      }

      /* ============================
         🚫 PREVENT DUPLICATE CLAIM
      ============================ */
      const existing = await InsuranceClaim.findOne({
        where: { invoice_id },
        transaction: t,
      });

      if (existing) return existing;

      /* ============================
         💰 CALCULATE CLAIM AMOUNT (FIXED)
      ============================ */
      const claimAmount = Number(invoice.coverage_amount || 0);

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
          amount_claimed: claimAmount,

          amount_approved: 0,
          amount_paid: 0,

          status: "submitted", // ✅ FIXED ENUM

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

      /* ============================
         ✅ COMMIT
      ============================ */
      if (!transaction) await t.commit();

      return claim;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },
};