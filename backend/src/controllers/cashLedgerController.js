// 📁 backend/src/controllers/cashLedgerController.js
// ============================================================================
// 📊 Cash Ledger Controller – MASTER-ALIGNED (READ ONLY FINAL - FIXED)
// ============================================================================

import { Op } from "sequelize";
import {
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
import {
  isSuperAdmin,
  isFacilityHead,
} from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import { FIELD_VISIBILITY_CASH_LEDGER } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { getLocalDate } from "../utils/date-utils.js";

/* ============================================================ */
const MODULE_KEY = "cash_ledgers";
const debug = makeModuleLogger("cashLedgerController");

/* ============================================================ */
const LEDGER_INCLUDES = [
  { model: Account, as: "account", attributes: ["id", "name", "type"] },
  { model: Organization, as: "organization", attributes: ["id", "name"] },
  { model: Facility, as: "facility", attributes: ["id", "name"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================ */
/* GET ALL */
export const getAllLedgerEntries = async (req, res) => {
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
      FIELD_VISIBILITY_CASH_LEDGER[role] ||
      FIELD_VISIBILITY_CASH_LEDGER.staff;

    const { dateRange, ...safeQuery } = req.query;
    req.query = safeQuery;

    const options = buildQueryOptions(req, "date", "DESC", visibleFields);
    options.where = { [Op.and]: [] };

    /* ================= TENANT (🔥 FIXED) ================= */
    if (isSuperAdmin(req.user)) {
      // ✅ allow filtering from frontend
      if (req.query.organization_id) {
        options.where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }

      if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    } else {
      // 🔒 enforce tenant
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    }

    /* ================= DATE ================= */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          date: { [Op.between]: [start, end] },
        });
      }
    } else {
      const today = getLocalDate();
      options.where[Op.and].push({ date: today });
    }

    /* ================= FILTERS ================= */
    if (req.query.account_id) {
      options.where[Op.and].push({ account_id: req.query.account_id });
    }

    if (req.query.type) {
      options.where[Op.and].push({ type: req.query.type });
    }

    if (req.query.direction) {
      options.where[Op.and].push({ direction: req.query.direction });
    }

    if (req.query.currency) {
      options.where[Op.and].push({ currency: req.query.currency });
    }

    if (req.query.reference_type) {
      options.where[Op.and].push({ reference_type: req.query.reference_type });
    }

    /* ================= SEARCH ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { description: { [Op.iLike]: `%${options.search}%` } },
          { reference_type: { [Op.iLike]: `%${options.search}%` } },
          { "$account.name$": { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    const { count, rows } = await CashLedger.findAndCountAll({
      where: options.where,
      include: LEDGER_INCLUDES,
      order: options.order,
      offset,
      limit,
    });

    /* ================= SUMMARY ================= */
    let total_in = 0;
    let total_out = 0;

    rows.forEach((r) => {
      const amt = parseFloat(r.amount || 0);
      if (r.direction === "in") total_in += amt;
      if (r.direction === "out") total_out += amt;
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { count },
    });

    return success(res, "✅ Ledger entries loaded", {
      records: rows,
      summary: {
        total_in,
        total_out,
        net: total_in - total_out,
      },
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load ledger", err);
  }
};

/* ============================================================ */
/* GET BY ID */
export const getLedgerEntryById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const record = await CashLedger.findByPk(req.params.id, {
      include: LEDGER_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Ledger entry not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
    });

    return success(res, "✅ Ledger entry loaded", record);
  } catch (err) {
    return error(res, "❌ Failed", err);
  }
};