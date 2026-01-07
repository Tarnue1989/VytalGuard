// 📁 backend/src/services/refundService.js
import { sequelize, Refund, Payment, Invoice } from "../models/index.js";

export const refundService = {
  // 1️⃣ Create a refund against a payment
  async createRefund({ payment_id, amount, reason, userId }) {
    return sequelize.transaction(async (t) => {
      const payment = await Payment.findByPk(payment_id, { transaction: t });
      if (!payment) throw new Error("Payment not found");

      const invoice = await Invoice.findByPk(payment.invoice_id, { transaction: t });
      if (!invoice) throw new Error("Invoice not found");

      // ✅ Ensure refund is not greater than payment
      const refunded = await Refund.sum("amount", { where: { payment_id, status: "approved" }, transaction: t });
      if ((refunded || 0) + amount > payment.amount) {
        throw new Error("Refund exceeds payment amount");
      }

      // 🔁 Create Refund record
      const refund = await Refund.create(
        {
          payment_id,
          amount,
          reason,
          status: "pending", // requires approval
          created_by: userId,
        },
        { transaction: t }
      );

      return refund;
    });
  },

  // 2️⃣ Approve a refund (finance/admin action)
  async approveRefund(refundId, userId) {
    return sequelize.transaction(async (t) => {
      const refund = await Refund.findByPk(refundId, { transaction: t });
      if (!refund) throw new Error("Refund not found");
      if (refund.status !== "pending") throw new Error("Refund is not pending");

      refund.status = "approved";
      refund.updated_by = userId;
      await refund.save({ transaction: t });

      // 🔁 Adjust invoice balance
      const payment = await Payment.findByPk(refund.payment_id, { transaction: t });
      const invoice = await Invoice.findByPk(payment.invoice_id, { transaction: t });

      const paid = await Payment.sum("amount", { where: { invoice_id: invoice.id, status: "completed" }, transaction: t });
      const refunded = await Refund.sum("amount", { where: { payment_id: payment.id, status: "approved" }, transaction: t });

      invoice.total_paid = (paid || 0) - (refunded || 0);
      invoice.balance = invoice.total - invoice.total_paid;
      await invoice.save({ transaction: t });

      return { refund, invoice };
    });
  },

  // 3️⃣ Reject a refund
  async rejectRefund(refundId, userId) {
    const refund = await Refund.findByPk(refundId);
    if (!refund) throw new Error("Refund not found");
    if (refund.status !== "pending") throw new Error("Refund is not pending");

    refund.status = "rejected";
    refund.updated_by = userId;
    await refund.save();

    return refund;
  },
};
