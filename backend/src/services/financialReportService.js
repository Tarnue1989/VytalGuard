import { Op, fn, col, literal } from "sequelize";
import db from "../models/index.js";

/* ============================================================
   📊 FINANCIAL REPORT SERVICE (ENTERPRISE CORRECTED)
============================================================ */

export const financialReportService = {

  /* ============================================================
    🔹 OVERALL FINANCIAL SUMMARY (FINAL SAFE VERSION)
  ============================================================ */
  async getSummary({ from, to, organization_id, facility_id }) {

    const invoiceWhere = {
      organization_id,
      ...(facility_id && { facility_id }),
      invoice_date: { [Op.between]: [from, to] },
    };

    /* ========================================================
      🔹 SERVICE ITEMS (SOURCE OF TRUTH)
    ======================================================== */
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

    /* ========================================================
      🔹 INVOICE LEVEL TOTALS
    ======================================================== */
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

    /* ========================================================
      🔹 DEPOSITS
    ======================================================== */
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

    /* ========================================================
      🔹 WAIVERS (🔥 FIXED: applied + finalized)
    ======================================================== */
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
        status: {
          [Op.in]: ["applied", "finalized"], // 🔥 IMPORTANT FIX
        },
      },
      raw: true,
    });

    /* ========================================================
      🔹 FINAL RETURN (NO DOUBLE COUNTING)
    ======================================================== */
    return {
      invoice_count: Number(summary?.invoice_count || 0),

      // 🔹 BEFORE DISCOUNT
      subtotal: Number(items?.gross || 0),

      // 🔹 ONLY ITEM DISCOUNTS (waiver already inside net)
      discounts: Number(items?.discount || 0),

      // 🔹 FINAL REVENUE (ALREADY INCLUDES WAIVERS)
      gross_total: Number(items?.net || 0),

      paid: Number(summary?.paid || 0),
      payment_refunded: Number(summary?.payment_refunded || 0),
      outstanding: Number(summary?.outstanding || 0),

      applied_deposits: Number(deposits?.applied_deposits || 0),

      // 🔹 SHOW WAIVER SEPARATELY (NO MERGE)
      waivers: Number(waivers?.waivers || 0),
    };
  },

  /* ============================================================
    🔹 REVENUE BY SERVICE
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
    🔹 PAYMENTS BY METHOD
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

    const collected = await db.Deposit.findOne({
      attributes: [
        [fn("SUM", col("amount")), "collected"],
      ],
      where: {
        organization_id,
        ...(facility_id && { facility_id }),
        status: "cleared",
        created_at: { [Op.between]: [from, to] },
      },
      raw: true,
    });

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
      deposit_refunded: 0,
    };
  }
};