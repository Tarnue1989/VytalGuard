import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  BillableItem,
  BillableItemPrice,
  BillableItemPriceHistory,
  User,
  Facility,
  Organization,
  Department,
  MasterItem,
  MasterItemCategory,
  AutoBillingRule,
} from "../models/index.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { success, error } from "../utils/response.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { validate } from "../utils/validation.js";
import { BILLABLE_ITEM_STATUS } from "../constants/enums.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";

import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (Billable Item)
============================================================ */
const MODULE_KEY = "billable_items";

const DEBUG_OVERRIDE = true; // 👈 turn OFF in prod
const debug = makeModuleLogger("billableItemController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const BILLABLE_ITEM_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: Department, as: "department", attributes: ["id", "name", "code"] },
  { model: MasterItem, as: "masterItem", attributes: ["id", "name", "code", "description"] },
  { model: MasterItemCategory, as: "category", attributes: ["id", "name", "code"] },

  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
];
/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA (Patient-Parity, FINAL)
============================================================ */
function buildBillableItemSchema(user, mode = "create") {
  const base = {
    master_item_id: Joi.string().uuid().required(),
    department_id: Joi.string().uuid().allow("", null),
    category_id: Joi.string().uuid().allow("", null),

    name: Joi.string().max(150).required(),
    code: Joi.string().max(100).allow("", null),
    description: Joi.string().allow("", null),

    price: Joi.number().precision(2).min(0).required(),
    currency: Joi.string().max(10).default("USD"),

    taxable: Joi.boolean().default(false),
    discountable: Joi.boolean().default(true),
    override_allowed: Joi.boolean().default(true),

    /* ================= SYSTEM / BACKEND CONTROLLED ================= */
    status: Joi.any().strip(),
    organization_id: Joi.any().strip(),
    facility_id: Joi.any().strip(),
  };

  /* ============================================================
     🔓 SUPER ADMIN OVERRIDE (Patient-Parity)
     - Allow but DO NOT force
     - resolveOrgFacility() remains authority
  ============================================================ */
  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  /* ============================================================
     ✏️ UPDATE MODE (all fields optional)
  ============================================================ */
  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}


