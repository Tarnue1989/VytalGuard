// 📁 backend/src/services/refundService.js
// ============================================================================
// 💰 PAYMENT REFUND SERVICE — FINAL (ENGINE-DRIVEN, CONSISTENT)
// ============================================================================

import { sequelize, Refund, Payment, Invoice } from "../models/index.js";
import { applyLifecycleTransition } from "../utils/lifecycleUtil.js";
import { REFUND_STATUS as RS } from "../constants/enums.js";
import { recalcInvoice } from "../utils/invoiceUtil.js"; // ✅ FIX

export const refundService = {

  /* =========================================================================
    1️⃣ CREATE REFUND (→ PENDING)
    ========================================================================= */
  async createRefund({ payment_id, amount, reason, user, t }) {

    /* ============================================================
       🔍 FETCH PAYMENT
    ============================================================ */
    const payment = await Payment.findByPk(payment_id, { transaction: t });
    if (!payment) throw new Error("Payment not found");

    /* ============================================================
       🔍 FETCH INVOICE
    ============================================================ */
    const invoice = await Invoice.findByPk(payment.invoice_id, {
      transaction: t,
    });
    if (!invoice) throw new Error("Invoice not found");

    /* ============================================================
       💰 VALIDATE REFUND LIMIT
    ============================================================ */
    const refunded = await Refund.sum("amount", {
      where: { payment_id, status: RS.APPROVED },
      transaction: t,
    });

    if ((refunded || 0) + amount > payment.amount) {
      throw new Error("Refund exceeds payment amount");
    }

    /* ============================================================
       🧾 CREATE REFUND
    ============================================================ */
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

    /* ============================================================
       🔁 LIFECYCLE + AUDIT
    ============================================================ */
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

      /* ============================================================
         🔁 LIFECYCLE
      ============================================================ */
      await applyLifecycleTransition({
        entity: refund,
        action: "approved",
        nextStatus: RS.APPROVED,
        user,
        t,
      });

      /* ============================================================
         🔍 FETCH INVOICE
      ============================================================ */
      const payment = await Payment.findByPk(refund.payment_id, { transaction: t });
      if (!payment) throw new Error("Payment not found");

      const invoice = await Invoice.findByPk(payment.invoice_id, { transaction: t });
      if (!invoice) throw new Error("Invoice not found");

      /* ============================================================
         🔥 FIX — USE CENTRAL ENGINE
      ============================================================ */
      await recalcInvoice(invoice.id, t);

      return { refund, invoice };
    });
  },

  /* =========================================================================
     3️⃣ REJECT REFUND (PENDING → REJECTED)
     ========================================================================= */
  async rejectRefund({ refund_id, user, reason }) {
    return sequelize.transaction(async (t) => {
      const refund = await Refund.findByPk(refund_id, { transaction: t });
      if (!refund) throw new Error("Refund not found");

      if (refund.status !== RS.PENDING) {
        throw new Error("Refund is not pending");
      }

      /* ============================================================
         🔁 LIFECYCLE
      ============================================================ */
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