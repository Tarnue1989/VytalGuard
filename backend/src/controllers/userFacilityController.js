// 📁 controllers/userFacilityController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  UserFacility,
  User,
  Facility,
  Role,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { USER_FACILITY_STATUS } from "../constants/enums.js";
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
import { buildDynamicSummary } from "../utils/summaryHelper.js";

const MODULE_KEY = "userFacility";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("userFacilityController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const USER_FACILITY_INCLUDES = [
  {
    model: User,
    as: "user",
    attributes: [
      "id",
      "username",
      "email",
      "first_name",
      "last_name",
      "full_name",
    ],
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
  },
  {
    model: Role,
    as: "role",
    attributes: ["id", "name"],
  },
];

/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA
============================================================ */
function buildUserFacilitySchema(mode = "create") {
  const base = {
    user_id: Joi.string().uuid().required(),
    facility_id: Joi.string().uuid().required(),
    role_id: Joi.string().uuid().allow("", null),
    is_default: Joi.boolean().default(false),
    is_active: Joi.string()
      .valid(...USER_FACILITY_STATUS)
      .default(USER_FACILITY_STATUS[0]),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    delete base.user_id;
    delete base.facility_id;
  }

  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL USER-FACILITIES (MASTER PARITY + SUMMARY)
============================================================ */
export const getAllUserFacilities = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const options = buildQueryOptions(req, "created_at", "DESC");

    /* UI-only filter stripping */
    delete options.filters?.dateRange;
    delete options.filters?.light;

    options.where = { [Op.and]: [] };

    /* Date range */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* Scope enforcement */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        "$facility.organization_id$": req.user.organization_id,
      });

      if (!isOrgLevelUser(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    } else {
      if (req.query.organization_id) {
        options.where[Op.and].push({
          "$facility.organization_id$": req.query.organization_id,
        });
      }
      if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    }

    /* Global search */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { "$user.username$": { [Op.iLike]: `%${options.search}%` } },
          { "$user.email$": { [Op.iLike]: `%${options.search}%` } },
          { "$user.first_name$": { [Op.iLike]: `%${options.search}%` } },
          { "$user.last_name$": { [Op.iLike]: `%${options.search}%` } },
          { "$facility.name$": { [Op.iLike]: `%${options.search}%` } },
          { "$facility.code$": { [Op.iLike]: `%${options.search}%` } },
          { "$role.name$": { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    if (
      req.query.is_active &&
      USER_FACILITY_STATUS.includes(req.query.is_active)
    ) {
      options.where[Op.and].push({
        is_active: req.query.is_active,
      });
    }

    const { count, rows } = await UserFacility.findAndCountAll({
      where: options.where,
      include: USER_FACILITY_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    const summary = buildDynamicSummary(rows, {
      total: () => count,
      active: (r) => r.is_active === USER_FACILITY_STATUS[0],
      inactive: (r) => r.is_active === USER_FACILITY_STATUS[1],
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ User-Facilities loaded", {
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
    return error(res, "❌ Failed to load user-facilities", err);
  }
};

/* ============================================================
   📌 GET USER-FACILITY BY ID
============================================================ */
export const getUserFacilityById = async (req, res) => {
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
      where["$facility.organization_id$"] = req.user.organization_id;
      if (!isOrgLevelUser(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const link = await UserFacility.findOne({
      where,
      include: USER_FACILITY_INCLUDES,
    });

    if (!link) {
      return error(res, "User-Facility link not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: link.id,
      entity: link,
    });

    return success(res, "✅ User-Facility loaded", link);
  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load user-facility", err);
  }
};

/* ============================================================
   📌 GET USER-FACILITIES LITE
============================================================ */
export const getUserFacilitiesLite = async (req, res) => {
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
      is_active: USER_FACILITY_STATUS[0],
      [Op.and]: [],
    };

    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        "$facility.organization_id$": req.user.organization_id,
      });
      if (!isOrgLevelUser(req.user)) {
        where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    }

    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { "$user.first_name$": { [Op.iLike]: `%${q}%` } },
          { "$user.last_name$": { [Op.iLike]: `%${q}%` } },
          { "$user.username$": { [Op.iLike]: `%${q}%` } },
          { "$user.email$": { [Op.iLike]: `%${q}%` } },
          { "$facility.name$": { [Op.iLike]: `%${q}%` } },
          { "$role.name$": { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    const records = await UserFacility.findAll({
      where,
      include: USER_FACILITY_INCLUDES,
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { q: q || null, count: records.length },
    });

    return success(res, "✅ User-Facilities loaded (lite)", {
      records,
    });
  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load user-facilities (lite)", err);
  }
};

/* ============================================================
   📌 CREATE USER-FACILITY
============================================================ */
export const createUserFacility = async (req, res) => {
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
      buildUserFacilitySchema("create"),
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

    if (!facilityId) {
      await t.rollback();
      return error(res, "Missing facility assignment", null, 400);
    }

    const exists = await UserFacility.findOne({
      where: {
        user_id: value.user_id,
        facility_id: facilityId,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "User already linked to this facility", null, 400);
    }

    if (value.is_default) {
      await UserFacility.update(
        { is_default: false },
        { where: { user_id: value.user_id }, transaction: t }
      );
    }

    const created = await UserFacility.create(
      {
        ...value,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: created,
      details: value,
    });

    return success(res, "✅ User-Facility created", created);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create user-facility", err);
  }
};

/* ============================================================
   📌 UPDATE USER-FACILITY
============================================================ */
export const updateUserFacility = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildUserFacilitySchema("update"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where["$facility.organization_id$"] = req.user.organization_id;
      if (!isOrgLevelUser(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const link = await UserFacility.findOne({
      where,
      include: [{ model: Facility, as: "facility" }],
      transaction: t,
    });

    if (!link) {
      await t.rollback();
      return error(res, "User-Facility link not found", null, 404);
    }

    if (value.is_default) {
      await UserFacility.update(
        { is_default: false },
        {
          where: { user_id: link.user_id, id: { [Op.ne]: link.id } },
          transaction: t,
        }
      );
    }

    await link.update(
      { ...value, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: link.id,
      entity: link,
      details: value,
    });

    return success(res, "✅ User-Facility updated", link);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update user-facility", err);
  }
};

/* ============================================================
   📌 DELETE USER-FACILITY
============================================================ */
export const deleteUserFacility = async (req, res) => {
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
      where["$facility.organization_id$"] = req.user.organization_id;
      if (!isOrgLevelUser(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const link = await UserFacility.findOne({
      where,
      include: [{ model: Facility, as: "facility" }],
      transaction: t,
    });

    if (!link) {
      await t.rollback();
      return error(res, "User-Facility link not found", null, 404);
    }

    await link.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await link.destroy({ transaction: t });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: link.id,
      entity: link,
    });

    return success(res, "✅ User-Facility deleted");
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete user-facility", err);
  }
};

/* ============================================================
   📌 TOGGLE USER-FACILITY STATUS
============================================================ */
export const toggleUserFacilityStatus = async (req, res) => {
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
      where["$facility.organization_id$"] = req.user.organization_id;
      if (!isOrgLevelUser(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const link = await UserFacility.findOne({
      where,
      include: [{ model: Facility, as: "facility" }],
    });

    if (!link) {
      return error(res, "User-Facility link not found", null, 404);
    }

    const [ACTIVE, INACTIVE] = USER_FACILITY_STATUS;
    const newStatus = link.is_active === ACTIVE ? INACTIVE : ACTIVE;

    await link.update({
      is_active: newStatus,
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: link.id,
      entity: link,
      details: { from: link.is_active, to: newStatus },
    });

    return success(res, `✅ User-Facility ${newStatus}`, {
      is_active: newStatus,
    });
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle user-facility status", err);
  }
};
