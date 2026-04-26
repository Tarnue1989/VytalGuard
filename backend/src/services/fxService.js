import { sequelize } from "../models/index.js";
import { Op } from "sequelize";
import { CURRENCY_RATE_STATUS } from "../constants/enums.js";

/* ============================================================
   🔧 DEBUG LOGGER
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = {
  log: (...args) => DEBUG_OVERRIDE && console.log(...args),
  error: (...args) => DEBUG_OVERRIDE && console.error(...args),
};

export const fxService = {
  async convert({
    amount,
    from_currency,
    to_currency,
    orgId,
    facilityId,
    transaction,
  }) {
    /* ================= BASIC GUARD ================= */
    if (amount == null || from_currency === to_currency) {
      return {
        amount: Number(amount || 0),
        rate: 1,
        from_currency,
        to_currency,
        effective_date: null,
      };
    }

    const CurrencyRate = sequelize.models.CurrencyRate;
    const today = new Date().toISOString().split("T")[0];

    debug.log("💱 FX REQUEST →", {
      amount,
      from_currency,
      to_currency,
      orgId,
      facilityId,
    });

    /* ============================================================
       🔍 ENTERPRISE SAFE RATE RESOLUTION (NO RAW SQL)
    ============================================================ */
    const findRate = async ({ from, to }) => {
      return await CurrencyRate.findAll({
        where: {
          from_currency: from,
          to_currency: to,
          status: CURRENCY_RATE_STATUS.ACTIVE,
          effective_date: { [Op.lte]: today },

          [Op.or]: [
            ...(facilityId
              ? [{ organization_id: orgId, facility_id: facilityId }]
              : []),

            { organization_id: orgId, facility_id: null },
            { organization_id: null, facility_id: null },
          ],
        },
        order: [["effective_date", "DESC"]],
        transaction,
      });
    };

    /* ============================================================
       🧠 PICK BEST MATCH MANUALLY (SAFE PRIORITY)
    ============================================================ */
    const pickBest = (rows) => {
      if (!rows || !rows.length) return null;

      // 1. facility match
      if (facilityId) {
        const facilityMatch = rows.find(
          (r) => r.facility_id === facilityId
        );
        if (facilityMatch) return facilityMatch;
      }

      // 2. org-level
      const orgMatch = rows.find(
        (r) => r.organization_id === orgId && r.facility_id == null
      );
      if (orgMatch) return orgMatch;

      // 3. global
      const globalMatch = rows.find(
        (r) => r.organization_id == null && r.facility_id == null
      );
      if (globalMatch) return globalMatch;

      return null;
    };

    /* ============================================================
       1️⃣ DIRECT LOOKUP
    ============================================================ */
    let rows = await findRate({
      from: from_currency,
      to: to_currency,
    });

    let rateRow = pickBest(rows);

    /* ============================================================
       2️⃣ REVERSE LOOKUP
    ============================================================ */
    if (!rateRow) {
      rows = await findRate({
        from: to_currency,
        to: from_currency,
      });

      const reverse = pickBest(rows);

      if (reverse) {
        debug.log("💱 USING REVERSE RATE →", reverse);

        return {
          amount: Number(
            (Number(amount) / Number(reverse.rate)).toFixed(6)
          ),
          rate: Number(reverse.rate),
          from_currency,
          to_currency,
          effective_date: reverse.effective_date,
        };
      }
    }

    /* ============================================================
       3️⃣ ERROR
    ============================================================ */
    if (!rateRow) {
      debug.error("❌ FX NOT FOUND", {
        from_currency,
        to_currency,
        orgId,
        facilityId,
      });

      throw new Error(
        `Missing currency rate: ${from_currency} → ${to_currency}`
      );
    }

    /* ============================================================
       4️⃣ FINAL DIRECT CONVERSION
    ============================================================ */
    debug.log("💱 USING DIRECT RATE →", rateRow);

    return {
      amount: Number(
        (Number(amount) * Number(rateRow.rate)).toFixed(6)
      ),
      rate: Number(rateRow.rate),
      from_currency,
      to_currency,
      effective_date: rateRow.effective_date,
    };
  },
};