// 📁 backend/src/services/fxService.js

import { sequelize } from "../models/index.js";
import { Op } from "sequelize";
import { CURRENCY_RATE_STATUS } from "../constants/enums.js";

export const fxService = {
  /* ============================================================
     💱 CONVERT CURRENCY (MILLI PRECISION — FINAL)
  ============================================================ */
  async convert({
    amount,
    from_currency,
    to_currency,
    orgId,
    facilityId,
    transaction,
  }) {
    /* ================= SAFE GUARD ================= */
    if (amount == null || from_currency === to_currency) {
      return Number(amount || 0);
    }

    const CurrencyRate = sequelize.models.CurrencyRate;

    /* ================= 1️⃣ DIRECT (FACILITY) ================= */
    let rateRow = await CurrencyRate.findOne({
      where: {
        organization_id: orgId,
        facility_id: facilityId,
        from_currency,
        to_currency,
        status: CURRENCY_RATE_STATUS.ACTIVE,
      },
      order: [["effective_date", "DESC"]],
      transaction,
    });

    /* ================= 2️⃣ DIRECT (ORG FALLBACK) ================= */
    if (!rateRow) {
      rateRow = await CurrencyRate.findOne({
        where: {
          organization_id: orgId,
          facility_id: null,
          from_currency,
          to_currency,
          status: CURRENCY_RATE_STATUS.ACTIVE,
        },
        order: [["effective_date", "DESC"]],
        transaction,
      });
    }

    /* ================= 3️⃣ REVERSE (FACILITY) ================= */
    if (!rateRow && facilityId) {
      const reverse = await CurrencyRate.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          from_currency: to_currency,
          to_currency: from_currency,
          status: CURRENCY_RATE_STATUS.ACTIVE,
        },
        order: [["effective_date", "DESC"]],
        transaction,
      });

      if (reverse) {
        const amt = Number(amount);
        const rate = Number(reverse.rate);

        if (isNaN(amt) || isNaN(rate)) {
          throw new Error("Invalid reverse conversion values");
        }

        // 🔥 milli precision (6 decimals)
        return Number((amt / rate).toFixed(6));
      }
    }

    /* ================= 4️⃣ REVERSE (ORG FALLBACK) ================= */
    if (!rateRow) {
      const reverse = await CurrencyRate.findOne({
        where: {
          organization_id: orgId,
          facility_id: null,
          from_currency: to_currency,
          to_currency: from_currency,
          status: CURRENCY_RATE_STATUS.ACTIVE,
        },
        order: [["effective_date", "DESC"]],
        transaction,
      });

      if (reverse) {
        const amt = Number(amount);
        const rate = Number(reverse.rate);

        if (isNaN(amt) || isNaN(rate)) {
          throw new Error("Invalid reverse conversion values");
        }

        return Number((amt / rate).toFixed(6));
      }
    }

    /* ================= 5️⃣ ERROR ================= */
    if (!rateRow) {
      throw new Error(
        `Missing currency rate: ${from_currency} → ${to_currency}`
      );
    }

    /* ================= 6️⃣ FINAL CONVERSION ================= */
    const amt = Number(amount);
    const rate = Number(rateRow.rate);

    if (isNaN(amt) || isNaN(rate)) {
      throw new Error("Invalid conversion values");
    }

    // 🔥 milli precision (no float drift)
    return Number((amt * rate).toFixed(6));
  },
};