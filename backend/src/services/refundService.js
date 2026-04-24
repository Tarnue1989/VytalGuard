// 📁 backend/src/services/refundService.js
// ============================================================================
// 💰 PAYMENT REFUND SERVICE — FINAL (PROCESS-DRIVEN, CONSISTENT WITH DEPOSIT)
// ============================================================================

import db from "../models/index.js";
import { sequelize, Refund, Payment, Invoice } from "../models/index.js";
import { applyLifecycleTransition } from "../utils/lifecycleUtil.js";
import { REFUND_STATUS as RS, LEDGER_TYPES, LEDGER_DIRECTIONS } from "../constants/enums.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";
import { financialService } from "./financialService.js";

export const refundService = {

  /* =========================================================================
    1️⃣ CREATE REFUND (→ PENDING)
  ========================================================================= */
  async createRefund({ payment_id, amount, reason, user, t }) {

    const payment = await Payment.findByPk(payment_id, { transaction: t });
    if (!payment) throw new Error("Payment not found");

    const invoice = await Invoice.findByPk(payment.invoice_id, {
      transaction: t,
    });
    if (!invoice) throw new Error("Invoice not found");

    const refunded = await Refund.sum("amount", {
      where: { payment_id, status: RS.APPROVED },
      transaction: t,
    });

    if ((refunded || 0) + amount > payment.amount) {
      throw new Error("Refund exceeds payment amount");
    }

    const refund = await Refund.create(
      {
        payment_id,
        invoice_id: invoice.id,
        amount,
        reason,
        status: RS.PENDING,
        created_by_id: user.id,
      },
      { transaction: t, user }
    );

    await applyLifecycleTransition({
      entity: refund,
      action: "created",
      nextStatus: RS.PENDING,
      user,
      reason,
      t,
    });

    return refund;
  },

  /* =========================================================================
     2️⃣ APPROVE REFUND (PENDING → APPROVED)
  ========================================================================= */
  async approveRefund({ refund_id, user }) {
    return sequelize.transaction(async (t) => {

      const refund = await Refund.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (refund.status !== RS.PENDING) {
        throw new Error("Refund is not pending");
      }

      await applyLifecycleTransition({
        entity: refund,
        action: "approved",
        nextStatus: RS.APPROVED,
        user,
        t,
      });

      return { refund };
    });
  },

  /* =========================================================================
     3️⃣ PROCESS REFUND (APPROVED → PROCESSED)
  ========================================================================= */
  async processRefund({ refund_id, user }) {
    return sequelize.transaction(async (t) => {

      const refund = await Refund.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (refund.status !== RS.APPROVED) {
        throw new Error("Only approved refunds can be processed");
      }

      /* ================= FETCH PAYMENT ================= */
      const payment = await Payment.findByPk(refund.payment_id, { transaction: t });
      if (!payment) throw new Error("Payment not found");

      /* ================= FETCH INVOICE ================= */
      const invoice = await Invoice.findByPk(payment.invoice_id, { transaction: t });
      if (!invoice) throw new Error("Invoice not found");

      /* ================= 🔁 LIFECYCLE ================= */
      await applyLifecycleTransition({
        entity: refund,
        action: "processed",
        nextStatus: RS.PROCESSED,
        user,
        t,
      });

      /* ================= 🔄 RECALC ================= */
      await recalcInvoice(invoice.id, t);
      
      await financialService.logLedger({
        type: "refund",
        entity: refund,
        organization_id: refund.organization_id,
        facility_id: refund.facility_id,
        account_id: payment.account_id,
        patient_id: refund.patient_id,
        invoice_id: refund.invoice_id,
        amount: refund.amount,
        note: "Payment refund",
        user,
        t,
      });
      /* ================= 💰 CASH LEDGER ================= */
      await db.CashLedger.create(
        {
          date: new Date().toISOString().slice(0, 10),

          type: LEDGER_TYPES.REFUND,
          direction: LEDGER_DIRECTIONS.OUT,

          account_id: payment.account_id,
          amount: refund.amount,
          currency: payment.currency,

          reference_type: "payment_refund",
          reference_id: refund.id,

          organization_id: refund.organization_id,
          facility_id: refund.facility_id,
          created_by_id: user.id,
        },
        { transaction: t }
      );

      return { refund, invoice };
    });
  },

  /* =========================================================================
     4️⃣ REJECT REFUND (PENDING → REJECTED)
  ========================================================================= */
  async rejectRefund({ refund_id, user, reason }) {
    return sequelize.transaction(async (t) => {

      const refund = await Refund.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (refund.status !== RS.PENDING) {
        throw new Error("Refund is not pending");
      }

      await applyLifecycleTransition({
        entity: refund,
        action: "rejected",
        nextStatus: RS.REJECTED,
        user,
        reason,
        t,
      });

      return refund;
    });
  },

};