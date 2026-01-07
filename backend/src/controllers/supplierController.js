// 📁 backend/src/controllers/supplierController.js
import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, Supplier, Facility, Organization, User } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { SUPPLIER_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_SUPPLIER } from "../constants/fieldVisibility.js";

/* ============================================================
   🧩 ENUM NORMALIZATION (Safe even if object-based)
============================================================ */
const SUPPLIER_STATUS_VALUES = Array.isArray(SUPPLIER_STATUS)
  ? SUPPLIER_STATUS
  : Object.values(SUPPLIER_STATUS || {});

const SS = {
  ACTIVE: SUPPLIER_STATUS_VALUES.find(v => v === "active") || SUPPLIER_STATUS_VALUES[0],
  INACTIVE: SUPPLIER_STATUS_VALUES.find(v => v === "inactive") || SUPPLIER_STATUS_VALUES[1],
};

/* ============================================================
   🔧 ROLE HELPER
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase()).includes("superadmin");
}

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const SUPPLIER_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (Deposit-Consistent)
   - Joi validates shape ONLY
   - Tenant & status enforced by controller
============================================================ */
function buildSupplierSchema(mode = "create") {
  const base = {
    name: Joi.string().max(150).required(),
    contact_name: Joi.string().allow("", null),
    contact_email: Joi.string().email().allow("", null),
    contact_phone: Joi.string().allow("", null),
    address: Joi.string().allow("", null),
    notes: Joi.string().allow("", null),

    // 🔒 lifecycle / service controlled
    status: Joi.forbidden(),

    // 🔑 allowed but NOT authoritative
    organization_id: Joi.string().uuid().optional(),
    facility_id: Joi.string().uuid().optional(),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   🧭 TENANT RESOLVER (Single Source of Truth)
============================================================ */
function resolveSupplierTenant({ user, role, value }) {
  let organization_id = user.organization_id || null;
  let facility_id = null;

  if (isSuperAdmin(user)) {
    organization_id = value.organization_id || null;
    facility_id = value.facility_id || null;
  } else if (role === "org_owner") {
    facility_id = value.facility_id || null;
  } else if (role === "admin") {
    facility_id = value.facility_id || user.facility_id || null;
  } else if (role === "facility_head") {
    facility_id = user.facility_id;
  } else {
    facility_id = user.facility_id || null;
  }

  if (!organization_id) {
    throw new Error("Missing organization assignment");
  }

  return { organization_id, facility_id };
}

/* ============================================================
   📌 CREATE SUPPLIER (Deposit-Consistent)
============================================================ */
export const createSupplier = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "supplier",
      action: "create",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildSupplierSchema("create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const { organization_id, facility_id } = resolveSupplierTenant({
      user: req.user,
      role,
      value,
    });

    const exists = await Supplier.findOne({
      where: { organization_id, facility_id, name: value.name },
      paranoid: false,
    });
    if (exists) {
      await t.rollback();
      return error(res, "Supplier already exists in this scope", null, 400);
    }

    const created = await Supplier.create(
      {
        ...value,
        organization_id,
        facility_id,
        status: SS.ACTIVE,
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
      module: "supplier",
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Supplier created", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create supplier", err);
  }
};

/* ============================================================
   📌 UPDATE SUPPLIER (No Tenant Movement)
============================================================ */
export const updateSupplier = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "supplier",
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildSupplierSchema("update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    const supplier = await Supplier.findOne({ where, transaction: t });
    if (!supplier) {
      await t.rollback();
      return error(res, "Supplier not found", null, 404);
    }

    // 🔒 prevent tenant movement (deposit rule)
    if (!isSuperAdmin(req.user)) {
      delete value.organization_id;
      delete value.facility_id;
    } else {
      const resolved = resolveSupplierTenant({
        user: req.user,
        role,
        value,
      });
      value.organization_id = resolved.organization_id;
      value.facility_id = resolved.facility_id;
    }

    const exists = await Supplier.findOne({
      where: {
        organization_id: supplier.organization_id,
        facility_id: supplier.facility_id,
        name: value.name,
        id: { [Op.ne]: id },
      },
      paranoid: false,
    });
    if (exists) {
      await t.rollback();
      return error(res, "Supplier name already in use in this scope", null, 400);
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
      where: { id },
      include: SUPPLIER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "supplier",
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Supplier updated", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update supplier", err);
  }
};

/* ============================================================
   📌 DELETE SUPPLIER (Soft Delete)
============================================================ */
export const deleteSupplier = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "supplier",
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const supplier = await Supplier.findOne({ where, transaction: t });
    if (!supplier) {
      await t.rollback();
      return error(res, "Supplier not found", null, 404);
    }

    await supplier.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await supplier.destroy({ transaction: t });
    await t.commit();

    const full = await Supplier.findOne({
      where: { id },
      include: SUPPLIER_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: "supplier",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Supplier deleted successfully", full);
  } catch (err) {
    await t.rollback();
    console.error("❌ Supplier delete error:", err);
    return error(res, "❌ Failed to delete supplier", err);
  }
};

