// 📁 controllers/insuranceProviderController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  InsuranceProvider,
  User,
  Facility,
  Organization,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { INSURANCE_PROVIDER_STATUS } from "../constants/enums.js";

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

const MODULE_KEY = "insurance_providers";

/* ============================================================
   🔧 DEBUG
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("insuranceProviderController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 INCLUDES
============================================================ */
const PROVIDER_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: false,
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
    required: false,
  },
  {
    model: User,
    as: "createdBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
  {
    model: User,
    as: "updatedBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
  {
    model: User,
    as: "deletedBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
];

/* ============================================================
   📋 JOI SCHEMA
============================================================ */
function buildSchema(isSuper, mode = "create") {
  const base = {
    name: Joi.string().max(150),
    contact_info: Joi.string().allow("", null),
    address: Joi.string().allow("", null),
    phone: Joi.string().allow("", null),
    email: Joi.string().email().allow("", null),
  };

  if (mode === "create") {
    base.name = base.name.required();
  } else {
    base.status = Joi.string()
      .valid(...Object.values(INSURANCE_PROVIDER_STATUS))
      .optional();

    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }

  if (isSuper) {
    base.organization_id = Joi.string().uuid().allow(null).optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  } else {
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE
============================================================ */
export const createInsuranceProvider = async (req, res) => {
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

    /* ========================================================
       🧭 SCOPE
    ======================================================== */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id ?? null;
      facilityId = value.facility_id ?? null;
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id ?? null;
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
       🚫 DUP CHECK
    ======================================================== */
    const exists = await InsuranceProvider.findOne({
      where: {
        organization_id: orgId,
        facility_id: facilityId ?? null,
        name: value.name,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "Provider already exists", null, 400);
    }

    /* ========================================================
       ✅ CREATE
    ======================================================== */
    const created = await InsuranceProvider.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await InsuranceProvider.findByPk(created.id, {
      include: PROVIDER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Insurance Provider created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create provider", err);
  }
};

/* ============================================================
   📌 UPDATE
============================================================ */
export const updateInsuranceProvider = async (req, res) => {
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

    const record = await InsuranceProvider.findByPk(req.params.id, {
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Provider not found", null, 404);
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

    const full = await InsuranceProvider.findByPk(record.id, {
      include: PROVIDER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Insurance Provider updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update provider", err);
  }
};

/* ============================================================
   📌 GET ALL INSURANCE PROVIDERS (MASTER PARITY + SUMMARY)
============================================================ */
export const getAllInsuranceProviders = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    debug.log("list → raw query", req.query);

    const options = buildQueryOptions(req, "name", "ASC");

    delete options.filters?.dateRange;
    delete options.filters?.light;

    options.where = { [Op.and]: [] };

    /* ================= DATE RANGE ================= */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* ================= TENANT ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgOwner(req.user)) {
        options.where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
        });
      }
    } else {
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

    /* ================= SEARCH ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { contact_info: { [Op.iLike]: `%${options.search}%` } },
          { email: { [Op.iLike]: `%${options.search}%` } },
          { phone: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ================= STATUS ================= */
    if (
      req.query.status &&
      Object.values(INSURANCE_PROVIDER_STATUS).includes(req.query.status)
    ) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ================= QUERY ================= */
    const { count, rows } = await InsuranceProvider.findAndCountAll({
      where: options.where,
      include: PROVIDER_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    const { ACTIVE, INACTIVE } = INSURANCE_PROVIDER_STATUS;

    const summary = {
      total: count,
      active: rows.filter(r => r.status === ACTIVE).length,
      inactive: rows.filter(r => r.status === INACTIVE).length,
    };

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

    return success(res, "✅ Insurance Providers loaded", {
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
    return error(res, "❌ Failed to load providers", err);
  }
};

/* ============================================================
   📌 GET BY ID
============================================================ */
export const getInsuranceProviderById = async (req, res) => {
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

    const found = await InsuranceProvider.findOne({
      where,
      include: PROVIDER_INCLUDES,
    });

    if (!found) return error(res, "❌ Provider not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: found,
    });

    return success(res, "✅ Insurance Provider loaded", found);
  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load provider", err);
  }
};

/* ============================================================
   📌 GET LITE (AUTOCOMPLETE)
============================================================ */
export const getAllInsuranceProvidersLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, organization_id, facility_id } = req.query;

    const where = {
      status: INSURANCE_PROVIDER_STATUS.ACTIVE,
      [Op.and]: [],
    };

    /* ================= TENANT ================= */
    if (organization_id && /^[0-9a-f-]{36}$/i.test(organization_id)) {
      where.organization_id = organization_id;
    } else if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        [Op.or]: [
          { facility_id: null },
          ...(facility_id && /^[0-9a-f-]{36}$/i.test(facility_id)
            ? [{ facility_id }]
            : []),
        ],
      });
    }

    /* ================= SEARCH ================= */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } },
          { phone: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    /* ================= QUERY ================= */
    const providers = await InsuranceProvider.findAll({
      where,
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
      limit: 50,
    });

    /* ================= FIXED SHAPE ================= */
    const result = providers.map((p) => ({
      id: p.id,
      label: p.name, // ⭐ REQUIRED FOR FRONTEND
    }));

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: result.length,
        q: q || null,
        organization_id: where.organization_id || null,
        facility_id: facility_id || null,
      },
    });

    /* ================= RESPONSE ================= */
    return success(res, "✅ Providers loaded (lite)", { records: result });
  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load providers (lite)", err);
  }
};
/* ============================================================
   📌 TOGGLE INSURANCE PROVIDER STATUS
============================================================ */
export const toggleInsuranceProviderStatus = async (req, res) => {
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

    const provider = await InsuranceProvider.findOne({ where });
    if (!provider) return error(res, "❌ Provider not found", null, 404);

    const { ACTIVE, INACTIVE } = INSURANCE_PROVIDER_STATUS;
    const previousStatus = provider.status;
    const newStatus = previousStatus === ACTIVE ? INACTIVE : ACTIVE;

    await provider.update({
      status: newStatus,
      updated_by_id: req.user.id,
    });

    const full = await InsuranceProvider.findOne({
      where: { id },
      include: PROVIDER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: previousStatus, to: newStatus },
    });

    return success(
      res,
      `✅ Insurance Provider status set to ${newStatus}`,
      full
    );
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle provider status", err);
  }
};

/* ============================================================
   📌 DELETE INSURANCE PROVIDER
   (MASTER-PARITY, SAFE SOFT DELETE + AUDIT)
============================================================ */
export const deleteInsuranceProvider = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("delete → incoming", {
      id: req.params.id,
      query: req.query,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    /* ================= SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) {
        where.organization_id = req.query.organization_id;
      }
      if (req.query.facility_id) {
        where.facility_id = req.query.facility_id;
      }
    }

    const provider = await InsuranceProvider.findOne({
      where,
      transaction: t,
    });

    if (!provider) {
      await t.rollback();
      return error(res, "❌ Provider not found", null, 404);
    }

    /* ================= SOFT DELETE ================= */
    await provider.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await provider.destroy({ transaction: t });
    await t.commit();

    const full = await InsuranceProvider.findOne({
      where: { id },
      include: PROVIDER_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Insurance Provider deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete provider", err);
  }
};