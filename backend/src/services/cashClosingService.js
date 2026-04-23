// 📁 backend/src/services/cashClosingService.js

/* ============================================================
   💰 CASH CLOSING SERVICE
   ------------------------------------------------------------
   PURPOSE:
   Handles end-of-day financial closing per account.

   WHY THIS EXISTS:
   - Ensures all money is accounted for
   - Detects discrepancies (cash vs system)
   - Locks the day to prevent further edits
   - Required for real-world finance (hospitals, banks, etc.)
============================================================ */

import { Op } from "sequelize";
import db from "../models/index.js";
import { sequelize } from "../config/database.js";

/* ============================================================
   🔒 CHECK IF DATE IS LOCKED
   ------------------------------------------------------------
   Used in:
   - Payments
   - Deposits
   - Expenses
   - Transfers

   If locked → block transaction
============================================================ */
export async function isDateLocked({
  account_id,
  date,
  organization_id,
}) {
  const closing = await db.CashClosing.findOne({
    where: {
      account_id,
      date,
      organization_id,
      is_locked: true,
    },
  });

  return !!closing;
}

/* ============================================================
   🔍 GET CLOSING BY DATE
   ------------------------------------------------------------
   Used for:
   - UI display
   - Reports
============================================================ */
export async function getClosingByDate({
  account_id,
  date,
  organization_id,
}) {
  return await db.CashClosing.findOne({
    where: {
      account_id,
      date,
      organization_id,
    },
  });
}

/* ============================================================
   🔥 CLOSE CASH (MAIN FUNCTION)
   ------------------------------------------------------------
   STEPS:
   1. Prevent duplicate closing
   2. Load account
   3. Calculate totals from CashLedger
   4. Get opening balance
   5. Compute expected balance
   6. Save closing record
   7. Lock the day

   RETURNS:
   - closing record
   - expected balance
   - difference (important for audit)
============================================================ */
/* ============================================================
   🔥 CLOSE CASH (FULL FIXED – PRODUCTION SAFE)
============================================================ */
export async function closeCash({
  account_id,
  date,
  actual_balance,
  user,
}) {
  return await sequelize.transaction(async (t) => {

    /* ================= VALIDATION ================= */
    if (!account_id || !date) {
      throw new Error("❌ account_id and date required");
    }

    if (!user?.organization_id) {
      throw new Error("❌ User organization context missing");
    }

    /* ================= 🔒 PREVENT DUPLICATE ================= */
    const existing = await db.CashClosing.findOne({
      where: {
        account_id,
        date,
        organization_id: user.organization_id,
      },
      transaction: t,
    });

    if (existing) {
      throw new Error("❌ Cash already closed for this date");
    }

    /* ================= 🔒 LOAD ACCOUNT ================= */
    const account = await db.Account.findByPk(account_id, {
      transaction: t,
    });

    if (!account) throw new Error("❌ Account not found");

    /* ================= 💰 FETCH CASH LEDGER ================= */
    const entries = await db.CashLedger.findAll({
      where: {
        account_id,
        organization_id: user.organization_id,

        // ✅ FIXED (CRITICAL)
        date: date,

        // ✅ OPTIONAL (MULTI-FACILITY SAFE)
        ...(user.facility_id && { facility_id: user.facility_id }),
      },
      transaction: t,
    });

    let total_in = 0;
    let total_out = 0;

    for (const e of entries) {
      if (e.direction === "in") total_in += Number(e.amount);
      if (e.direction === "out") total_out += Number(e.amount);
    }

    /* ================= 🧮 OPENING BALANCE ================= */
    const prev = await db.CashClosing.findOne({
      where: {
        account_id,
        organization_id: user.organization_id,

        // ✅ FIX: only previous dates
        date: {
          [Op.lt]: date,
        },

        ...(user.facility_id && { facility_id: user.facility_id }),
      },
      order: [["date", "DESC"]],
      transaction: t,
    });

    const opening_balance = prev
      ? Number(prev.closing_balance)
      : 0;

    /* ================= 🧮 EXPECTED ================= */
    const expected_balance =
      opening_balance + total_in - total_out;

    /* ================= 🧮 FINAL ================= */
    const closing_balance =
      actual_balance ?? expected_balance;

    const difference =
      closing_balance - expected_balance;

    /* ================= 💾 SAVE ================= */
    const closing = await db.CashClosing.create(
      {
        date,
        account_id,

        opening_balance,
        closing_balance,

        total_in,
        total_out,

        is_locked: true, // 🔥 CRITICAL

        organization_id: user.organization_id,
        facility_id: user.facility_id || null,

        closed_by_id: user.id,
        closed_at: new Date(),
      },
      { transaction: t }
    );

    /* ================= RETURN ================= */
    return {
      closing,
      expected_balance,
      difference,
    };
  });
}