// 📁 controllers/supplierController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Supplier,
  Organization,
  Facility,
  User,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { SUPPLIER_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { validate } from "../utils/validation.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";

const MODULE_KEY = "supplier";
/* ============================================================
   🧩 ENUM NORMALIZATION (SAFE)
============================================================ */
const SUPPLIER_STATUS_VALUES = Array.isArray(SUPPLIER_STATUS)
  ? SUPPLIER_STATUS
  : Object.values(SUPPLIER_STATUS || {});

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("supplierController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const SUPPLIER_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: true,
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
  },
  {
    model: User,
    as: "updatedBy",
    attributes: ["id", "first_name", "last_name"],
  },
  {
    model: User,
    as: "deletedBy",
    attributes: ["id", "first_name", "last_name"],
  },
];

/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA (MASTER PARITY)
============================================================ */
function buildSupplierSchema(userRole, mode = "create") {
  const base = {
    name: Joi.string().max(150).required(),
    contact_name: Joi.string().allow("", null),
    contact_email: Joi.string().email().allow("", null),
    contact_phone: Joi.string().allow("", null),
    address: Joi.string().allow("", null),
    notes: Joi.string().allow("", null),
    status: Joi.string()
      .valid(...SUPPLIER_STATUS_VALUES)
      .default(SUPPLIER_STATUS_VALUES[0]),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().required();
    base.facility_id = Joi.string().uuid().optional();
  }

  if (userRole !== "superadmin") {
    base.organization_id = Joi.forbidden();
    base.facility_id = Joi.forbidden();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE SUPPLIER (MASTER PARITY)
============================================================ */
export const createSupplier = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildSupplierSchema(
        isSuperAdmin(req.user) ? "superadmin" : "org_user",
        "create"
      ),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    const exists = await Supplier.findOne({
      where: {
        name: value.name,
        organization_id: orgId,
        facility_id: facilityId || null,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "Supplier already exists", null, 400);
    }

    const created = await Supplier.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId || null,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Supplier.findOne({
      where: { id: created.id },
      include: SUPPLIER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Supplier created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create supplier", err);
  }
};

/* ============================================================
   📌 UPDATE SUPPLIER (MASTER PARITY)
============================================================ */
export const updateSupplier = async (req, res) => {
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

    const { value, errors } = validate(
      buildSupplierSchema(
        isSuperAdmin(req.user) ? "superadmin" : "org_user",
        "update"
      ),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const supplier = await Supplier.findOne({ where, transaction: t });
    if (!supplier) {
      await t.rollback();
      return error(res, "Supplier not found", null, 404);
    }

    if (value.name) {
      const exists = await Supplier.findOne({
        where: {
          name: value.name,
          organization_id: supplier.organization_id,
          facility_id: supplier.facility_id,
          id: { [Op.ne]: supplier.id },
        },
        paranoid: false,
        transaction: t,
      });

      if (exists) {
        await t.rollback();
        return error(res, "Supplier name already in use", null, 400);
      }
    }

    await supplier.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Supplier.findOne({
      where: { id: supplier.id },
      include: SUPPLIER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: supplier.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Supplier updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update supplier", err);
  }
};

/* ============================================================
   📌 GET SUPPLIER BY ID (MASTER PARITY)
============================================================ */
export const getSupplierById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (!isOrgLevelUser(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const supplier = await Supplier.findOne({
      where,
      include: SUPPLIER_INCLUDES,
    });

    if (!supplier) {
      return error(res, "Supplier not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: supplier.id,
      entity: supplier,
    });

    return success(res, "✅ Supplier loaded", supplier);
  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load supplier", err);
  }
};

/* ============================================================
   📌 TOGGLE SUPPLIER STATUS (MASTER PARITY)
============================================================ */
export const toggleSupplierStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const supplier = await Supplier.findOne({ where });
    if (!supplier) {
      return error(res, "Supplier not found", null, 404);
    }

    // ✅ FIXED LINE
    const [ACTIVE, INACTIVE] = SUPPLIER_STATUS_VALUES;

    const newStatus = supplier.status === ACTIVE ? INACTIVE : ACTIVE;

    await supplier.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await Supplier.findOne({
      where: { id: supplier.id },
      include: SUPPLIER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: supplier.id,
      entity: full,
      details: { from: supplier.status, to: newStatus },
    });

    return success(
      res,
      `✅ Supplier status toggled to ${newStatus}`,
      full
    );
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle supplier status", err);
  }
};

/* ============================================================
   📌 DELETE SUPPLIER (MASTER PARITY)
============================================================ */
export const deleteSupplier = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const supplier = await Supplier.findOne({ where, transaction: t });
    if (!supplier) {
      await t.rollback();
      return error(res, "Supplier not found", null, 404);
    }

    await supplier.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await supplier.destroy({ transaction: t });
    await t.commit();

    const full = await Supplier.findOne({
      where: { id: supplier.id },
      include: SUPPLIER_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: supplier.id,
      entity: full,
    });

    return success(res, "✅ Supplier deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete supplier", err);
  }
};

/* ============================================================
   📌 GET ALL SUPPLIERS (MASTER PARITY + SUMMARY)
============================================================ */
export const getAllSuppliers = async (req, res) => {
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
    const options = buildQueryOptions(req, "name", "ASC");

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
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* ========================================================
       🔐 TENANT SCOPE (MASTER – FIXED)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgLevelUser(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
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

    /* ========================================================
       🔍 GLOBAL SEARCH (MASTER)
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { contact_name: { [Op.iLike]: `%${options.search}%` } },
          { contact_email: { [Op.iLike]: `%${options.search}%` } },
          { contact_phone: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       📌 STATUS FILTER (ENUM SAFE)
    ======================================================== */
    if (
      req.query.status &&
      SUPPLIER_STATUS_VALUES.includes(req.query.status)
    ) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       🗂️ QUERY EXECUTION
    ======================================================== */
    const { count, rows } = await Supplier.findAndCountAll({
      where: options.where,
      include: SUPPLIER_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ========================================================
       📊 SUMMARY (MASTER PARITY)
    ======================================================== */
    const [ACTIVE, INACTIVE] = SUPPLIER_STATUS_VALUES;

    const summary = {
      total: count,
      active: rows.filter(r => r.status === ACTIVE).length,
      inactive: rows.filter(r => r.status === INACTIVE).length,
    };

    /* ========================================================
       🧾 AUDIT LOG
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "✅ Suppliers loaded", {
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
    return error(res, "❌ Failed to load suppliers", err);
  }
};

/* ============================================================
   📌 GET ALL SUPPLIERS LITE (MASTER PARITY)
============================================================ */
export const getAllSuppliersLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    /* ========================================================
       🧱 WHERE ROOT (SAFE)
    ======================================================== */
    const where = { [Op.and]: [] };

    /* ========================================================
       📌 STATUS FILTER (ENUM-SAFE)
    ======================================================== */
    if (SUPPLIER_STATUS_VALUES.length) {
      where[Op.and].push({
        status: SUPPLIER_STATUS_VALUES[0],
      });
    }

    /* ========================================================
       🔐 TENANT SCOPE (MASTER)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgLevelUser(req.user)) {
        where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    }

    /* ========================================================
       🔍 SEARCH
    ======================================================== */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { contact_name: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    const suppliers = await Supplier.findAll({
      where,
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
      limit: 20,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { q: q || null, count: suppliers.length },
    });

    return success(res, "✅ Suppliers loaded (lite)", {
      records: suppliers,
    });
  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load suppliers (lite)", err);
  }
};
