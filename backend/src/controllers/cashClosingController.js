// 📁 backend/src/controllers/cashClosingController.js
// ============================================================================
// 💰 Cash Closing Controller – ENTERPRISE MASTER (Deposit Pattern)
// ----------------------------------------------------------------------------
// 🔹 Ledger-based (source of truth)
// 🔹 Strict pagination
// 🔹 Date range support
// 🔹 Tenant-safe
// 🔹 Lock-safe
// 🔹 Audit-safe
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";

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
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";

import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";

import { makeModuleLogger } from "../utils/debugLogger.js";

import { FIELD_VISIBILITY_CASH_CLOSING } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================ */
const MODULE_KEY = "cash_closings";

/* ============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("cashClosingController", DEBUG_OVERRIDE);

/* ============================================================ */
const CLOSING_INCLUDES = [
  { model: Account, as: "account", attributes: ["id", "name"] },
  { model: Organization, as: "organization", attributes: ["id", "name"] },
  { model: Facility, as: "facility", attributes: ["id", "name"] },
  { model: User, as: "closedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 SCHEMA
============================================================ */
function buildSchema(role) {
  const base = {
    date: Joi.date().required(),
    account_id: Joi.string().uuid().required(),
  };

  if (role === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CLOSE CASH DAY
============================================================ */
export const closeCashDay = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const { value, errors } = validate(buildSchema(role), req.body);
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const { date, account_id } = value;

    /* ================= TENANT ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    /* ================= DUPLICATE CHECK ================= */
    const exists = await CashClosing.findOne({
      where: {
        date,
        account_id,
        organization_id: orgId,
      },
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "❌ Already closed for this date", null, 400);
    }

    /* ================= LEDGER FETCH ================= */
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const entries = await CashLedger.findAll({
      where: {
        account_id,
        organization_id: orgId,
        date: { [Op.between]: [start, end] },
      },
      transaction: t,
    });

    /* ================= CALCULATE ================= */
    let total_in = 0;
    let total_out = 0;

    entries.forEach((e) => {
      const amt = parseFloat(e.amount || 0);
      if (e.direction === "in") total_in += amt;
      if (e.direction === "out") total_out += amt;
    });

    /* ================= OPENING BALANCE ================= */
    const account = await Account.findByPk(account_id, {
    transaction: t,
    lock: t.LOCK.UPDATE,
    });

    if (!account) {
      await t.rollback();
      return error(res, "❌ Account not found", null, 400);
    }

    const closing_balance = parseFloat(account.balance || 0);
    const opening_balance = closing_balance - total_in + total_out;

    /* ================= CREATE ================= */
    const record = await CashClosing.create(
      {
        date,
        account_id,
        opening_balance,
        closing_balance,
        total_in,
        total_out,
        is_locked: true,
        organization_id: orgId,
        facility_id: facilityId,
        closed_by_id: req.user?.id || null,
        closed_at: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    const full = await CashClosing.findOne({
      where: { id: record.id },
      include: CLOSING_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "close",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Cash closed successfully", full);
  } catch (err) {
    await t.rollback();
    debug.error("closeCashDay FAILED", err);
    return error(res, "❌ Failed to close cash", err);
  }
};

/* ============================================================
   📌 GET ALL
============================================================ */
export const getAllClosings = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_CASH_CLOSING[role] ||
      FIELD_VISIBILITY_CASH_CLOSING.staff;

    const { dateRange, account_id, organization_id, facility_id, search, ...safeQuery } = req.query;

    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    const options = buildQueryOptions(req, "date", "DESC", visibleFields);
    options.where = { [Op.and]: [] };

    /* ================= DATE RANGE ================= */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          date: { [Op.between]: [start, end] },
        });
      }
    }

    /* ================= ACCOUNT FILTER ================= */
    if (account_id) {
      options.where[Op.and].push({
        account_id,
      });
    }

    /* ================= ORGANIZATION FILTER ================= */
    if (organization_id && isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id,
      });
    }

    /* ================= FACILITY FILTER ================= */
    if (facility_id && isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        facility_id,
      });
    }

    /* ================= SEARCH (OPTIONAL SIMPLE) ================= */
    if (search) {
      options.where[Op.and].push({
        [Op.or]: [
          { "$account.name$": { [Op.iLike]: `%${search}%` } },
          { "$organization.name$": { [Op.iLike]: `%${search}%` } },
          { "$facility.name$": { [Op.iLike]: `%${search}%` } },
        ],
      });
    }

    /* ================= TENANT SAFETY ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    }

    /* ================= CLEANUP ================= */
    if (options.where[Op.and].length === 0) {
      delete options.where[Op.and];
    }

    /* ================= FETCH ================= */
    const { count, rows } = await CashClosing.findAndCountAll({
      where: options.where,
      include: CLOSING_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        returned: rows.length,
        total: count,
        page,
        limit,
      },
    });

    /* ================= RESPONSE ================= */
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
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================
   📌 GET BY ID
============================================================ */
export const getClosingById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const record = await CashClosing.findOne({
      where: { id: req.params.id },
      include: CLOSING_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Not found", null, 404);
    }

    return success(res, "✅ Closing loaded", record);
  } catch (err) {
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================
   📌 REOPEN (UNLOCK)
============================================================ */
export const reopenClosing = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const record = await CashClosing.findByPk(req.params.id, {
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    await record.update(
      {
        is_locked: false,
      },
      { transaction: t }
    );

    await t.commit();

    return success(res, "✅ Closing reopened", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};