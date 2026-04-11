/* ============================================================
   📁 backend/src/utils/invoiceUtil.js
   💰 ENTERPRISE MASTER ENGINE (FINAL – DEPOSIT FIXED)
============================================================ */

import db, { sequelize } from "../models/index.js";
import { Op } from "sequelize";
import {
  INVOICE_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  DISCOUNT_WAIVER_STATUS,
  DISCOUNT_STATUS,
} from "../constants/enums.js";
import { makeModuleLogger } from "./debugLogger.js";

/* ============================================================
   🔧 DEBUG
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("invoiceUtil", DEBUG_OVERRIDE);

/* ============================================================
   🔁 VALID STATUSES
============================================================ */
const VALID_PAYMENT_STATUSES = [
  PAYMENT_STATUS.COMPLETED,
  PAYMENT_STATUS.VERIFIED,
];

const VALID_REFUND_STATUSES = [
  REFUND_STATUS.APPROVED,
  REFUND_STATUS.PROCESSED,
];

const VALID_WAIVER_STATUS = DISCOUNT_WAIVER_STATUS.APPLIED;
const VALID_DISCOUNT_STATUS = DISCOUNT_STATUS.FINALIZED;

/* ============================================================
   🔁 RECALC ENGINE
============================================================ */
export async function recalcInvoice(invoiceId, t = null) {
  if (global.__recalcRunning) {
    debug.warn("BLOCKED: recalc already running");
    return;
  }

  global.__recalcRunning = true;

  try {
    debug.log("START recalcInvoice", { invoiceId });

    const invoice = await db.Invoice.findByPk(invoiceId, { transaction: t });
    if (!invoice) throw new Error("❌ Invoice not found");

    /* ============================================================
       🏥 INSURANCE LIMIT LOGIC
    ============================================================ */
    const items = await db.InvoiceItem.findAll({
      where: { invoice_id: invoiceId, status: "applied" },
      order: [["created_at", "ASC"]],
      transaction: t,
    });

    const policy = await db.PatientInsurance.findOne({
      where: {
        patient_id: invoice.patient_id,
        status: "active",
      },
      order: [["created_at", "DESC"]],
      transaction: t,
    });

    const limit = Number(policy?.coverage_limit || 0);
    let remaining = limit;

    for (const item of items) {
      const raw = Number(item.insurance_amount || 0);
      const total = Number(item.total_price || 0);

      const applied = Math.min(raw, remaining);
      const patient = total - applied;

      if (
        Number(item.insurance_amount) !== applied ||
        Number(item.patient_amount) !== patient
      ) {
        await item.update(
          {
            insurance_amount: applied,
            patient_amount: patient,
          },
          { transaction: t }
        );
      }

      remaining -= applied;
      if (remaining <= 0) remaining = 0;
    }

    /* ============================================================
       💰 FINANCIAL AGGREGATION (FINAL FIXED)
    ============================================================ */

    // ✅ PAYMENTS
    const totalPaid =
      (await db.Payment.sum("amount", {
        where: {
          invoice_id: invoiceId,
          status: { [Op.in]: VALID_PAYMENT_STATUSES },
        },
        transaction: t,
      })) || 0;

    // 🔥 ✅ DEPOSITS (FINAL FIX)
    const totalDeposits =
      (await db.Deposit.sum("applied_amount", {
        where: {
          applied_invoice_id: invoiceId,
          applied_amount: { [Op.gt]: 0 }, // 🔥 ONLY COUNT USED AMOUNT
        },
        transaction: t,
      })) || 0;

    // ✅ REFUNDS
    const totalRefunds =
      (await db.Refund.sum("amount", {
        where: {
          invoice_id: invoiceId,
          status: { [Op.in]: VALID_REFUND_STATUSES },
        },
        transaction: t,
      })) || 0;

    // ✅ WAIVERS
    const totalWaivers =
      (await db.DiscountWaiver.sum("applied_total", {
        where: {
          invoice_id: invoiceId,
          status: VALID_WAIVER_STATUS,
        },
        transaction: t,
      })) || 0;

    // ✅ DISCOUNTS
    const totalDiscounts =
      (await db.Discount.sum("applied_amount", {
        where: {
          invoice_id: invoiceId,
          status: VALID_DISCOUNT_STATUS,
        },
        transaction: t,
      })) || 0;

    debug.log("financials", {
      totalPaid,
      totalDeposits,
      totalRefunds,
      totalWaivers,
      totalDiscounts,
    });

    /* ============================================================
       🔁 BASE TOTALS
    ============================================================ */

    const [rows] = await sequelize.query(
      `
      SELECT
        (SELECT COALESCE(SUM(i.net_amount),0) FROM invoice_items i WHERE i.invoice_id = inv.id) AS total_items,
        (SELECT COALESCE(SUM(i.tax_amount),0) FROM invoice_items i WHERE i.invoice_id = inv.id) AS total_tax
      FROM invoices inv
      WHERE inv.id = :invoiceId
      `,
      { replacements: { invoiceId }, transaction: t }
    );

    const t0 = rows[0] || {};

    const subtotal = Number(t0.total_items || 0);
    const tax = Number(t0.total_tax || 0);

    /* ============================================================
       🔥 FINAL CALCULATION
    ============================================================ */

    const total =
      subtotal +
      tax -
      Number(totalDiscounts) -
      Number(totalWaivers);

    const effectivePaid =
      Number(totalPaid) + Number(totalDeposits) - Number(totalRefunds);

    let balance = total - effectivePaid;
    if (balance < 0) balance = 0;

    /* ============================================================
       📊 STATUS
    ============================================================ */

    let newStatus = INVOICE_STATUS.UNPAID;

    if (balance <= 0 && total > 0) {
      newStatus = INVOICE_STATUS.PAID;
    } else if (effectivePaid > 0 && balance > 0) {
      newStatus = INVOICE_STATUS.PARTIAL;
    }

    /* ============================================================
       💾 UPDATE INVOICE
    ============================================================ */

    await invoice.update(
      {
        subtotal: subtotal.toFixed(2),
        total_tax: tax.toFixed(2),
        total_discount: Number(totalDiscounts).toFixed(2),
        total_paid: Number(totalPaid).toFixed(2),
        applied_deposits: Number(totalDeposits).toFixed(2),
        refunded_amount: Number(totalRefunds).toFixed(2),
        coverage_amount: Number(totalWaivers).toFixed(2),

        total: total.toFixed(2),
        balance: balance.toFixed(2),
        status: newStatus,
      },
      { transaction: t }
    );

    debug.log("DONE recalcInvoice", {
      total,
      balance,
      status: newStatus,
    });

    return invoice;
  } finally {
    global.__recalcRunning = false;
  }
}