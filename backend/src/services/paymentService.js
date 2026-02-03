// 📁 backend/src/services/paymentService.js

import { sequelize, Payment, Invoice } from "../models/index.js";
import { lifecycleUtil } from "../utils/lifecycleUtil.js";

export const paymentService = {
  /* ============================================================
     💳 CREATE PAYMENT (FINALIZED BY DESIGN)
  ============================================================ */
  async createPayment({ invoice_id, amount, method, transaction_ref, user }) {
    return sequelize.transaction(async (t) => {
      const invoice = await Invoice.findByPk(invoice_id, { transaction: t });
      if (!invoice) throw new Error("Invoice not found");

      const payment = await Payment.create(
        {
          invoice_id,
          amount,
          method,
          transaction_ref,
          status: "completed",
          created_by_id: user.id,
        },
        { transaction: t }
      );

      // 🔁 Recalculate invoice
      const totalPaid = await Payment.sum("amount", {
        where: { invoice_id, status: "completed" },
        transaction: t,
      });

      invoice.total_paid = totalPaid || 0;
      invoice.balance = invoice.total - invoice.total_paid;
      await invoice.save({ transaction: t });

      return { payment, invoice };
    });
  },

  /* ============================================================
     🚫 VOID PAYMENT (LIFECYCLE-SAFE)
  ============================================================ */
  async voidPayment({ payment_id, user, reason }) {
    return sequelize.transaction(async (t) => {
      const payment = await Payment.findByPk(payment_id, { transaction: t });
      if (!payment) throw new Error("Payment not found");

      // ✅ lifecycle-safe transition
      await lifecycleUtil.transition({
        model: Payment,
        record: payment,
        action: "voided",
        user,
        reason,
        t,
      });

      // 🔁 Recalculate invoice
      const invoice = await Invoice.findByPk(payment.invoice_id, { transaction: t });

      const totalPaid = await Payment.sum("amount", {
        where: {
          invoice_id: invoice.id,
          status: "completed",
        },
        transaction: t,
      });

      invoice.total_paid = totalPaid || 0;
      invoice.balance = invoice.total - invoice.total_paid;
      await invoice.save({ transaction: t });

      return { payment, invoice };
    });
  },
};
