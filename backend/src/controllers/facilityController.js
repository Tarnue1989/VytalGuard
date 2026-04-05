// 📁 controllers/facilityController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Facility,
  Organization,
  User,
  Department,
  Employee,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { FACILITY_STATUS } from "../constants/enums.js";
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
import { resolveTenantScopeLite } from "../utils/resolveTenantScopeLite.js";

const MODULE_KEY = "facilities";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("facilityController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const FACILITY_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: true,
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
function buildFacilitySchema(userRole, mode = "create") {
  const base = {
    name: Joi.string().max(255).required(),
    code: Joi.string().max(50).required(), // ✅ org admins allowed
    address: Joi.string().allow("", null),
    phone: Joi.string().allow("", null),
    email: Joi.string().email().allow("", null),
    status: Joi.string()
      .valid(...Object.values(FACILITY_STATUS))
      .default(FACILITY_STATUS.ACTIVE)
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().required();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE FACILITY (MASTER PARITY — FIXED)
   ✔ No resolveOrgFacility
   ✔ Org resolved safely by role
============================================================ */
export const createFacility = async (req, res) => {
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
      buildFacilitySchema(
        isSuperAdmin(req.user) ? "superadmin" : "org_user",
        "create"
      ),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    /* ============================================================
       🧭 ORGANIZATION RESOLUTION (MASTER SAFE)
       🚫 DO NOT USE resolveOrgFacility HERE
    ============================================================ */
    let orgId = null;

    if (isSuperAdmin(req.user)) {
      // Super Admin must send organization_id
      orgId = value.organization_id;
    } else {
      // Org users inherit from session
      orgId = req.user.organization_id;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "❌ Organization is required", null, 400);
    }

    /* ============================================================
       🔒 DUPLICATE CHECK (ORG + CODE)
    ============================================================ */
    const exists = await Facility.findOne({
      where: {
        code: value.code,
        organization_id: orgId,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "❌ Facility code already exists", null, 400);
    }

    /* ============================================================
       🏗️ CREATE
    ============================================================ */
    const created = await Facility.create(
      {
        ...value,
        organization_id: orgId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    /* ============================================================
       📦 LOAD FULL RECORD
    ============================================================ */
    const full = await Facility.findOne({
      where: { id: created.id },
      include: FACILITY_INCLUDES,
    });

    /* ============================================================
       🧾 AUDIT
    ============================================================ */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Facility created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create facility", err);
  }
};
/* ============================================================
   📌 UPDATE FACILITY (MASTER PARITY)
============================================================ */
export const updateFacility = async (req, res) => {
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
      buildFacilitySchema(
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
        where.id = req.user.facility_id;
      }
    }

    const facility = await Facility.findOne({ where, transaction: t });
    if (!facility) {
      await t.rollback();
      return error(res, "Facility not found", null, 404);
    }

    if (value.code) {
      const exists = await Facility.findOne({
        where: {
          code: value.code,
          organization_id: facility.organization_id,
          id: { [Op.ne]: facility.id },
        },
        paranoid: false,
        transaction: t,
      });


      if (exists) {
        await t.rollback();
        return error(res, "Facility code already in use", null, 400);
      }
    }

    await facility.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Facility.findOne({
      where: { id: facility.id },
      include: FACILITY_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: facility.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Facility updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update facility", err);
  }
};
/* ============================================================
   📌 GET FACILITY BY ID (MASTER PARITY)
============================================================ */
export const getFacilityById = async (req, res) => {
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
        where.id = req.user.facility_id;
      }
    }

    const facility = await Facility.findOne({
      where,
      include: FACILITY_INCLUDES,
    });

    if (!facility) {
      return error(res, "Facility not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: facility.id,
      entity: facility,
    });

    return success(res, "✅ Facility loaded", facility);
  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load facility", err);
  }
};

/* ============================================================
   📌 TOGGLE FACILITY STATUS (MASTER PARITY)
============================================================ */
export const toggleFacilityStatus = async (req, res) => {
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
        where.id = req.user.facility_id;
      }
    }

    const facility = await Facility.findOne({ where });
    if (!facility) {
      return error(res, "Facility not found", null, 404);
    }

    const { ACTIVE, INACTIVE } = FACILITY_STATUS;
    const newStatus = facility.status === ACTIVE ? INACTIVE : ACTIVE;

    await facility.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await Facility.findOne({
      where: { id: facility.id },
      include: FACILITY_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: facility.id,
      entity: full,
      details: { from: facility.status, to: newStatus },
    });

    return success(
      res,
      `✅ Facility status toggled to ${newStatus}`,
      full
    );
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle facility status", err);
  }
};

