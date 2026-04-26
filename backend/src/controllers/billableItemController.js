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
import { getResolvedPrice } from "../utils/billable-utils.js";
import { PAYER_TYPES } from "../constants/enums.js";

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
  { model: MasterItemCategory, as: "category", attributes: ["id", "name", "code"],  },

  // 🔥 REQUIRED
  {
    model: BillableItemPrice,
    as: "prices",
    required: false,
    where: { effective_to: null },
  },

  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA (UPGRADED — MULTI-PRICE READY)
   🔥 FINAL (FRONTEND SAFE + ENTERPRISE)
============================================================ */
function buildBillableItemSchema(user, mode = "create") {
  const priceSchema = Joi.object({
    payer_type: Joi.string()
      .valid(...Object.values(PAYER_TYPES))
      .required(),
    price: Joi.number().precision(2).min(0).required(),
    currency: Joi.string().max(10).default("USD"),
    is_default: Joi.boolean().default(false),
  });

  const base = {
    master_item_id: Joi.string().uuid().required(),
    department_id: Joi.string().uuid().allow("", null),
    category_id: Joi.string().uuid().allow("", null),

    name: Joi.string().max(150).required(),
    code: Joi.string().max(100).allow("", null),
    description: Joi.string().allow("", null),

    /* ========================================================
       🔥 BACKWARD COMPAT (KEEP)
    ======================================================== */
    price: Joi.number().precision(2).min(0),
    currency: Joi.string().max(10).default("USD"),

    /* ========================================================
       🔥 NEW MULTI-PRICE SUPPORT
    ======================================================== */
    prices: Joi.array().items(priceSchema).min(1),

    taxable: Joi.boolean().default(false),
    discountable: Joi.boolean().default(true),
    override_allowed: Joi.boolean().default(true),

    /* ================= SYSTEM CONTROLLED ================= */
    status: Joi.any().strip(),
    organization_id: Joi.any().strip(),
    facility_id: Joi.any().strip(),
  };

  /* ========================================================
     🔓 SUPER ADMIN OVERRIDE
  ======================================================== */
  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  /* ========================================================
     🔥 REQUIRE ONE OF (price OR prices)
     🔥 ALLOW UNKNOWN (CRITICAL FIX)
  ======================================================== */
  let schema = Joi.object(base)
    .or("price", "prices")
    .unknown(true); // ✅ FIX: allow frontend extra fields

  /* ========================================================
     ✏️ UPDATE MODE
  ======================================================== */
  if (mode === "update") {
    const updatedBase = {};

    Object.keys(base).forEach((k) => {
      updatedBase[k] = base[k].optional();
    });

    schema = Joi.object(updatedBase).unknown(true); // ✅ FIX here too
  }

  return schema;
}
/* ============================================================
   📌 CREATE BILLABLE ITEM(S) (FINAL — MULTI-PRICE FIXED)
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

    const payloads = Array.isArray(req.body) ? req.body : [req.body];

    const created = [];
    const skipped = [];

    for (const raw of payloads) {
      const { value, errors } = validate(
        buildBillableItemSchema(req.user, "create"),
        raw
      );

      if (errors) {
        skipped.push({ reason: "Validation failed", errors });
        continue;
      }

      const { orgId, facilityId } = resolveOrgFacility({
        user: req.user,
        body: raw,
        value,
      });

      /* ========================================================
         🔹 CREATE MAIN ITEM
      ======================================================== */
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

      /* ========================================================
         🔥 MULTI-PRICE SUPPORT (FIXED)
      ======================================================== */
      if (value.prices && value.prices.length) {
        for (const p of value.prices) {
          await BillableItemPrice.create(
            {
              organization_id: orgId,
              facility_id: facilityId,
              billable_item_id: item.id,

              payer_type: p.payer_type,
              currency: p.currency || item.currency,
              price: p.price,
              is_default: p.is_default || false,

              created_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
        }
      } else {
        /* 🔁 BACKWARD COMPAT (OLD FORM SUPPORT) */
        await BillableItemPrice.create(
          {
            organization_id: orgId,
            facility_id: facilityId,
            billable_item_id: item.id,

            payer_type: PAYER_TYPES.CASH,
            currency: item.currency,
            price: item.price,
            is_default: true,

            created_by_id: req.user?.id || null,
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    const full = await BillableItem.findAll({
      where: { id: { [Op.in]: created.map((c) => c.id) } },
      include: BILLABLE_ITEM_INCLUDES,
    });

    return success(res, {
      message: `✅ ${created.length} created`,
      records: full,
      skipped,
    });

  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create billable item(s)", err);
  }
};

/* ============================================================
   ✏️ UPDATE BILLABLE ITEM (FINAL — MULTI-PRICE ENABLED)
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

    debug.log("update → incoming body", req.body);

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

    /* ========================================================
       🔄 UPDATE MAIN ITEM
    ======================================================== */
    await item.update(
      {
        ...value,
        organization_id: resolvedOrgId,
        facility_id: resolvedFacilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ========================================================
       🔥 MULTI-PRICE UPSERT (FINAL)
    ======================================================== */
    if (value.prices && value.prices.length) {
      for (const p of value.prices) {
        const currencyToUse = p.currency || item.currency;

        const existing = await BillableItemPrice.findOne({
          where: {
            billable_item_id: item.id,
            payer_type: p.payer_type,
            currency: currencyToUse,
          },
          transaction: t,
        });

        const active = await BillableItemPrice.findOne({
          where: {
            billable_item_id: item.id,
            payer_type: p.payer_type,
            effective_to: null,
          },
          transaction: t,
        });

        if (existing) {
          const priceChanged =
            Number(existing.price) !== Number(p.price);

          if (priceChanged || existing.effective_to !== null) {
            await existing.update(
              {
                price: p.price,
                effective_to: null,
                updated_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
          }

          if (active && active.id !== existing.id) {
            await active.update(
              {
                effective_to: new Date(),
                updated_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
          }

        } else {
          if (active) {
            await active.update(
              {
                effective_to: new Date(),
                updated_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
          }

          await BillableItemPrice.create(
            {
              organization_id: resolvedOrgId,
              facility_id: resolvedFacilityId,
              billable_item_id: item.id,

              payer_type: p.payer_type,
              currency: currencyToUse,
              price: p.price,
              is_default: p.is_default || false,

              created_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
        }
      }

    } else if (value.price !== undefined) {
      /* 🔁 BACKWARD COMPAT (CASH ONLY) */
      const currencyToUse = value.currency ?? item.currency;

      const existingSameCurrency = await BillableItemPrice.findOne({
        where: {
          billable_item_id: item.id,
          payer_type: PAYER_TYPES.CASH,
          currency: currencyToUse,
        },
        transaction: t,
      });

      const activePrice = await BillableItemPrice.findOne({
        where: {
          billable_item_id: item.id,
          payer_type: PAYER_TYPES.CASH,
          effective_to: null,
        },
        transaction: t,
      });

      if (existingSameCurrency) {
        const priceChanged =
          Number(existingSameCurrency.price) !== Number(value.price);

        if (priceChanged || existingSameCurrency.effective_to !== null) {
          await existingSameCurrency.update(
            {
              price: value.price,
              effective_to: null,
              updated_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
        }

        if (activePrice && activePrice.id !== existingSameCurrency.id) {
          await activePrice.update(
            {
              effective_to: new Date(),
              updated_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
        }

      } else {
        if (activePrice) {
          await activePrice.update(
            {
              effective_to: new Date(),
              updated_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
        }

        await BillableItemPrice.create(
          {
            organization_id: resolvedOrgId,
            facility_id: resolvedFacilityId,
            billable_item_id: item.id,

            payer_type: PAYER_TYPES.CASH,
            currency: currencyToUse,
            price: value.price,
            is_default: true,

            created_by_id: req.user?.id || null,
          },
          { transaction: t }
        );
      }
    }

    debug.log("update → after", item.toJSON());

    await t.commit();

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
   📌 GET ALL BILLABLE ITEMS (FINAL — ALL FILTERS FIXED)
   - ✅ Facility filter (no override)
   - ✅ Payer type filter (no forced CASH)
   - ✅ Currency filter (from pricing table)
   - ✅ Fully enterprise-safe
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

    const options = buildQueryOptions(req, "created_at", "DESC");

    delete options.filters?.dateRange;
    delete options.filters?.light;

    const baseWhere = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE
    ======================================================== */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      baseWhere[Op.and].push({
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* ========================================================
       🏢 TENANT + FACILITY
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      baseWhere[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (req.query.facility_id) {
        baseWhere[Op.and].push({
          facility_id: req.query.facility_id,
        });
      } else if (isFacilityHead(req.user)) {
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

    /* ========================================================
       📌 STATUS FILTER
    ======================================================== */
    if (
      req.query.status &&
      Object.values(BILLABLE_ITEM_STATUS).includes(req.query.status)
    ) {
      baseWhere[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       🔍 SEARCH
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

    const listWhere = {
      [Op.and]: [...baseWhere[Op.and], ...searchWhere],
    };

    /* ========================================================
       💰 INCLUDE (CURRENCY FILTER)
    ======================================================== */
    const includeWithCurrency = BILLABLE_ITEM_INCLUDES.map((inc) => {
      if (inc.as === "prices") {
        return {
          ...inc,
          required: !!req.query.currency,
          where: {
            effective_to: null,
            ...(req.query.currency && {
              currency: req.query.currency,
            }),
          },
        };
      }
      return inc;
    });

    const { count, rows } = await BillableItem.findAndCountAll({
      where: listWhere,
      include: includeWithCurrency,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
      subQuery: false,
    });

    /* ========================================================
       🔥 PAYER TYPE (FINAL FIX)
    ======================================================== */
    const payerType = req.query.payer_type;

    const records = rows
      .map((item) => {
        const resolved = getResolvedPrice(
          item,
          payerType || PAYER_TYPES.CASH,
          !!payerType // 🔥 STRICT MODE WHEN FILTERING
        );

        if (!resolved) return null;

        return {
          ...item.toJSON(),
          price: resolved.price,
          currency: resolved.currency,
        };
      })
      .filter((item) => item !== null);

    /* ========================================================
       📊 SUMMARY
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

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Billable Items loaded", {
      records,
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
   📌 GET BILLABLE ITEM BY ID (FIXED)
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

    const resolved = getResolvedPrice(item, req.query.payer_type || "cash");

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: item,
    });

    return success(res, "✅ Billable Item loaded", {
      ...item.toJSON(),
      price: resolved.price,
      currency: resolved.currency,
      priceHistory: history,
    });
  } catch (err) {
    debug.error("getById → FAILED", err);
    return error(res, "❌ Failed to load billable item", err);
  }
};

/* ============================================================
   📌 GET BILLABLE ITEMS LITE (FINAL — MASTER-CORRECT)
   🔹 Autocomplete / Dropdown READY
   🔹 Category from MasterItem ONLY (FIXED)
============================================================ */
/* ============================================================
   📌 GET BILLABLE ITEMS LITE (FINAL — COMPLETE FIX)
============================================================ */
export const getAllBillableItemsLite = async (req, res) => {
  try {
    console.log("\n==============================");
    console.log("📥 BACKEND HIT → /lite/billable-items");

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    debug.log("📥 QUERY RECEIVED →", req.query);

    /* ========================================================
       🧭 RESOLVE TENANT (🔥 FIXED — NEVER NULL)
    ======================================================== */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value: {},
      body: req.query,
    });

    const safeOrgId = orgId || req.user.organization_id;
    const safeFacilityId = facilityId || req.user.facility_id || null;

    if (!isSuperAdmin(req.user) && !safeOrgId) {
      return res.status(400).json({
        success: false,
        message: "❌ Missing organization context",
      });
    }

    console.log("🏢 TENANT →", {
      organization_id: safeOrgId,
      facility_id: safeFacilityId,
    });

    /* ========================================================
       🧱 BASE WHERE
    ======================================================== */
    const where = {
      status: BILLABLE_ITEM_STATUS.ACTIVE,
      [Op.and]: [],
    };

    /* ========================================================
       🏢 TENANT SCOPING
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({ organization_id: safeOrgId });

      if (safeFacilityId) {
        where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: safeFacilityId },
          ],
        });
      }
    } else {
      if (req.query.organization_id) {
        where[Op.and].push({
          organization_id: req.query.organization_id,
        });
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

    /* ========================================================
       🔍 SEARCH
    ======================================================== */
    const rawSearch = (req.query.q ?? req.query.search ?? "").toString();
    const search = rawSearch.trim();

    console.log("🔍 SEARCH →", search);

    if (search) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { code: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          { "$masterItem.name$": { [Op.iLike]: `%${search}%` } },
          { "$masterItem.category.name$": { [Op.iLike]: `%${search}%` } },
        ],
      });
    }

    /* ========================================================
       🔤 CODE FILTER
    ======================================================== */
    if (req.query.code) {
      where[Op.and].push({
        code: { [Op.iLike]: `%${req.query.code}%` },
      });
    }

    console.log("🧱 FINAL WHERE →", JSON.stringify(where, null, 2));

    /* ========================================================
       🧠 CATEGORY FILTER PARSE
    ======================================================== */
    let excludeCategory = req.query.exclude_category;

    if (typeof excludeCategory === "string") {
      try {
        excludeCategory = JSON.parse(excludeCategory);
      } catch {
        excludeCategory = excludeCategory
          .split(",")
          .map((v) => v.trim());
      }
    }

    const categoryParam = req.query.category;

    /* ========================================================
       🎯 BUILD CATEGORY WHERE
    ======================================================== */
    let categoryWhere = {};

    if (categoryParam && excludeCategory) {
      categoryWhere.code = {
        [Op.eq]: categoryParam,
        [Op.notIn]: excludeCategory,
      };
    } else if (categoryParam) {
      categoryWhere.code = categoryParam;
    } else if (excludeCategory) {
      categoryWhere.code = { [Op.notIn]: excludeCategory };
    }

    console.log("📂 CATEGORY FILTER →", categoryWhere);

    /* ========================================================
       🔗 INCLUDE (🔥 FIXED CATEGORY JOIN)
    ======================================================== */
    const include = [
      {
        model: MasterItem,
        as: "masterItem",
        attributes: ["id", "name", "code"],
        required: true,
        include: [
          {
            model: MasterItemCategory,
            as: "category",
            attributes: ["id", "name", "code"],
            ...(Object.keys(categoryWhere).length && {
              where: categoryWhere,
              required: true, // 🔥 FIX
            }),
          },
        ],
      },
      {
        model: BillableItemPrice,
        as: "prices",
        required: false,
        where: { effective_to: null },
      },
    ];

    /* ========================================================
       📦 QUERY
    ======================================================== */
    const items = await BillableItem.findAll({
      where,
      include,
      attributes: ["id", "name", "code"],
      order: [["name", "ASC"]],
      limit: Math.min(parseInt(req.query.limit) || 50, 100),
      subQuery: false,
    });

    console.log("📊 DB RESULT COUNT →", items.length);

    /* ========================================================
       🔄 FORMAT
    ======================================================== */
    const records = items.map((i) => {
      const resolved = getResolvedPrice(
        i,
        req.query.payer_type || "cash"
      );

      return {
        id: i.id,
        value: i.id,
        label: `${i.name}${i.code ? ` (${i.code})` : ""}`,

        name: i.name,
        code: i.code || "",

        price: resolved?.price ?? 0,
        currency: resolved?.currency ?? "USD",

        category: i.masterItem?.category
          ? {
              id: i.masterItem.category.id,
              name: i.masterItem.category.name,
              code: i.masterItem.category.code,
            }
          : null,
      };
    });

    console.log("📦 RESPONSE SAMPLE →", records.slice(0, 5));

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: records.length,
        search: search || null,
        category: req.query.category || null,
        exclude_category: excludeCategory || null,
        code: req.query.code || null,
      },
    });

    console.log("📤 SENDING RESPONSE");
    console.log("==============================\n");

    return success(res, "✅ Billable Items loaded (lite)", {
      records,
    });

  } catch (err) {
    console.error("❌ ERROR in getAllBillableItemsLite →", err);
    return error(res, "❌ Failed to load billable items (lite)", err);
  }
};
/* ============================================================
   📌 BULK UPDATE BILLABLE ITEMS (FINAL — MULTI-PRICE FIXED)
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

      const { orgId, facilityId } = resolveOrgFacility({
        user: req.user,
        value,
        body: payload,
      });

      /* ========================================================
         🔄 UPDATE MAIN ITEM
      ======================================================== */
      await item.update(
        {
          ...value,
          organization_id: orgId,
          facility_id: facilityId,
          updated_by_id: req.user?.id || null,
        },
        { transaction: t }
      );

      /* ========================================================
         🔥 MULTI-PRICE UPSERT (NEW FIX)
      ======================================================== */
      if (value.prices && value.prices.length) {
        for (const p of value.prices) {
          const currencyToUse = p.currency || item.currency;

          const existing = await BillableItemPrice.findOne({
            where: {
              billable_item_id: item.id,
              payer_type: p.payer_type,
              currency: currencyToUse,
            },
            transaction: t,
          });

          const active = await BillableItemPrice.findOne({
            where: {
              billable_item_id: item.id,
              payer_type: p.payer_type,
              effective_to: null,
            },
            transaction: t,
          });

          if (existing) {
            const priceChanged =
              Number(existing.price) !== Number(p.price);

            if (priceChanged || existing.effective_to !== null) {
              await existing.update(
                {
                  price: p.price,
                  effective_to: null,
                  updated_by_id: req.user?.id || null,
                },
                { transaction: t }
              );
            }

            if (active && active.id !== existing.id) {
              await active.update(
                {
                  effective_to: new Date(),
                  updated_by_id: req.user?.id || null,
                },
                { transaction: t }
              );
            }

          } else {
            if (active) {
              await active.update(
                {
                  effective_to: new Date(),
                  updated_by_id: req.user?.id || null,
                },
                { transaction: t }
              );
            }

            await BillableItemPrice.create(
              {
                organization_id: orgId,
                facility_id: facilityId,
                billable_item_id: item.id,

                payer_type: p.payer_type,
                currency: currencyToUse,
                price: p.price,
                is_default: p.is_default || false,

                created_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
          }
        }

      } else if (value.price !== undefined) {
        /* 🔁 BACKWARD COMPAT (CASH ONLY) */
        const currencyToUse = value.currency ?? item.currency;

        const existingSameCurrency = await BillableItemPrice.findOne({
          where: {
            billable_item_id: item.id,
            payer_type: PAYER_TYPES.CASH,
            currency: currencyToUse,
          },
          transaction: t,
        });

        const activePrice = await BillableItemPrice.findOne({
          where: {
            billable_item_id: item.id,
            payer_type: PAYER_TYPES.CASH,
            effective_to: null,
          },
          transaction: t,
        });

        if (existingSameCurrency) {
          const priceChanged =
            Number(existingSameCurrency.price) !== Number(value.price);

          if (priceChanged || existingSameCurrency.effective_to !== null) {
            await existingSameCurrency.update(
              {
                price: value.price,
                effective_to: null,
                updated_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
          }

          if (activePrice && activePrice.id !== existingSameCurrency.id) {
            await activePrice.update(
              {
                effective_to: new Date(),
                updated_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
          }

        } else {
          if (activePrice) {
            await activePrice.update(
              {
                effective_to: new Date(),
                updated_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
          }

          await BillableItemPrice.create(
            {
              organization_id: orgId,
              facility_id: facilityId,
              billable_item_id: item.id,

              payer_type: PAYER_TYPES.CASH,
              currency: currencyToUse,
              price: value.price,
              is_default: true,

              created_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
        }
      }

      updated.push(item.id);
    }

    await t.commit();

    const full = updated.length
      ? await BillableItem.findAll({
          where: { id: { [Op.in]: updated } },
          include: BILLABLE_ITEM_INCLUDES,
        })
      : [];

    const records = full.map((item) => {
      const resolved = getResolvedPrice(item, req.query.payer_type || "cash");
      return {
        ...item.toJSON(),
        price: resolved.price,
        currency: resolved.currency,
      };
    });

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
      records,
      skipped,
    });

  } catch (err) {
    await t.rollback();
    debug.error("bulk_update → FAILED", err);
    return error(res, "❌ Failed to bulk update billable items", err);
  }
};
/* ============================================================
   📌 TOGGLE BILLABLE ITEM STATUS (FIXED)
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

    const { ACTIVE, INACTIVE } = BILLABLE_ITEM_STATUS;

    const previousStatus = item.status;
    const newStatus =
      previousStatus === ACTIVE ? INACTIVE : ACTIVE;

    await item.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await BillableItem.findOne({
      where: { id },
      include: BILLABLE_ITEM_INCLUDES,
    });

    const resolved = getResolvedPrice(full, req.query.payer_type || "cash");

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
      {
        ...full.toJSON(),
        price: resolved.price,
        currency: resolved.currency,
      }
    );
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle billable item status", err);
  }
};

/* ============================================================
   📌 RESTORE BILLABLE ITEM (FIXED)
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

    const resolved = getResolvedPrice(full, req.query.payer_type || "cash");

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Billable Item restored", {
      ...full.toJSON(),
      price: resolved.price,
      currency: resolved.currency,
    });
  } catch (err) {
    await t.rollback();
    debug.error("restore → FAILED", err);
    return error(res, "❌ Failed to restore billable item", err);
  }
};

/* ============================================================
   📌 BULK DELETE BILLABLE ITEMS (FIXED)
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

    const records = full.map((item) => {
      const resolved = getResolvedPrice(item, req.query.payer_type || "cash");
      return {
        ...item.toJSON(),
        price: resolved.price,
        currency: resolved.currency,
      };
    });

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
      records,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    debug.error("bulk_delete → FAILED", err);
    return error(res, "❌ Failed to bulk delete billable items", err);
  }
};

/* ============================================================
   📌 DELETE BILLABLE ITEM (FIXED)
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

    const resolved = getResolvedPrice(full, req.query.payer_type || "cash");

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Billable Item deleted", {
      ...full.toJSON(),
      price: resolved.price,
      currency: resolved.currency,
    });
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete billable item", err);
  }
};

/* ============================================================
   📌 GET PRICE HISTORY BY BILLABLE ITEM ID (FINAL)
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

    const records = histories.map((h) => ({
      ...h.toJSON(),
      old_price: Number(h.old_price ?? 0),
      new_price: Number(h.new_price ?? 0),
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_history",
      entityId: id,
      details: { count: records.length },
    });

    return success(res, "✅ Billable Item price history loaded", {
      records,
    });
  } catch (err) {
    debug.error("list_history → FAILED", err);
    return error(res, "❌ Failed to load billable item history", err);
  }
};