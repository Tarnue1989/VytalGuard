// 📁 backend/src/services/paymentService.js

import { sequelize, Payment, Invoice } from "../models/index.js";
import { lifecycleUtil } from "../utils/lifecycleUtil.js";
import { PAYMENT_STATUS } from "../constants/enums.js";

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

          currency, // 🔥 CRITICAL

          amount: numericAmount,
          method,
          transaction_ref,

          status: PAYMENT_STATUS.COMPLETED,
          created_by_id: user?.id,
        },
        { transaction: t, user }
      );

      /* ============================
         🔁 RECALCULATE INVOICE
      ============================ */
      const totalPaid = await Payment.sum("amount", {
        where: {
          invoice_id,
          status: PAYMENT_STATUS.COMPLETED,
        },
        transaction: t,
      });

      invoice.total_paid = totalPaid || 0;
      invoice.balance = parseFloat(invoice.total || 0) - invoice.total_paid;

      // 🔥 AUTO LOCK IF PAID
      if (invoice.balance <= 0) {
        invoice.is_locked = true;
        invoice.status = "paid";
      }

      await invoice.save({ transaction: t, user });

      return { payment, invoice };
    });
  },

  /* ============================================================
     🚫 VOID PAYMENT (SAFE + RECALC + UNLOCK SUPPORT)
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
         🔁 RECALCULATE INVOICE
      ============================ */
      const invoice = await Invoice.findByPk(payment.invoice_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!invoice) throw new Error("❌ Linked invoice not found");

      const totalPaid = await Payment.sum("amount", {
        where: {
          invoice_id: invoice.id,
          status: PAYMENT_STATUS.COMPLETED,
        },
        transaction: t,
      });

      invoice.total_paid = totalPaid || 0;
      invoice.balance = parseFloat(invoice.total || 0) - invoice.total_paid;

      // 🔥 UNLOCK IF PAYMENT REMOVED
      if (invoice.balance > 0) {
        invoice.is_locked = false;
        invoice.status = "pending";
      }

      await invoice.save({ transaction: t, user });

      return { payment, invoice };
    });
  },
};