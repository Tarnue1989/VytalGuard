/* ============================================================
   📁 backend/src/utils/invoiceUtil.js
   💰 ENTERPRISE MASTER ENGINE (FINAL CORRECT)
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
   🔧 ROUNDING HELPER
============================================================ */
const round2 = (num) =>
  Math.round((Number(num) + Number.EPSILON) * 100) / 100;

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
   🔁 RECALC ENGINE (FINAL — LOCK SAFE)
============================================================ */
export async function recalcInvoice(invoiceId, t = null) {
  global.__recalcLocks = global.__recalcLocks || {};

  if (global.__recalcLocks[invoiceId]) {
    debug.warn("BLOCKED: recalc already running", { invoiceId });
    return;
  }

  global.__recalcLocks[invoiceId] = true;

  try {
    debug.log("START recalcInvoice", { invoiceId });

    const invoice = await db.Invoice.findByPk(invoiceId, { transaction: t });

    // ✅ FIX: NULL SAFETY FIRST
    if (!invoice) throw new Error("❌ Invoice not found");

    /* ============================================================
      🔒 LOCK CHECK (MUST BE EARLY)
    ============================================================ */
    if (invoice.is_locked) {
      debug.log("LOCKED → payment-only recalculation", { invoiceId });

      const totalPaid =
        (await db.Payment.sum("amount", {
          where: {
            invoice_id: invoiceId,
            status: { [Op.in]: VALID_PAYMENT_STATUSES },
          },
          transaction: t,
        })) || 0;

      const totalDeposits =
        (await db.Deposit.sum("applied_amount", {
          where: {
            applied_invoice_id: invoiceId,
            applied_amount: { [Op.gt]: 0 },
          },
          transaction: t,
        })) || 0;

      const totalRefunds =
        (await db.Refund.sum("amount", {
          where: {
            invoice_id: invoiceId,
            status: { [Op.in]: VALID_REFUND_STATUSES },
          },
          transaction: t,
        })) || 0;

      const effectivePaid =
        Number(totalPaid) +
        Number(totalDeposits) -
        Number(totalRefunds);

      let balance = Number(invoice.total || 0) - effectivePaid;
      if (balance < 0) balance = 0;

      let newStatus = INVOICE_STATUS.UNPAID;

      if (balance <= 0 && invoice.total > 0) {
        newStatus = INVOICE_STATUS.PAID;
      } else if (effectivePaid > 0 && balance > 0) {
        newStatus = INVOICE_STATUS.PARTIAL;
      }

      await invoice.update(
        {
          total_paid: round2(totalPaid),
          applied_deposits: round2(totalDeposits),
          refunded_amount: round2(totalRefunds),
          balance: round2(balance),
          status: newStatus,
        },
        { transaction: t }
      );

      return invoice;
    }

    /* ============================================================
       🧾 BASE TOTALS
    ============================================================ */
    const items = await db.InvoiceItem.findAll({
      where: { invoice_id: invoiceId, status: "applied" },
      transaction: t,
    });

    const subtotal = items.reduce(
      (sum, i) => sum + Number(i.net_amount || 0),
      0
    );

    const tax = items.reduce(
      (sum, i) => sum + Number(i.tax_amount || 0),
      0
    );

    /* ============================================================
       💸 DISCOUNTS
    ============================================================ */
    const totalDiscounts =
      (await db.Discount.sum("applied_amount", {
        where: {
          invoice_id: invoiceId,
          status: VALID_DISCOUNT_STATUS,
        },
        transaction: t,
      })) || 0;

    const netAfterDiscount = subtotal - Number(totalDiscounts || 0);

    /* ============================================================
       🏥 INSURANCE
    ============================================================ */
    const policy = await db.PatientInsurance.findOne({
      where: {
        patient_id: invoice.patient_id,
        status: "active",
        organization_id: invoice.organization_id,
        ...(invoice.facility_id && { facility_id: invoice.facility_id }),
      },
      order: [["created_at", "DESC"]],
      transaction: t,
    });

    const limit = Number(policy?.coverage_limit || 0);

    const totalInsurance = Math.min(netAfterDiscount, limit);
    const totalPatient = netAfterDiscount - totalInsurance;

    /* ============================================================
       🔄 DISTRIBUTE INSURANCE
    ============================================================ */
    if (items.length) {
      const totalItems = subtotal;
      let distributed = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemTotal = Number(item.net_amount || 0);

        let share =
          totalItems > 0
            ? (itemTotal / totalItems) * totalInsurance
            : 0;

        if (i === items.length - 1) {
          share = totalInsurance - distributed;
        }

        const roundedShare = round2(share);
        distributed += roundedShare;

        await item.update(
          {
            insurance_amount: roundedShare,
            patient_amount: round2(itemTotal - roundedShare),
          },
          { transaction: t }
        );
      }
    }

    /* ============================================================
       💰 PAYMENTS
    ============================================================ */
    const totalPaid =
      (await db.Payment.sum("amount", {
        where: {
          invoice_id: invoiceId,
          status: { [Op.in]: VALID_PAYMENT_STATUSES },
        },
        transaction: t,
      })) || 0;

    const totalDeposits =
      (await db.Deposit.sum("applied_amount", {
        where: {
          applied_invoice_id: invoiceId,
          applied_amount: { [Op.gt]: 0 },
        },
        transaction: t,
      })) || 0;

    const totalRefunds =
      (await db.Refund.sum("amount", {
        where: {
          invoice_id: invoiceId,
          status: { [Op.in]: VALID_REFUND_STATUSES },
        },
        transaction: t,
      })) || 0;

    /* ============================================================
       🔥 FINAL CALCULATION
    ============================================================ */
    const total = totalPatient;

    const effectivePaid =
      Number(totalPaid) +
      Number(totalDeposits) -
      Number(totalRefunds);

    let balance = total - effectivePaid;
    if (balance < 0) balance = 0;

    let newStatus = INVOICE_STATUS.UNPAID;

    if (balance <= 0 && total > 0) {
      newStatus = INVOICE_STATUS.PAID;
    } else if (effectivePaid > 0 && balance > 0) {
      newStatus = INVOICE_STATUS.PARTIAL;
    }

    /* ============================================================
       🔓 NORMAL FULL RECALC
    ============================================================ */
    await invoice.update(
      {
        subtotal: round2(subtotal),
        total_tax: round2(tax),
        total_discount: round2(totalDiscounts),

        total_paid: round2(totalPaid),
        applied_deposits: round2(totalDeposits),
        refunded_amount: round2(totalRefunds),

        insurance_amount: round2(totalInsurance),
        patient_amount: round2(totalPatient),

        total: round2(total),
        balance: round2(balance),
        status: newStatus,
      },
      { transaction: t }
    );

    debug.log("DONE recalcInvoice", {
      subtotal,
      discount: totalDiscounts,
      insurance: totalInsurance,
      patient: totalPatient,
      balance,
    });

    return invoice;

  } finally {
    delete global.__recalcLocks[invoiceId];
  }
}