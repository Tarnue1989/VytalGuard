// 📁 backend/src/services/financialReportService.js
import { Op, fn, col, literal } from "sequelize";
import db from "../models/index.js";

/* ============================================================
   📊 FINANCIAL REPORT SERVICE (READ-ONLY)
   ------------------------------------------------------------
   ✅ PAYMENT refunds → Refund model
   ✅ DEPOSIT refunds → Deposit.refund_amount
   ❌ NO writes
   ❌ NO recalc
   ❌ NO ledger mutations
============================================================ */

export const financialReportService = {

  /* ============================================================
     🔹 OVERALL FINANCIAL SUMMARY (REVENUE VIEW)
     ------------------------------------------------------------
     Revenue logic:
       - gross_total  → invoices
       - refunded     → PAYMENT refunds only
       - deposits     → applied deposits only
       - outstanding  → invoice balance
  ============================================================ */
  async getSummary({ from, to, organization_id, facility_id }) {
    const where = {
      organization_id,
      ...(facility_id && { facility_id }),
      invoice_date: { [Op.between]: [from, to] },
    };

    return await db.Invoice.findOne({
      where,
      attributes: [
        [fn("COUNT", col("id")), "invoice_count"],
        [fn("SUM", col("subtotal")), "subtotal"],
        [fn("SUM", col("total_discount")), "discounts"],
        [fn("SUM", col("total_tax")), "tax"],
        [fn("SUM", col("total")), "gross_total"],
        [fn("SUM", col("total_paid")), "paid"],
        // 🔴 PAYMENT refunds only (from invoice rollups)
        [fn("SUM", col("refunded_amount")), "payment_refunded"],
        // 🟡 Deposits applied to invoices
        [fn("SUM", col("applied_deposits")), "applied_deposits"],
        [fn("SUM", col("balance")), "outstanding"],
      ],
      raw: true,
    });
  },

  /* ============================================================
     🔹 REVENUE BREAKDOWN BY SERVICE / MODULE
     ------------------------------------------------------------
     Source: InvoiceItem (applied only)
  ============================================================ */
  async getServiceBreakdown({ from, to, organization_id, facility_id }) {
    return await db.InvoiceItem.findAll({
      attributes: [
        "module",
        [fn("COUNT", col("InvoiceItem.id")), "items"],
        [fn("SUM", col("net_amount")), "revenue"],
      ],
      include: [
        {
          model: db.Invoice,
          as: "invoice",
          attributes: [],
          where: {
            organization_id,
            ...(facility_id && { facility_id }),
            invoice_date: { [Op.between]: [from, to] },
          },
        },
      ],
      where: { status: "applied" },
      group: ["InvoiceItem.module"],
      order: [[literal("revenue"), "DESC"]],
      raw: true,
    });
  },

  /* ============================================================
     🔹 PAYMENTS BY METHOD (CASH INFLOW)
     ------------------------------------------------------------
     Includes completed payments only
  ============================================================ */
  async getPaymentsByMethod({ from, to, organization_id, facility_id }) {
    return await db.Payment.findAll({
      attributes: [
        "method",
        [fn("SUM", col("amount")), "amount"],
      ],
      where: {
        organization_id,
        ...(facility_id && { facility_id }),
        status: "completed",
        created_at: { [Op.between]: [from, to] },
      },
      group: ["method"],
      raw: true,
    });
  },

  /* ============================================================
     🔹 PAYMENT REFUNDS (REVENUE REVERSAL)
     ------------------------------------------------------------
     IMPORTANT:
       - This is PAYMENT refunds only
       - Uses Refund model
       - Deposit refunds NEVER appear here
  ============================================================ */
  async getPaymentRefunds({ from, to, organization_id, facility_id }) {
    return await db.Refund.findAll({
      attributes: [
        "method",
        [fn("SUM", col("amount")), "amount"],
      ],
      where: {
        organization_id,
        ...(facility_id && { facility_id }),
        status: "processed",
        created_at: { [Op.between]: [from, to] },
      },
      group: ["method"],
      raw: true,
    });
  },

  /* ============================================================
     🔹 DEPOSIT OVERVIEW (LIABILITY VIEW)
     ------------------------------------------------------------
     Deposit refunds are tracked via:
       - Deposit.refund_amount
     NOT via Refund model
  ============================================================ */
  async getDeposits({ from, to, organization_id, facility_id }) {
    return await db.Deposit.findOne({
      attributes: [
        [fn("SUM", col("amount")), "collected"],
        [fn("SUM", col("applied_amount")), "applied"],
        [fn("SUM", col("refund_amount")), "deposit_refunded"],
        [fn("SUM", col("remaining_balance")), "remaining"],
      ],
      where: {
        organization_id,
        ...(facility_id && { facility_id }),
        created_at: { [Op.between]: [from, to] },
      },
      raw: true,
    });
  },

};
