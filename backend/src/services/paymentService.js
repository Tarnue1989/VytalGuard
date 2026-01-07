// 📁 backend/src/services/paymentService.js
import { sequelize, Payment, Invoice } from "../models/index.js";

export const paymentService = {
  // 1️⃣ Record a new payment
  async createPayment({ invoice_id, amount, method, transaction_ref, userId }) {
    return sequelize.transaction(async (t) => {
      const invoice = await Invoice.findByPk(invoice_id, { transaction: t });
      if (!invoice) throw new Error("Invoice not found");

      // 🔁 Create Payment
      const payment = await Payment.create(
        {
          invoice_id,
          amount,
          method,
          status: "completed",
          transaction_ref,
          created_by: userId,
        },
        { transaction: t }
      );

      // 🔁 Update invoice balance
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

  // 2️⃣ Void a payment (e.g., error or reversed transaction)
  async voidPayment(paymentId, userId) {
    return sequelize.transaction(async (t) => {
      const payment = await Payment.findByPk(paymentId, { transaction: t });
      if (!payment) throw new Error("Payment not found");

      payment.status = "voided";
      payment.updated_by = userId;
      await payment.save({ transaction: t });

      // 🔁 Recalc invoice balance
      const invoice = await Invoice.findByPk(payment.invoice_id, { transaction: t });
      const totalPaid = await Payment.sum("amount", {
        where: { invoice_id: invoice.id, status: "completed" },
        transaction: t,
      });

      invoice.total_paid = totalPaid || 0;
      invoice.balance = invoice.total - invoice.total_paid;
      await invoice.save({ transaction: t });

      return { payment, invoice };
    });
  },
};
