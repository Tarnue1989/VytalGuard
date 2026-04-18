// 📁 backend/src/services/insuranceService.js

import {
  sequelize,
  InsuranceClaim,
  Invoice,
  Organization,
  PatientInsurance
} from "../models/index.js";

import { INSURANCE_CLAIM_STATUS } from "../constants/enums.js";

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
     🏥 CREATE / UPDATE CLAIM FROM INVOICE (FINAL + FIXED)
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

      if (
        invoice.payer_type !== "insurance" ||
        !invoice.insurance_provider_id
      ) {
        return null;
      }

      /* ============================
         🔒 ENSURE PATIENT INSURANCE
      ============================ */
      if (!invoice.patient_insurance_id) {
        throw new Error("❌ Missing patient insurance on invoice");
      }

      /* ============================
         🔗 LOAD ITEMS
      ============================ */
      const items = await invoice.getItems({ transaction: t });

      /* ============================
         💰 CALCULATE BREAKDOWN
      ============================ */
      const invoiceTotal = Number(invoice.total || 0);

      const insuranceAmount = (items || []).reduce(
        (sum, i) => sum + Number(i.insurance_amount || 0),
        0
      );

      const patientAmount = (items || []).reduce(
        (sum, i) => sum + Number(i.patient_amount || 0),
        0
      );

      /* ============================
         🔍 CHECK EXISTING CLAIM
      ============================ */
      const existing = await InsuranceClaim.findOne({
        where: { invoice_id },
        transaction: t,
      });

      if (existing) {
        await existing.update(
          {
            amount_claimed: insuranceAmount,
            insurance_amount: insuranceAmount,
            invoice_total: invoiceTotal,
            patient_amount: patientAmount,
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
         🧊 COVERAGE SNAPSHOT (🔥 FINAL FIX)
      ============================ */
      let coverageAmount = invoice.coverage_amount;
      let coverageCurrency = invoice.coverage_currency;

      /* 🔥 Ensure currency is NEVER null */
      if (!coverageCurrency) {
        const insurance = await PatientInsurance.findByPk(
          invoice.patient_insurance_id,
          { transaction: t }
        );

        if (insurance) {
          coverageAmount =
            coverageAmount !== null && coverageAmount !== undefined
              ? coverageAmount
              : insurance.coverage_limit;

          coverageCurrency = insurance.currency;
        }
      }

      /* 🔥 Final safety fallback */
      coverageCurrency =
        coverageCurrency || invoice.currency || "LRD";

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

          patient_insurance_id: invoice.patient_insurance_id,

          claim_number: claimNumber,

          currency: invoice.currency,

          /* 🔥 CORE */
          amount_claimed: insuranceAmount,

          /* 🔥 FULL BREAKDOWN */
          invoice_total: invoiceTotal,
          insurance_amount: insuranceAmount,
          patient_amount: patientAmount,

          /* 🔥 FIXED NUMERIC DEFAULTS */
          amount_approved: 0,
          amount_paid: 0,

          status: INSURANCE_CLAIM_STATUS.DRAFT,

          coverage_amount_at_claim: coverageAmount,
          coverage_currency: coverageCurrency,

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