/* ============================================================
   📌 TOGGLE SUPPLIER STATUS (Active ↔ Inactive)
============================================================ */
export const toggleSupplierStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "supplier",
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const supplier = await Supplier.findOne({ where });
    if (!supplier) return error(res, "Supplier not found", null, 404);

    const SUPPLIER_STATUS_VALUES = Array.isArray(SUPPLIER_STATUS)
      ? SUPPLIER_STATUS
      : Object.values(SUPPLIER_STATUS || {});

    const [ACTIVE, INACTIVE] = SUPPLIER_STATUS_VALUES;
    const newStatus = supplier.status === ACTIVE ? INACTIVE : ACTIVE;

    await supplier.update({ status: newStatus, updated_by_id: req.user?.id || null });

    const full = await Supplier.findOne({ where: { id }, include: SUPPLIER_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "supplier",
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: supplier.status, to: newStatus },
    });

    return success(res, `✅ Supplier status set to ${newStatus}`, full);
  } catch (err) {
    console.error("❌ Toggle supplier status error:", err);
    return error(res, "❌ Failed to toggle supplier status", err);
  }
};

/* ============================================================
   📌 GET ALL SUPPLIERS (Paginated)
============================================================ */
export const getAllSuppliers = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "supplier",
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_SUPPLIER[role] || FIELD_VISIBILITY_SUPPLIER.staff;

    const options = buildQueryOptions(req, "name", "ASC", visibleFields);

    // 🔒 Scope by role
    if (!isSuperAdmin(req.user)) {
      options.where = {
        ...(options.where || {}),
        organization_id: req.user.organization_id,
      };
      if (role === "facility_head") options.where.facility_id = req.user.facility_id;
    }

    // 🧭 Global (UUID search)
    if (req.query.global) {
      options.where = { ...(options.where || {}), id: req.query.global };
    }

    // 🔎 Text search
    if (options.search && !req.query.global) {
      options.where[Op.or] = [
        { name: { [Op.iLike]: `%${options.search}%` } },
        { contact_name: { [Op.iLike]: `%${options.search}%` } },
        { contact_email: { [Op.iLike]: `%${options.search}%` } },
        { contact_phone: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const { count, rows } = await Supplier.findAndCountAll({
      where: options.where,
      attributes: options.attributes
        ? [...new Set(["id", "created_at", "updated_at", ...options.attributes])]
        : undefined,
      include: [...SUPPLIER_INCLUDES, ...(options.include || [])],
      order: options.order?.length ? options.order : [["name", "ASC"]],
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "supplier",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Suppliers loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    console.error("❌ Load suppliers error:", err);
    return error(res, "❌ Failed to load suppliers", err);
  }
};

/* ============================================================
   📌 GET SUPPLIER BY ID
============================================================ */
export const getSupplierById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "supplier",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const supplier = await Supplier.findOne({ where, include: SUPPLIER_INCLUDES });
    if (!supplier) return error(res, "❌ Supplier not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "supplier",
      action: "view",
      entityId: id,
      entity: supplier,
    });

    return success(res, "✅ Supplier loaded", supplier);
  } catch (err) {
    console.error("❌ Load supplier error:", err);
    return error(res, "❌ Failed to load supplier", err);
  }
};

/* ============================================================
   📌 GET ALL SUPPLIERS (Lite / Autocomplete)
============================================================ */
export const getAllSuppliersLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "supplier",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const SUPPLIER_STATUS_VALUES = Array.isArray(SUPPLIER_STATUS)
      ? SUPPLIER_STATUS
      : Object.values(SUPPLIER_STATUS || {});
    const ACTIVE = SUPPLIER_STATUS_VALUES.find(v => v === "active") || "active";

    const where = { deleted_at: null, status: ACTIVE };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { contact_name: { [Op.iLike]: `%${q}%` } },
        { contact_email: { [Op.iLike]: `%${q}%` } },
        { contact_phone: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const suppliers = await Supplier.findAll({
      where,
      attributes: ["id", "name", "contact_name", "contact_email", "contact_phone"],
      order: [["name", "ASC"]],
      limit: 20,
    });

    const result = suppliers.map(s => ({
      id: s.id,
      name: s.name,
      label: s.contact_name ? `${s.name} (${s.contact_name})` : s.name,
      contact_email: s.contact_email || "",
      contact_phone: s.contact_phone || "",
    }));

    await auditService.logAction({
      user: req.user,
      module: "supplier",
      action: "list_lite",
      details: { query: q || null, count: result.length },
    });

    return success(res, "✅ Suppliers loaded (lite)", { records: result });
  } catch (err) {
    console.error("❌ Load suppliers (lite) error:", err);
    return error(res, "❌ Failed to load suppliers (lite)", err);
  }
};