/* ============================================================
   📌 CREATE BILLABLE ITEM(S) (FINAL — WITH PRICING FIX)
============================================================ */
export const createBillableItems = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    debug.log("create → incoming body", req.body);

    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    if (!payloads.length) {
      await t.rollback();
      return error(res, "Payload must be an object or non-empty array", null, 400);
    }

    const created = [];
    const skipped = [];

    for (const [index, raw] of payloads.entries()) {
      debug.log(`create[${index}] → raw payload`, raw);

      /* ================= VALIDATION ================= */
      const { value, errors } = validate(
        buildBillableItemSchema(req.user, "create"),
        raw
      );

      if (errors) {
        skipped.push({ index, reason: "Validation failed", errors });
        continue;
      }

      /* ================= ROLE SCOPE ================= */
      let orgId = null;
      let facilityId = null;

      if (isSuperAdmin(req.user)) {
        orgId = raw.organization_id ?? null;
        facilityId = raw.facility_id ?? null;

      } else if (isOrgLevelUser(req.user)) {
        orgId = req.user.organization_id;

        if (raw.facility_id) {
          facilityId = raw.facility_id;
        } else if (req.user.facility_id) {
          facilityId = req.user.facility_id;
        } else {
          skipped.push({
            index,
            reason: "Facility is required for organization-level user",
          });
          continue;
        }

      } else if (isFacilityHead(req.user)) {
        orgId = req.user.organization_id;
        facilityId = req.user.facility_id;

      } else {
        orgId = req.user.organization_id;
        facilityId = req.user.facility_id ?? null;
      }

      if (!orgId) {
        skipped.push({ index, reason: "Missing organization assignment" });
        continue;
      }

      /* ================= DUPLICATE CHECK ================= */
      const exists = await BillableItem.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          master_item_id: value.master_item_id,
        },
        paranoid: false,
        transaction: t,
      });

      if (exists) {
        skipped.push({
          index,
          reason: `Duplicate master_item_id=${value.master_item_id}`,
        });
        continue;
      }

      /* ================= CREATE ================= */
      const item = await BillableItem.create(
        {
          ...value,
          organization_id: orgId,
          facility_id: facilityId,
          status: BILLABLE_ITEM_STATUS.ACTIVE,
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );

      created.push(item);

      /* ============================================================
         🔥 PRICE TABLE (CRITICAL — THIS FIXES BILLING)
      ============================================================ */
      await BillableItemPrice.create(
        {
          organization_id: orgId,
          facility_id: facilityId,
          billable_item_id: item.id,
          payer_type: "cash",
          currency: item.currency,
          price: item.price,
          is_default: true,
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );

      /* ================= PRICE HISTORY ================= */
      await BillableItemPriceHistory.create(
        {
          billable_item_id: item.id,
          organization_id: orgId,
          facility_id: facilityId,
          old_price: item.price,
          new_price: item.price,
          old_currency: item.currency,
          new_currency: item.currency,
          effective_date: new Date(),
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const full = created.length
      ? await BillableItem.findAll({
          where: { id: { [Op.in]: created.map((c) => c.id) } },
          include: BILLABLE_ITEM_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: payloads.length > 1 ? "bulk_create" : "create",
      details: { created: created.length, skipped: skipped.length },
    });

    return success(res, {
      message: `✅ ${created.length} created, ⚠️ ${skipped.length} skipped`,
      records: full,
      skipped,
    });

  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create billable item(s)", err);
  }
};

/* ============================================================
   ✏️ UPDATE BILLABLE ITEM (PATIENT-PARITY, FINAL)
   - Enum safe
   - Role scoped
   - Price history preserved
   - Transaction atomic
   - 🔒 DB-SAFE org/fac preservation
============================================================ */
/* ============================================================
   ✏️ UPDATE BILLABLE ITEM (FINAL — WITH PRICE SYNC)
============================================================ */
export const updateBillableItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    /* ================= DEBUG ================= */
    debug.log("update → incoming body", req.body);

    /* ================= VALIDATION ================= */
    const { value, errors } = validate(
      buildBillableItemSchema(req.user, "update"),
      req.body
    );

    if (errors) {
      debug.warn("update → validation error", errors);
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    debug.log("update → validated value", value);

    /* ================= LOAD ================= */
    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const item = await BillableItem.findOne({ where, transaction: t });

    if (!item) {
      await t.rollback();
      return error(res, "❌ Billable Item not found", null, 404);
    }

    debug.log("update → before", item.toJSON());

    /* ================= SNAPSHOT ================= */
    const oldPrice = item.price;
    const oldCurrency = item.currency;

    /* ================= RESOLVE TENANT ================= */
    const resolvedOrgId =
      value.organization_id ?? item.organization_id;

    const resolvedFacilityId =
      value.facility_id ?? item.facility_id;

    if (!resolvedOrgId || !resolvedFacilityId) {
      await t.rollback();
      return error(
        res,
        "❌ Organization / Facility scope lost during update",
        null,
        400
      );
    }

    /* ================= UPDATE ITEM ================= */
    await item.update(
      {
        ...value,
        organization_id: resolvedOrgId,
        facility_id: resolvedFacilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ============================================================
       🔥 PRICE TABLE SYNC (CRITICAL FIX)
    ============================================================ */
    if (
      value.price !== undefined &&
      (value.price !== oldPrice || value.currency !== oldCurrency)
    ) {
      await BillableItemPrice.update(
        {
          price: item.price,
          currency: item.currency,
          updated_by_id: req.user?.id || null,
        },
        {
          where: {
            billable_item_id: item.id,
            payer_type: "cash",
            organization_id: resolvedOrgId,
            facility_id: resolvedFacilityId,
          },
          transaction: t,
        }
      );
    }

    /* ================= PRICE HISTORY ================= */
    if (
      value.price !== undefined &&
      (value.price !== oldPrice || value.currency !== oldCurrency)
    ) {
      await BillableItemPriceHistory.create(
        {
          billable_item_id: item.id,
          organization_id: resolvedOrgId,
          facility_id: resolvedFacilityId,
          old_price: oldPrice,
          new_price: item.price,
          old_currency: oldCurrency,
          new_currency: item.currency,
          effective_date: new Date(),
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );
    }

    debug.log("update → after", item.toJSON());

    await t.commit();

    /* ================= RELOAD ================= */
    const full = await BillableItem.findOne({
      where: { id },
      include: BILLABLE_ITEM_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Billable Item updated", full);

  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update billable item", err);
  }
};

/* ============================================================
   📌 GET ALL BILLABLE ITEMS (MASTER PARITY + GLOBAL SUMMARY)
============================================================ */
export const getAllBillableItems = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS
    ======================================================== */
    const options = buildQueryOptions(req, "created_at", "DESC");

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS
    ======================================================== */
    delete options.filters?.dateRange;
    delete options.filters?.light;

    /* ========================================================
       🧱 BASE WHERE (USED BY LIST + SUMMARY)
    ======================================================== */
    const baseWhere = { [Op.and]: [] };

    /* ---------------- Date Range ---------------- */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      baseWhere[Op.and].push({
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* ---------------- Tenant Scope ---------------- */
    if (!isSuperAdmin(req.user)) {
      baseWhere[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        baseWhere[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    } else {
      if (req.query.organization_id) {
        baseWhere[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (req.query.facility_id) {
        baseWhere[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    }

    /* ---------------- STATUS FILTER ---------------- */
    if (
      req.query.status &&
      Object.values(BILLABLE_ITEM_STATUS).includes(req.query.status)
    ) {
      baseWhere[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       🔎 SEARCH (LIST ONLY – JOINS ALLOWED)
    ======================================================== */
    const searchWhere = [];

    if (options.search) {
      searchWhere.push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { code: { [Op.iLike]: `%${options.search}%` } },
          { description: { [Op.iLike]: `%${options.search}%` } },
          { "$category.name$": { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       🧱 FINAL LIST WHERE
    ======================================================== */
    const listWhere = {
      [Op.and]: [...baseWhere[Op.and], ...searchWhere],
    };

    /* ========================================================
       📄 MAIN LIST QUERY
    ======================================================== */
    const { count, rows } = await BillableItem.findAndCountAll({
      where: listWhere,
      include: BILLABLE_ITEM_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
      subQuery: false,
    });

    /* ========================================================
       📊 SUMMARY (BASE WHERE ONLY)
    ======================================================== */
    const statusCountsRaw = await BillableItem.findAll({
      where: baseWhere,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    const priceAgg = await BillableItem.findOne({
      where: baseWhere,
      attributes: [
        [sequelize.fn("MIN", sequelize.col("price")), "min"],
        [sequelize.fn("MAX", sequelize.col("price")), "max"],
        [sequelize.fn("AVG", sequelize.col("price")), "avg"],
      ],
      raw: true,
    });

    const currencyRaw = await BillableItem.findAll({
      where: baseWhere,
      attributes: [
        "currency",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["currency"],
      raw: true,
    });

    const flagAgg = await BillableItem.findOne({
      where: baseWhere,
      attributes: [
        [
          sequelize.fn(
            "SUM",
            sequelize.literal("CASE WHEN taxable THEN 1 ELSE 0 END")
          ),
          "taxable_yes",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal("CASE WHEN discountable THEN 1 ELSE 0 END")
          ),
          "discountable_yes",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal("CASE WHEN override_allowed THEN 1 ELSE 0 END")
          ),
          "override_yes",
        ],
      ],
      raw: true,
    });

    /* ========================================================
       🧠 SUMMARY SHAPING
    ======================================================== */
    const summary = { total: count };

    Object.values(BILLABLE_ITEM_STATUS).forEach((s) => {
      const row = statusCountsRaw.find((r) => r.status === s);
      summary[s] = row ? Number(row.count) : 0;
    });

    summary.price = {
      min: Number(priceAgg?.min || 0),
      max: Number(priceAgg?.max || 0),
      average: priceAgg?.avg
        ? Number(Number(priceAgg.avg).toFixed(2))
        : 0,
    };

    summary.currency = currencyRaw.reduce((acc, r) => {
      acc[r.currency] = Number(r.count);
      return acc;
    }, {});

    summary.taxable = {
      yes: Number(flagAgg?.taxable_yes || 0),
      no: count - Number(flagAgg?.taxable_yes || 0),
    };

    summary.discountable = {
      yes: Number(flagAgg?.discountable_yes || 0),
      no: count - Number(flagAgg?.discountable_yes || 0),
    };

    summary.override_allowed = {
      yes: Number(flagAgg?.override_yes || 0),
      no: count - Number(flagAgg?.override_yes || 0),
    };

    if (dateRange) {
      summary.dateRange = {
        start: dateRange.start,
        end: dateRange.end,
      };
    }

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Billable Items loaded", {
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
    return error(res, "❌ Failed to load billable items", err);
  }
};


/* ============================================================
   📌 GET BILLABLE ITEM BY ID (MASTER PARITY)
============================================================ */
export const getBillableItemById = async (req, res) => {
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
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const item = await BillableItem.findOne({
      where,
      include: BILLABLE_ITEM_INCLUDES,
    });

    if (!item) {
      return error(res, "❌ Billable Item not found", null, 404);
    }

    const history = await BillableItemPriceHistory.findAll({
      where: { billable_item_id: id },
      include: [
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
      order: [["effective_date", "DESC"]],
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: item,
    });

    return success(res, "✅ Billable Item loaded", {
      ...item.toJSON(),
      priceHistory: history,
    });
  } catch (err) {
    debug.error("getById → FAILED", err);
    return error(res, "❌ Failed to load billable item", err);
  }
};

/* ============================================================
   📌 GET BILLABLE ITEMS LITE (MASTER PARITY – FINAL + MODULE LINK)
   - Active only
   - Tenant safe
   - Super admin supports global + facility
   - 🔥 Supports module → billable via code
   - 🔥 FIXED: category filter + safe include + scalable
============================================================ */
export const getAllBillableItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ============================================================
       🧾 QUERY PARAMS
    ============================================================ */
    const { q, category_id, category, code, limit } = req.query;

    /* ============================================================
       🧱 BASE WHERE
    ============================================================ */
    const where = {
      status: BILLABLE_ITEM_STATUS.ACTIVE, // ACTIVE ONLY
      [Op.and]: [],
    };

    /* ============================================================
       🔒 TENANT SCOPE
    ============================================================ */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
        });
      }
    } else {
      if (req.query.organization_id) {
        where.organization_id = req.query.organization_id;
      }

      if (req.query.facility_id) {
        where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.query.facility_id },
          ],
        });
      }
    }

    /* ============================================================
       🧩 CATEGORY FILTER (FIXED – RELATION SAFE)
    ============================================================ */
    const categoryWhere = {};

    if (category_id) {
      where.category_id = category_id;
    }

    if (category) {
      categoryWhere.code = category;
    }

    /* ============================================================
       🔥 MODULE → BILLABLE LINK (IMPROVED)
    ============================================================ */
    if (code) {
      where.code = { [Op.iLike]: `%${code}%` };
    }

    /* ============================================================
       🔍 SEARCH
    ============================================================ */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { code: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
          { "$category.name$": { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    /* ============================================================
       📦 QUERY
    ============================================================ */
    const items = await BillableItem.findAll({
      where,
      include: [
        {
          model: MasterItemCategory,
          as: "category",
          attributes: ["id", "name", "code"],
          ...(category ? { where: categoryWhere } : {}),
          required: !!category, // 🔥 ensures proper filtering
        },
      ],
      attributes: ["id", "name", "code", "price", "currency"],
      order: [["name", "ASC"]],
      limit: parseInt(limit) || 500, // 🔥 scalable
      subQuery: false, // 🔥 prevents join issues
    });

    /* ============================================================
       🔄 SHAPE RESPONSE
    ============================================================ */
    const records = items.map((i) => ({
      id: i.id,
      name: i.name,
      code: i.code,
      price: i.price,
      currency: i.currency,
      category: i.category
        ? {
            id: i.category.id,
            name: i.category.name,
            code: i.category.code,
          }
        : null,
    }));

    /* ============================================================
       🧾 AUDIT
    ============================================================ */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: records.length,
        q,
        category,
        category_id,
        code,
      },
    });

    /* ============================================================
       📤 RESPONSE
    ============================================================ */
    return success(res, "✅ Billable Items loaded (lite)", { records });

  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load billable items (lite)", err);
  }
};
/* ============================================================
   📌 BULK UPDATE BILLABLE ITEMS (MASTER PARITY – FINAL)
   - Role scoped
   - Enum safe
   - Price history preserved
   - Transaction atomic
============================================================ */
export const bulkUpdateBillableItems = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    if (!Array.isArray(req.body) || req.body.length === 0) {
      await t.rollback();
      return error(res, "Payload must be a non-empty array", null, 400);
    }

    const updated = [];
    const skipped = [];

    for (const payload of req.body) {
      if (!payload.id) {
        skipped.push({ reason: "Missing id", payload });
        continue;
      }

      /* ================= VALIDATION ================= */
      const { value, errors } = validate(
        buildBillableItemSchema(req.user, "update"),
        payload
      );

      if (errors) {
        skipped.push({
          id: payload.id,
          reason: "Validation failed",
          errors,
        });
        continue;
      }

      /* ================= LOAD RECORD ================= */
      const where = { id: payload.id };
      if (!isSuperAdmin(req.user)) {
        where.organization_id = req.user.organization_id;
        if (isFacilityHead(req.user)) {
          where.facility_id = req.user.facility_id;
        }
      }

      const item = await BillableItem.findOne({ where, transaction: t });
      if (!item) {
        skipped.push({ id: payload.id, reason: "Not found or out of scope" });
        continue;
      }

      /* ================= SNAPSHOT (PRICE HISTORY) ================= */
      const oldPrice = item.price;
      const oldCurrency = item.currency;

      /* ================= ORG / FACILITY ================= */
      const { orgId, facilityId } = resolveOrgFacility({
        user: req.user,
        value,
        body: payload,
      });

      /* ================= UPDATE ================= */
      await item.update(
        {
          ...value,
          organization_id: orgId,
          facility_id: facilityId,
          updated_by_id: req.user?.id || null,
        },
        { transaction: t }
      );

      /* ================= PRICE HISTORY (ONLY IF CHANGED) ================= */
      if (
        value.price !== undefined &&
        (value.price !== oldPrice || value.currency !== oldCurrency)
      ) {
        await BillableItemPriceHistory.create(
          {
            billable_item_id: item.id,
            organization_id: orgId,
            facility_id: facilityId,
            old_price: oldPrice,
            new_price: value.price,
            old_currency: oldCurrency,
            new_currency: value.currency,
            effective_date: new Date(),
            created_by_id: req.user?.id || null,
          },
          { transaction: t }
        );
      }

      updated.push(item.id);
    }

    await t.commit();

    /* ================= RELOAD FULL ================= */
    const full = updated.length
      ? await BillableItem.findAll({
          where: { id: { [Op.in]: updated } },
          include: BILLABLE_ITEM_INCLUDES,
        })
      : [];

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "bulk_update",
      details: {
        updated: updated.length,
        skipped: skipped.length,
      },
    });

    return success(res, {
      message: `✅ ${updated.length} updated, ⚠️ ${skipped.length} skipped`,
      records: full,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    debug.error("bulk_update → FAILED", err);
    return error(res, "❌ Failed to bulk update billable items", err);
  }
};


/* ============================================================
   📌 TOGGLE BILLABLE ITEM STATUS (ENUM SAFE, AUDIT SAFE)
============================================================ */
export const toggleBillableItemStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    /* ================= TENANT SCOPE ================= */
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

    const item = await BillableItem.findOne({ where });
    if (!item) {
      return error(res, "❌ Billable Item not found", null, 404);
    }

    /* ================= STATUS TOGGLE ================= */
    const { ACTIVE, INACTIVE } = BILLABLE_ITEM_STATUS;

    const previousStatus = item.status;
    const newStatus =
      previousStatus === ACTIVE ? INACTIVE : ACTIVE;

    await item.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    /* ================= RELOAD FULL ================= */
    const full = await BillableItem.findOne({
      where: { id },
      include: BILLABLE_ITEM_INCLUDES,
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: {
        from: previousStatus,
        to: newStatus,
      },
    });

    return success(
      res,
      `✅ Billable Item status set to ${newStatus}`,
      full
    );
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle billable item status", err);
  }
};

/* ============================================================
   📌 RESTORE BILLABLE ITEM (MASTER PARITY)
============================================================ */
export const restoreBillableItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
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
    }

    const item = await BillableItem.findOne({
      where,
      paranoid: false,
      transaction: t,
    });

    if (!item) {
      await t.rollback();
      return error(res, "❌ Billable Item not found", null, 404);
    }

    if (!item.deleted_at) {
      await t.rollback();
      return error(res, "Item is not deleted", null, 400);
    }

    await item.restore({ transaction: t });
    await item.update(
      {
        updated_by_id: req.user?.id || null,
        deleted_by_id: null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await BillableItem.findOne({
      where: { id },
      include: BILLABLE_ITEM_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Billable Item restored", full);
  } catch (err) {
    await t.rollback();
    debug.error("restore → FAILED", err);
    return error(res, "❌ Failed to restore billable item", err);
  }
};

/* ============================================================
   📌 BULK DELETE BILLABLE ITEMS (MASTER PARITY)
============================================================ */
export const bulkDeleteBillableItems = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    if (!Array.isArray(req.body) || req.body.length === 0) {
      await t.rollback();
      return error(res, "Payload must be a non-empty array of IDs", null, 400);
    }

    const deleted = [];
    const skipped = [];

    for (const id of req.body) {
      const where = { id };

      if (!isSuperAdmin(req.user)) {
        where.organization_id = req.user.organization_id;
        if (isFacilityHead(req.user)) {
          where.facility_id = req.user.facility_id;
        }
      }

      const item = await BillableItem.findOne({
        where,
        transaction: t,
      });

      if (!item) {
        skipped.push({ id, reason: "Not found or out of scope" });
        continue;
      }

      await item.update(
        { deleted_by_id: req.user?.id || null },
        { transaction: t }
      );
      await item.destroy({ transaction: t });

      deleted.push(id);
    }

    await t.commit();

    const full = deleted.length
      ? await BillableItem.findAll({
          where: { id: { [Op.in]: deleted } },
          include: BILLABLE_ITEM_INCLUDES,
          paranoid: false,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "bulk_delete",
      details: {
        deleted: deleted.length,
        skipped: skipped.length,
        ids: req.body,
      },
    });

    return success(res, {
      message: `✅ ${deleted.length} deleted, ⚠️ ${skipped.length} skipped`,
      records: full,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    debug.error("bulk_delete → FAILED", err);
    return error(res, "❌ Failed to bulk delete billable items", err);
  }
};



/* ============================================================
   📌 DELETE BILLABLE ITEM (MASTER PARITY)
============================================================ */
export const deleteBillableItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
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
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const item = await BillableItem.findOne({ where, transaction: t });
    if (!item) {
      await t.rollback();
      return error(res, "❌ Billable Item not found", null, 404);
    }

    await item.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await item.destroy({ transaction: t });

    await t.commit();

    const full = await BillableItem.findOne({
      where: { id },
      include: BILLABLE_ITEM_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Billable Item deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete billable item", err);
  }
};

/* ============================================================
   📌 GET PRICE HISTORY BY BILLABLE ITEM ID (MASTER PARITY)
============================================================ */
export const getHistoryByBillableItemId = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { billable_item_id: id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const histories = await BillableItemPriceHistory.findAll({
      where,
      include: [
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
      order: [["effective_date", "DESC"]],
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_history",
      entityId: id,
      details: { count: histories.length },
    });

    return success(res, "✅ Billable Item price history loaded", {
      records: histories,
    });
  } catch (err) {
    debug.error("list_history → FAILED", err);
    return error(res, "❌ Failed to load billable item history", err);
  }
};
