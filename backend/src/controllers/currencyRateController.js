// 📁 controllers/currencyRateController.js

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  CurrencyRate,
  User,
  Facility,
  Organization,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { CURRENCY_RATE_STATUS } from "../constants/enums.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import {
  isSuperAdmin,
  isOrgOwner,
  isFacilityHead,
} from "../utils/role-utils.js";

import { buildQueryOptions } from "../utils/queryHelper.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

const MODULE_KEY = "currency_rates";

/* ============================================================
   🔧 DEBUG
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("currencyRateController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 INCLUDES
============================================================ */
const INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id","name","code"],
    required: false,
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id","name","code","organization_id"],
    required: false,
  },
  {
    model: User,
    as: "createdBy",
    attributes: ["id","first_name","last_name"],
    required: false,
  },
  {
    model: User,
    as: "updatedBy",
    attributes: ["id","first_name","last_name"],
    required: false,
  },
  {
    model: User,
    as: "deletedBy",
    attributes: ["id","first_name","last_name"],
    required: false,
  },
];

/* ============================================================
   📋 SCHEMA (MATCH ROLE STYLE)
============================================================ */
function buildSchema(isSuper, mode = "create") {
  const base = {
    from_currency: Joi.string().max(10),
    to_currency: Joi.string().max(10),

    rate: Joi.number().precision(6),
    effective_date: Joi.date().optional(), // DB default handles if not provided
  };

  if (mode === "create") {
    base.from_currency = base.from_currency.required();
    base.to_currency = base.to_currency.required();
    base.rate = Joi.number().precision(6).positive().required();
  } else {
    base.status = Joi.string()
      .valid(...Object.values(CURRENCY_RATE_STATUS))
      .optional();

    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }

  if (isSuper) {
    base.organization_id = Joi.string().uuid().allow(null).optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  } else {
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  return Joi.object(base).custom((value, helpers) => {
    // ❌ prevent same currency pair (matches model hook)
    if (
      value.from_currency &&
      value.to_currency &&
      value.from_currency === value.to_currency
    ) {
      return helpers.message("from_currency and to_currency cannot be the same");
    }
    return value;
  });
}
/* ============================================================
   📌 CREATE
============================================================ */
export const createCurrencyRate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("create → incoming", req.body);

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildSchema(isSuperAdmin(req.user), "create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = "organization_id" in value ? value.organization_id : null;
      facilityId = "facility_id" in value ? value.facility_id : null;
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      facilityId = "facility_id" in value ? value.facility_id : null;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    /* ========================================================
       🚫 UNIQUENESS (CRITICAL FOR FX)
    ======================================================== */
    const exists = await CurrencyRate.findOne({
      where: {
        organization_id: orgId,
        facility_id: facilityId,
        from_currency: value.from_currency,
        to_currency: value.to_currency,
        effective_date: value.effective_date || new Date(),
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "Currency rate already exists for this scope/date", null, 400);
    }

    const created = await CurrencyRate.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await CurrencyRate.findByPk(created.id, {
      include: INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Currency rate created", full);

  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create currency rate", err);
  }
};

/* ============================================================
   📌 UPDATE
============================================================ */
export const updateCurrencyRate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("update → incoming", {
      id: req.params.id,
      body: req.body,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const schema = buildSchema(isSuperAdmin(req.user), "update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await CurrencyRate.findByPk(req.params.id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Currency rate not found", null, 404);
    }

    let orgId = record.organization_id;
    let facilityId = record.facility_id;

    if (isSuperAdmin(req.user)) {
      if ("organization_id" in value) orgId = value.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? record.facility_id;
    }

    await record.update(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await CurrencyRate.findByPk(record.id, {
      include: INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Currency rate updated", full);

  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update currency rate", err);
  }
};

/* ============================================================
   📌 GET ALL CURRENCY RATES (MASTER PARITY + SUMMARY)
============================================================ */
export const getAllCurrencyRates = async (req, res) => {
  try {
    /* ========================================================
       🔐 AUTHORIZATION
    ======================================================== */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    debug.log("list → raw query", req.query);

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS (MASTER PARITY)
    ======================================================== */
    const options = buildQueryOptions(req, "effective_date", "DESC");

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS
    ======================================================== */
    delete options.filters?.dateRange;
    delete options.filters?.light;

    /* ========================================================
       🧱 WHERE ROOT
    ======================================================== */
    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE (MASTER)
    ======================================================== */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        effective_date: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* ========================================================
       🔐 TENANT / SCOPE (ROLE PARITY)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      // 🔒 lock to org
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      // 🔒 facility fallback logic
      if (req.user.facility_id) {
        options.where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
        });
      }
    } else {
      // 🧭 optional filters
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
    }

    /* ========================================================
       🔍 GLOBAL SEARCH
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { from_currency: { [Op.iLike]: `%${options.search}%` } },
          { to_currency: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       📌 FILTERS
    ======================================================== */

    if (req.query.from_currency) {
      options.where[Op.and].push({
        from_currency: req.query.from_currency,
      });
    }

    if (req.query.to_currency) {
      options.where[Op.and].push({
        to_currency: req.query.to_currency,
      });
    }

    if (req.query.status && Object.values(CURRENCY_RATE_STATUS).includes(req.query.status)) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       📦 QUERY EXECUTION (NO SCOPE — SAME AS ROLE)
    ======================================================== */
    const { count, rows } = await CurrencyRate.findAndCountAll({
      where: options.where,
      include: INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ========================================================
       📊 SUMMARY (ROLE STYLE)
    ======================================================== */
    const summary = {
      total: count,
      active: rows.filter(r => r.status === "active").length,
      inactive: rows.filter(r => r.status === "inactive").length,
    };

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        returned: count,
        query: req.query,
        dateRange: dateRange || null,
      },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "✅ Currency Rates loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });

  } catch (err) {
    debug.error("list → FAILED", err);
    return error(res, "❌ Failed to load currency rates", err);
  }
};
/* ============================================================
   📌 GET BY ID
============================================================ */
export const getCurrencyRateById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const found = await CurrencyRate.findOne({
      where,
      include: INCLUDES,
    });

    if (!found) return error(res, "❌ Currency rate not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: found,
    });

    return success(res, "✅ Currency rate loaded", found);
  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load currency rate", err);
  }
};