/* ============================================================
   📌 DELETE FACILITY (MASTER PARITY)
============================================================ */
export const deleteFacility = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    if (!isSuperAdmin(req.user)) {
      await t.rollback();
      return error(
        res,
        "❌ Only Super Admin can delete facilities",
        null,
        403
      );
    }

    const facility = await Facility.findOne({
      where: { id: req.params.id },
      transaction: t,
    });

    if (!facility) {
      await t.rollback();
      return error(res, "Facility not found", null, 404);
    }

    const linkedDepartments = await Department.count({
      where: { facility_id: facility.id },
      transaction: t,
    });
    const linkedEmployees = await Employee.count({
      where: { facility_id: facility.id },
      transaction: t,
    });

    if (linkedDepartments > 0 || linkedEmployees > 0) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot delete — facility has linked departments or employees",
        null,
        400
      );
    }

    await facility.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await facility.destroy({ transaction: t });
    await t.commit();

    const full = await Facility.findOne({
      where: { id: facility.id },
      include: FACILITY_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: facility.id,
      entity: full,
    });

    return success(res, "✅ Facility deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete facility", err);
  }
};

/* ============================================================
   📌 GET ALL FACILITIES (ROLE-MASTER PARITY + SUMMARY)
============================================================ */
export const getAllFacilities = async (req, res) => {
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
       📅 DATE RANGE (UI ONLY)
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
       🔐 TENANT SCOPE (MASTER)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgLevelUser(req.user)) {
        options.where[Op.and].push({
          id: req.user.facility_id,
        });
      }
    } else if (req.query.organization_id) {
      options.where[Op.and].push({
        organization_id: req.query.organization_id,
      });
    }

    /* ========================================================
       🔍 GLOBAL SEARCH
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { code: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       📌 STATUS FILTER (AUTHORITATIVE)
    ======================================================== */
    if (req.query.status && Object.values(FACILITY_STATUS).includes(req.query.status)) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       📦 QUERY
    ======================================================== */
    const { count, rows } = await Facility.findAndCountAll({
      where: options.where,
      include: FACILITY_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ========================================================
       📊 SUMMARY (PAGE-AWARE)
    ======================================================== */
    const summary = {
      total: count,
      active: rows.filter(r => r.status === FACILITY_STATUS.ACTIVE).length,
      inactive: rows.filter(r => r.status === FACILITY_STATUS.INACTIVE).length,
    };

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        query: req.query,
        returned: count,
        dateRange: dateRange || null,
      },
    });

    return success(res, "✅ Facilities loaded", {
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
    return error(res, "❌ Failed to load facilities", err);
  }
};


/* ============================================================
   📌 GET ALL FACILITIES LITE (FINAL SAFE)
============================================================ */
export const getAllFacilitiesLite = async (req, res) => {
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
      status: FACILITY_STATUS.ACTIVE,
      [Op.and]: [],
    };

    /* ========================================================
       🔐 TENANT SCOPE
    ======================================================== */
    const { orgId, facilityId } = resolveTenantScopeLite({
      user: req.user,
      query: req.query,
    });

    if (orgId) {
      where.organization_id = orgId;
    }

    /* ========================================================
       🔒 FACILITY RESTRICTION (🔥 FIXED)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      if (!isOrgLevelUser(req.user)) {

        if (facilityId) {
          where[Op.and].push({ id: facilityId });
        } else {
          // 🚨 FAIL CLOSED (VERY IMPORTANT)
          where[Op.and].push({ id: "__NO_MATCH__" });
        }

      }
    } else {
      if (facilityId) {
        where.id = facilityId;
      }
    }

    /* ========================================================
       🔍 SEARCH
    ======================================================== */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { code: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    /* ========================================================
       📦 QUERY
    ======================================================== */
    const facilities = await Facility.findAll({
      where,
      attributes: ["id", "name", "code", "organization_id"],
      include: [
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name"],
        },
      ],
      order: [["name", "ASC"]],
      limit: 100,
    });

    /* ========================================================
       🧠 LABEL
    ======================================================== */
    const records = facilities.map((f) => ({
      id: f.id,
      name: f.organization?.name
        ? `${f.name} (Org: ${f.organization.name})`
        : f.name,
      code: f.code || "",
      organization_id: f.organization_id,
    }));

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        q: q || null,
        count: records.length,
        orgId: orgId || null,
        facilityId: facilityId || null,
      },
    });

    return success(res, "✅ Facilities loaded (lite)", {
      records,
    });

  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load facilities (lite)", err);
  }
};