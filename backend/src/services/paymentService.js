// 📁 backend/src/services/paymentService.js
// ============================================================================
// 💳 Payment Service – FINAL (MASTER RECALC FIXED)
// ============================================================================

import { sequelize, Payment, Invoice } from "../models/index.js";
import { lifecycleUtil } from "../utils/lifecycleUtil.js";
import { PAYMENT_STATUS } from "../constants/enums.js";

// 🔥 ADD THIS
import { recalcInvoice } from "../utils/invoiceUtil.js";

export const paymentService = {
  /* ============================================================
     💳 CREATE PAYMENT (MULTI-CURRENCY SAFE + ENTERPRISE)
  ============================================================ */
  async createPayment({
    invoice_id,
    amount,
    method,
    transaction_ref,
    user,
  }) {
    return sequelize.transaction(async (t) => {
      /* ============================
         🔒 LOAD INVOICE
      ============================ */
      const invoice = await Invoice.findByPk(invoice_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!invoice) throw new Error("❌ Invoice not found");

      if (invoice.is_locked) {
        throw new Error("❌ Cannot add payment to locked invoice");
      }

      const numericAmount = parseFloat(amount);

      if (!numericAmount || numericAmount <= 0) {
        throw new Error("❌ Payment amount must be greater than 0");
      }

      /* ============================
         💱 CURRENCY ENFORCEMENT
      ============================ */
      const currency = invoice.currency;

      if (!currency) {
        throw new Error("❌ Invoice currency is missing");
      }

      /* ============================
         🚫 PREVENT OVERPAYMENT
      ============================ */
      const currentPaid = parseFloat(invoice.total_paid || 0);
      const total = parseFloat(invoice.total || 0);

      const newTotalPaid = currentPaid + numericAmount;

      if (newTotalPaid > total) {
        throw new Error(
          `❌ Overpayment detected. Invoice balance is ${invoice.balance}`
        );
      }

      /* ============================
         💳 CREATE PAYMENT
      ============================ */
      const payment = await Payment.create(
        {
          invoice_id,
          organization_id: invoice.organization_id,
          facility_id: invoice.facility_id,
          patient_id: invoice.patient_id,

          currency,

          amount: numericAmount,
          method,
          transaction_ref,

          status: PAYMENT_STATUS.COMPLETED,
          created_by_id: user?.id,
        },
        { transaction: t, user }
      );

      /* ============================================================
         🔁 MASTER RECALC (🔥 THIS FIXES YOUR ISSUE)
      ============================================================ */
      await recalcInvoice(invoice.id, t);

      return { payment };
    });
  },

  /* ============================================================
     🚫 VOID PAYMENT (SAFE + MASTER RECALC)
  ============================================================ */
  async voidPayment({ payment_id, user, reason }) {
    return sequelize.transaction(async (t) => {
      /* ============================
         🔒 LOAD PAYMENT
      ============================ */
      const payment = await Payment.findByPk(payment_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!payment) throw new Error("❌ Payment not found");

      if (payment.status !== PAYMENT_STATUS.COMPLETED) {
        throw new Error("❌ Only completed payments can be voided");
      }

      /* ============================
         🔁 LIFECYCLE TRANSITION
      ============================ */
      await lifecycleUtil.transition({
        model: Payment,
        record: payment,
        action: "voided",
        user,
        reason,
        t,
      });

      /* ============================
         🔒 LOAD INVOICE
      ============================ */
      const invoice = await Invoice.findByPk(payment.invoice_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!invoice) throw new Error("❌ Linked invoice not found");

      /* ============================================================
         🔁 MASTER RECALC (🔥 FIX)
      ============================================================ */
      await recalcInvoice(invoice.id, t);

      return { payment };
    });
  },
};