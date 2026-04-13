// 📁 backend/src/services/financialReportService.js
// ============================================================================
// 📊 FINANCIAL REPORT SERVICE — FINAL ENTERPRISE VERSION (SOURCE OF TRUTH)
// ============================================================================

import { Op, fn, col, literal } from "sequelize";
import db from "../models/index.js";

/* ============================================================
   📊 FINANCIAL REPORT SERVICE (ENTERPRISE FINAL)
============================================================ */

export const financialReportService = {

  /* ============================================================
    🔹 OVERALL FINANCIAL SUMMARY (FIXED — USE INVOICE ONLY)
  ============================================================ */
  async getSummary({ from, to, organization_id, facility_id }) {

    const invoiceWhere = {
      organization_id,
      ...(facility_id && { facility_id }),
      invoice_date: { [Op.between]: [from, to] },
    };

    /* ========================================================
      🔹 INVOICE SOURCE OF TRUTH (🔥 FIXED)
    ======================================================== */
    const summary = await db.Invoice.findAll({
      attributes: [
        [fn("COUNT", col("id")), "invoice_count"],

        [fn("SUM", col("subtotal")), "gross"],
        [fn("SUM", col("total_discount")), "discount"],
        [fn("SUM", col("coverage_amount")), "waivers"],
        [fn("SUM", col("total")), "net"],

        [fn("SUM", col("total_paid")), "paid"],
        [fn("SUM", col("refunded_amount")), "payment_refunded"],
        [fn("SUM", col("applied_deposits")), "applied_deposits"],
        [fn("SUM", col("balance")), "outstanding"],
      ],
      where: invoiceWhere,
      raw: true,
    });

    const s = summary[0] || {};

    /* ========================================================
      🔹 FINAL RETURN
    ======================================================== */
    return {
      invoice_count: Number(s.invoice_count || 0),

      subtotal: Number(s.gross || 0),
      discounts: Number(s.discount || 0),
      waivers: Number(s.waivers || 0),
      gross_total: Number(s.net || 0),

      paid: Number(s.paid || 0),
      payment_refunded: Number(s.payment_refunded || 0),

      net_cash:
        Number(s.paid || 0) -
        Number(s.payment_refunded || 0),

      applied_deposits: Number(s.applied_deposits || 0),
      outstanding: Number(s.outstanding || 0),
    };
  },

  /* ============================================================
    🔹 REVENUE BY SERVICE (KEEP — CORRECT)
  ============================================================ */
  async getServiceBreakdown({ from, to, organization_id, facility_id }) {
    return await db.InvoiceItem.findAll({
      attributes: [
        [col("featureModule.key"), "module"],
        [fn("COUNT", col("InvoiceItem.id")), "items"],

        [
          fn(
            "SUM",
            literal(`COALESCE("InvoiceItem"."net_amount",0) + COALESCE("InvoiceItem"."discount_amount",0)`)
          ),
          "gross"
        ],

        [fn("SUM", col("InvoiceItem.discount_amount")), "discount"],
        [fn("SUM", col("InvoiceItem.net_amount")), "revenue"],
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
        {
          model: db.FeatureModule,
          as: "featureModule",
          attributes: [],
        },
      ],

      where: { status: "applied" },

      group: ["featureModule.key"],
      order: [[literal("revenue"), "DESC"]],
      raw: true,
    });
  },

  /* ============================================================
    🔹 PAYMENTS BY METHOD (KEEP — CORRECT)
  ============================================================ */
  async getPaymentsByMethod({ from, to, organization_id, facility_id }) {
    return await db.Payment.findAll({
      attributes: [
        "method",
        [fn("SUM", col("Payment.amount")), "amount"],
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
      where: {
        status: {
          [Op.in]: ["completed", "verified"],
        },
      },
      group: ["method"],
      order: [[fn("SUM", col("Payment.amount")), "DESC"]],
      raw: true,
    });
  },

  /* ============================================================
     🔹 PAYMENT REFUNDS (KEEP)
  ============================================================ */
  async getPaymentRefunds({ from, to, organization_id, facility_id }) {
    return await db.Refund.findAll({
      attributes: [
        "method",
        [fn("SUM", col("amount")), "amount"],
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
      where: {
        status: "processed",
      },
      group: ["method"],
      raw: true,
    });
  },

  /* ============================================================
    🔹 DEPOSIT SUMMARY (FINAL — TIMEZONE SAFE)
  ============================================================ */
  async getDeposits({ from, to, organization_id, facility_id }) {

    const invoiceWhere = {
      organization_id,
      ...(facility_id && { facility_id }),
      invoice_date: { [Op.between]: [from, to] },
    };

    /* ============================================================
      💰 COLLECTED (FIXED — DATE SAFE)
    ============================================================ */
    const collected = await db.Deposit.findOne({
      attributes: [
        [fn("SUM", col("amount")), "collected"],
      ],
      where: {
        organization_id,
        ...(facility_id && { facility_id }),
        status: "cleared",

        [Op.and]: [
          db.sequelize.where(
            db.sequelize.fn("DATE", db.sequelize.col("created_at")),
            {
              [Op.between]: [from, to],
            }
          ),
        ],
      },
      raw: true,
    });

    /* ============================================================
      💰 APPLIED (KEEP — CORRECT)
    ============================================================ */
    const applied = await db.DepositApplication.findOne({
      attributes: [
        [fn("SUM", col("applied_amount")), "applied"],
      ],
      include: [
        {
          model: db.Invoice,
          as: "invoice",
          attributes: [],
          where: invoiceWhere,
        },
      ],
      raw: true,
    });

    /* ============================================================
      💰 REMAINING (KEEP — CORRECT)
    ============================================================ */
    const remaining = await db.Deposit.findOne({
      attributes: [
        [fn("SUM", col("remaining_balance")), "remaining"],
      ],
      where: {
        organization_id,
        ...(facility_id && { facility_id }),
        status: "cleared",
      },
      raw: true,
    });

    /* ============================================================
      💰 REFUNDED (FIXED — DATE SAFE)
    ============================================================ */
    const refunded = await db.Deposit.findOne({
      attributes: [
        [fn("SUM", col("refund_amount")), "refunded"],
      ],
      where: {
        organization_id,
        ...(facility_id && { facility_id }),
        status: "cleared",

        [Op.and]: [
          db.sequelize.where(
            db.sequelize.fn("DATE", db.sequelize.col("updated_at")),
            {
              [Op.between]: [from, to],
            }
          ),
        ],
      },
      raw: true,
    });

    /* ============================================================
      📤 FINAL RETURN
    ============================================================ */
    return {
      collected: Number(collected?.collected || 0),
      applied: Number(applied?.applied || 0),
      remaining: Number(remaining?.remaining || 0),
      deposit_refunded: Number(refunded?.refunded || 0),
    };
  }
};