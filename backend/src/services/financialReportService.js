import { Op, fn, col, literal } from "sequelize";
import db from "../models/index.js";

/* ============================================================
   📊 FINANCIAL REPORT SERVICE (FINAL PRO VERSION)
============================================================ */

export const financialReportService = {

  /* ============================================================
    🔹 OVERALL FINANCIAL SUMMARY (FINAL FIXED SYNC)
  ============================================================ */
  async getSummary({ from, to, organization_id, facility_id }) {

    const invoiceWhere = {
      organization_id,
      ...(facility_id && { facility_id }),
      invoice_date: { [Op.between]: [from, to] },
    };

    // 🔥 USE SAME SOURCE AS SERVICE TABLE (InvoiceItem)
    const items = await db.InvoiceItem.findOne({
      attributes: [
        [
          fn(
            "SUM",
            literal(`COALESCE("InvoiceItem"."net_amount",0) + COALESCE("InvoiceItem"."discount_amount",0)`)
          ),
          "gross"
        ],
        [fn("SUM", col("InvoiceItem.discount_amount")), "discount"],
        [fn("SUM", col("InvoiceItem.net_amount")), "net"],
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

    // 🔹 Invoice-level financials
    const summary = await db.Invoice.findOne({
      where: invoiceWhere,
      attributes: [
        [fn("COUNT", col("id")), "invoice_count"],
        [fn("SUM", col("total_paid")), "paid"],
        [fn("SUM", col("refunded_amount")), "payment_refunded"],
        [fn("SUM", col("balance")), "outstanding"],
      ],
      raw: true,
    });

    // 🔹 Deposits
    const deposits = await db.DepositApplication.findOne({
      attributes: [
        [fn("SUM", col("applied_amount")), "applied_deposits"],
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

    // 🔹 Waivers
    const waivers = await db.DiscountWaiver.findOne({
      attributes: [
        [fn("SUM", col("applied_total")), "waivers"],
      ],
      include: [
        {
          model: db.Invoice,
          as: "invoice",
          attributes: [],
          where: invoiceWhere,
        },
      ],
      where: {
        status: "applied",
      },
      raw: true,
    });

    return {
      invoice_count: Number(summary?.invoice_count || 0),

      // 🔥 NOW MATCHES SERVICE TABLE
      subtotal: Number(items?.gross || 0),      // Gross
      discounts: Number(items?.discount || 0),
      gross_total: Number(items?.net || 0),     // Net

      paid: Number(summary?.paid || 0),
      payment_refunded: Number(summary?.payment_refunded || 0),
      outstanding: Number(summary?.outstanding || 0),

      applied_deposits: Number(deposits?.applied_deposits || 0),
      waivers: Number(waivers?.waivers || 0),
    };
  },
  /* ============================================================
    🔹 REVENUE BY SERVICE (FINAL FIXED)
  ============================================================ */
  async getServiceBreakdown({ from, to, organization_id, facility_id }) {
    return await db.InvoiceItem.findAll({
      attributes: [
        [col("featureModule.key"), "module"],
        [fn("COUNT", col("InvoiceItem.id")), "items"],

        // ✅ CORRECT GROSS (net + discount)
        [
          fn(
            "SUM",
            literal(`COALESCE("InvoiceItem"."net_amount",0) + COALESCE("InvoiceItem"."discount_amount",0)`)
          ),
          "gross"
        ],

        // ✅ DISCOUNT
        [fn("SUM", col("InvoiceItem.discount_amount")), "discount"],

        // ✅ NET (ACTUAL REVENUE)
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
    🔹 PAYMENTS BY METHOD (FINAL ELITE FIX)
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
          [Op.in]: ["completed", "verified"], // 🔥 FINAL FIX
        },
      },

      group: ["method"],
      order: [[fn("SUM", col("Payment.amount")), "DESC"]], // 🔥 optional polish
      raw: true,
    });
  },
  /* ============================================================
     🔹 PAYMENT REFUNDS
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
     🔹 DEPOSIT SUMMARY
  ============================================================ */
  async getDeposits({ from, to, organization_id, facility_id }) {

    const invoiceWhere = {
      organization_id,
      ...(facility_id && { facility_id }),
      invoice_date: { [Op.between]: [from, to] },
    };

    /* ========================================================
      🔹 COLLECTED (REAL MONEY)
    ======================================================== */
    const collected = await db.Deposit.findOne({
      attributes: [
        [fn("SUM", col("amount")), "collected"],
      ],
      where: {
        organization_id,
        ...(facility_id && { facility_id }),
        status: "cleared", // 🔥 IMPORTANT
        created_at: { [Op.between]: [from, to] },
      },
      raw: true,
    });

    /* ========================================================
      🔹 APPLIED (USED IN INVOICES)
    ======================================================== */
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

    /* ========================================================
      🔹 REMAINING
    ======================================================== */
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

    return {
      collected: Number(collected?.collected || 0),
      applied: Number(applied?.applied || 0),
      remaining: Number(remaining?.remaining || 0),
      deposit_refunded: 0, // (optional if you track separately)
    };
  }
};