/* ============================================================
   📌 LITE (AUTOCOMPLETE)
============================================================ */
export const getAllCurrencyRatesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    const where = {
      status: CURRENCY_RATE_STATUS.ACTIVE,
      [Op.and]: [],
    };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (req.user.facility_id) {
        where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
        });
      }
    }

    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { from_currency: { [Op.iLike]: `%${q}%` } },
          { to_currency: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    const rows = await CurrencyRate.findAll({
      where,
      attributes: ["id","from_currency","to_currency","rate"],
      order: [["effective_date","DESC"]],
      limit: 50,
    });

    const result = rows.map(r => ({
      id: r.id,
      label: `${r.from_currency} → ${r.to_currency}`,
      rate: r.rate,
    }));

    return success(res, "✅ Currency rates loaded (lite)", { records: result });

  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load currency rates (lite)", err);
  }
};

/* ============================================================
   📌 TOGGLE STATUS
============================================================ */
export const toggleCurrencyRateStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await CurrencyRate.findByPk(id);
    if (!record) return error(res, "❌ Currency rate not found", null, 404);

    const { ACTIVE, INACTIVE } = CURRENCY_RATE_STATUS;
    const newStatus = record.status === ACTIVE ? INACTIVE : ACTIVE;

    await record.update({
      status: newStatus,
      updated_by_id: req.user.id,
    });

    const full = await CurrencyRate.findByPk(id, { include: INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: record.status, to: newStatus },
    });

    return success(res, `✅ Status set to ${newStatus}`, full);

  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle status", err);
  }
};

/* ============================================================
   📌 DELETE (SOFT DELETE)
============================================================ */
export const deleteCurrencyRate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const record = await CurrencyRate.findByPk(req.params.id, { transaction: t });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Currency rate not found", null, 404);
    }

    await record.update(
      { deleted_by_id: req.user.id },
      { transaction: t }
    );

    await record.destroy({ transaction: t });
    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: record.id,
    });

    return success(res, "✅ Currency rate deleted");

  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete currency rate", err);
  }
};