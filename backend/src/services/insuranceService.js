// 📁 backend/src/services/insuranceService.js

import { sequelize, InsuranceClaim, Invoice } from "../models/index.js";

export const insuranceService = {
  /* ============================================================
     🏥 CREATE CLAIM FROM INVOICE
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
         💰 CALCULATE CLAIM AMOUNT
      ============================ */
      const claimAmount = invoice.total || 0;

      /* ============================
         🏥 CREATE CLAIM
      ============================ */
      const claim = await InsuranceClaim.create(
        {
          invoice_id: invoice.id,
          patient_id: invoice.patient_id,
          insurance_provider_id: invoice.insurance_provider_id,

          organization_id: invoice.organization_id,
          facility_id: invoice.facility_id,

          claim_amount: claimAmount,
          approved_amount: 0,

          status: "pending",

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