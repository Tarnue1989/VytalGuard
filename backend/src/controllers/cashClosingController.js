// 📁 backend/src/controllers/cashClosingController.js
// ============================================================================
// 🧾 Cash Closing Controller – MASTER-ALIGNED (ACTION BASED)
// ============================================================================

import { Op, fn, col } from "sequelize";
import {
  sequelize,
  CashClosing,
  CashLedger,
  Account,
  Organization,
  Facility,
  User,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import {
  isSuperAdmin,
  isFacilityHead,
} from "../utils/role-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import { FIELD_VISIBILITY_CASH_CLOSING } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================ */
const MODULE_KEY = "cash_closing";
const debug = makeModuleLogger("cashClosingController");

/* ============================================================ */
const INCLUDES = [
  { model: Account, as: "account", attributes: ["id", "name"] },
  { model: Organization, as: "organization", attributes: ["id", "name"] },
  { model: Facility, as: "facility", attributes: ["id", "name"] },
  { model: User, as: "closedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================ */
/* CLOSE DAY */
export const closeDay = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const { account_id, date } = req.body;

    if (!account_id || !date) {
      await t.rollback();
      return error(res, "❌ account_id and date required", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      body: req.body,
    });

    /* ================= PREVENT DOUBLE CLOSE ================= */
    const existing = await CashClosing.findOne({
      where: { account_id, date },
      transaction: t,
    });

    if (existing) {
      await t.rollback();
      return error(res, "❌ Already closed for this date", null, 400);
    }

    /* ================= CALCULATE ================= */
    const totalIn = await CashLedger.sum("amount", {
      where: {
        account_id,
        direction: "in",
        date,
      },
    });

    const totalOut = await CashLedger.sum("amount", {
      where: {
        account_id,
        direction: "out",
        date,
      },
    });

    const account = await Account.findByPk(account_id);
    const closingBalance = parseFloat(account.balance || 0);

    const openingBalance =
      closingBalance - (parseFloat(totalIn || 0) - parseFloat(totalOut || 0));

    /* ================= SAVE ================= */
    const record = await CashClosing.create(
      {
        date,
        account_id,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        total_in: totalIn || 0,
        total_out: totalOut || 0,
        is_locked: true,
        organization_id: orgId,
        facility_id: facilityId,
        closed_by_id: req.user?.id || null,
        closed_at: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    const full = await CashClosing.findByPk(record.id, {
      include: INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "close_day",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Day closed successfully", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to close day", err);
  }
};

/* ============================================================ */
/* GET ALL */
export const getAllClosings = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { limit, page, offset } = validatePaginationStrict(req);

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_CASH_CLOSING[role] ||
      FIELD_VISIBILITY_CASH_CLOSING.staff;

    const { dateRange, ...safeQuery } = req.query;
    req.query = safeQuery;

    const where = { [Op.and]: [] };

    /* ================= TENANT ================= */
    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    }

    /* ================= DATE ================= */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        where[Op.and].push({
          date: { [Op.between]: [start, end] },
        });
      }
    }

    if (req.query.account_id) {
      where[Op.and].push({ account_id: req.query.account_id });
    }

    const { count, rows } = await CashClosing.findAndCountAll({
      where,
      include: INCLUDES,
      order: [["date", "DESC"]],
      offset,
      limit,
    });

    return success(res, "✅ Closings loaded", {
      records: rows,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load closings", err);
  }
};

/* ============================================================ */
/* GET BY ID */
export const getClosingById = async (req, res) => {
  try {
    const record = await CashClosing.findByPk(req.params.id, {
      include: INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Closing not found", null, 404);
    }

    return success(res, "✅ Closing loaded", record);
  } catch (err) {
    return error(res, "❌ Failed", err);
  }
};