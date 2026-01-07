// 📁 controllers/recommendationController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Recommendation,
  Patient,
  Employee,
  Department,
  Consultation,
  Organization,
  Facility,
  User,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { RECOMMENDATION_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_RECOMMENDATION } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";

// 🔖 Local enum map
const RS = {
  PENDING: RECOMMENDATION_STATUS[0],
  CONFIRMED: RECOMMENDATION_STATUS[1],
  DECLINED: RECOMMENDATION_STATUS[2],
  VOIDED: RECOMMENDATION_STATUS[3],
};

const MODULE_KEY = "recommendation";

/* ============================================================
   🔧 HELPERS
   ============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase()).includes("superadmin");
}

/* ============================================================
   🔗 SHARED INCLUDES
   ============================================================ */
const RECOMMENDATION_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name", "code"] },
  { model: Consultation, as: "consultation", attributes: ["id", "status", "diagnosis"] },
  { model: Consultation, as: "linkedConsultation", attributes: ["id", "status"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
   ============================================================ */
function buildRecommendationSchema(mode = "create") {
  const base = {
    consultation_id: Joi.string().uuid().allow(null, ""), // 🔒 auto-linked in backend if context exists
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().allow(null, ""), // optional → fallback to req.user.employee_id
    department_id: Joi.string().uuid().allow(null, ""),
    organization_id: Joi.string().uuid().allow(null, ""),  // ✅ added
    facility_id: Joi.string().uuid().allow(null, ""),      // ✅ added
    recommendation_date: Joi.date().default(() => new Date()),
    reason: Joi.string().allow("", null),
    // 🔒 status excluded → lifecycle endpoints control it
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL RECOMMENDATIONS
   ============================================================ */
export const getAllRecommendations = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_RECOMMENDATION[role] || FIELD_VISIBILITY_RECOMMENDATION.staff;

    const options = buildQueryOptions(req, "recommendation_date", "DESC", visibleFields);
    options.where = options.where || {};

    // 🔒 Apply org/facility scoping
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    // 🔎 Apply search
    if (options.search) {
      options.where[Op.or] = [{ reason: { [Op.iLike]: `%${options.search}%` } }];
    }

    const { count, rows } = await Recommendation.findAndCountAll({
      where: options.where,
      include: [...RECOMMENDATION_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Recommendations loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load recommendations", err);
  }
};

/* ============================================================
   📌 GET RECOMMENDATION BY ID
   ============================================================ */
export const getRecommendationById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id };

    // 🔒 Apply org/facility scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const record = await Recommendation.findOne({ where, include: RECOMMENDATION_INCLUDES });
    if (!record) return error(res, "❌ Recommendation not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Recommendation loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load recommendation", err);
  }
};

/* ============================================================
   📌 CREATE RECOMMENDATION
   ============================================================ */
export const createRecommendation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildRecommendationSchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔹 Org/Facility & Doctor assignment
    let orgId = req.user.organization_id || null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      if (!value.doctor_id) {
        await t.rollback();
        return error(res, "Doctor is required for superadmin", null, 400);
      }
      orgId = value.organization_id || null;
      facilityId = value.facility_id || null;
      if (!orgId || !facilityId) {
        await t.rollback();
        return error(res, "Organization and Facility are required for superadmin", null, 400);
      }
    } else {
      value.doctor_id = req.user.employee_id;
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

    // 🔹 Consultation auto-link (enterprise-grade)
    if (!value.consultation_id) {
      if (req.query.consultation_id) {
        value.consultation_id = req.query.consultation_id;
      } else {
        const activeConsults = await Consultation.findAll({
          where: {
            patient_id: value.patient_id,
            status: { [Op.in]: ["OPEN", "IN_PROGRESS"] },
          },
          order: [["created_at", "DESC"]],
        });

        if (activeConsults.length === 1) {
          value.consultation_id = activeConsults[0].id;
          await auditService.logAction({
            user: req.user,
            module: MODULE_KEY,
            action: "auto_link_consultation",
            details: { patient_id: value.patient_id, consultation_id: activeConsults[0].id },
          });
        } else if (activeConsults.length > 1) {
          await t.rollback();
          return error(
            res,
            "Multiple active consultations found for this patient. Please specify consultation_id explicitly.",
            null,
            400
          );
        }
        // if none, leave null
      }
    }

    const created = await Recommendation.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
        status: RS.PENDING,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Recommendation.findOne({
      where: { id: created.id },
      include: RECOMMENDATION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: { ...value, status: RS.PENDING },
    });

    return success(res, "✅ Recommendation created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create recommendation", err);
  }
};

/* ============================================================
   📌 UPDATE RECOMMENDATION
   ============================================================ */
export const updateRecommendation = async (req, res) => {
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
    const schema = buildRecommendationSchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Recommendation.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Recommendation not found", null, 404);
    }

    // 🔹 Org/Facility & Doctor assignment
    let orgId = req.user.organization_id || null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || null;
      facilityId = value.facility_id || null;
      if (!orgId || !facilityId) {
        await t.rollback();
        return error(res, "Organization and Facility are required for superadmin", null, 400);
      }
    } else {
      value.doctor_id = req.user.employee_id;
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

    // 🔹 Consultation auto-link (enterprise-grade, same rules)
    if (!value.consultation_id) {
      if (req.query.consultation_id) {
        value.consultation_id = req.query.consultation_id;
      } else {
        const activeConsults = await Consultation.findAll({
          where: {
            patient_id: value.patient_id || record.patient_id,
            status: { [Op.in]: ["OPEN", "IN_PROGRESS"] },
          },
          order: [["created_at", "DESC"]],
        });

        if (activeConsults.length === 1) {
          value.consultation_id = activeConsults[0].id;
          await auditService.logAction({
            user: req.user,
            module: MODULE_KEY,
            action: "auto_link_consultation",
            details: { patient_id: value.patient_id || record.patient_id, consultation_id: activeConsults[0].id },
          });
        } else if (activeConsults.length > 1) {
          await t.rollback();
          return error(
            res,
            "Multiple active consultations found for this patient. Please specify consultation_id explicitly.",
            null,
            400
          );
        }
      }
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

    const full = await Recommendation.findOne({
      where: { id },
      include: RECOMMENDATION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Recommendation updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update recommendation", err);
  }
};

/* ============================================================
   📌 CONFIRM RECOMMENDATION (pending → confirmed)
   ============================================================ */
export const confirmRecommendation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const rec = await Recommendation.findByPk(id, { transaction: t });
    if (!rec) return error(res, "❌ Recommendation not found", null, 404);

    if (rec.status !== RS.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending recommendations can be confirmed", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      { status: RS.CONFIRMED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, RS.CONFIRMED)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: rec,
        user: {
          ...req.user,
          organization_id: rec.organization_id,
          facility_id: rec.facility_id,
        },
        transaction: t,
      });
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "confirm",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: RS.CONFIRMED },
    });

    return success(res, "✅ Recommendation confirmed", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to confirm recommendation", err);
  }
};

/* ============================================================
   📌 DECLINE RECOMMENDATION (pending → declined)
   ============================================================ */
export const declineRecommendation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const rec = await Recommendation.findByPk(id, { transaction: t });
    if (!rec) return error(res, "❌ Recommendation not found", null, 404);

    if (rec.status !== RS.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending recommendations can be declined", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
        status: RS.DECLINED,
        decline_reason: reason || null,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user: req.user,
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "decline",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: RS.DECLINED, reason: reason || null },
    });

    return success(res, "✅ Recommendation declined", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to decline recommendation", err);
  }
};

/* ============================================================
   📌 VOID RECOMMENDATION (any → voided, admin/superadmin only)
   ============================================================ */
export const voidRecommendation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void recommendations", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body;
    const rec = await Recommendation.findByPk(id, { transaction: t });
    if (!rec) return error(res, "❌ Recommendation not found", null, 404);

    const oldStatus = rec.status;

    await rec.update(
      {
        status: RS.VOIDED,
        void_reason: reason || null,
        voided_by_id: req.user?.id || null,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user: req.user,
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: RS.VOIDED, reason: reason || null },
    });

    return success(res, "✅ Recommendation voided", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void recommendation", err);
  }
};

/* ============================================================
   📌 DELETE RECOMMENDATION (Soft Delete + Billing Rollback)
   ============================================================ */
export const deleteRecommendation = async (req, res) => {
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const rec = await Recommendation.findOne({ where, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ Recommendation not found", null, 404);
    }

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user: { ...req.user, organization_id: rec.organization_id, facility_id: rec.facility_id },
      transaction: t,
    });

    await rec.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await rec.destroy({ transaction: t });

    await t.commit();

    const full = await Recommendation.findOne({
      where: { id },
      include: RECOMMENDATION_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Recommendation deleted (with billing rollback)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete recommendation", err);
  }
};

/* ============================================================
   📌 GET ALL RECOMMENDATIONS LITE (with ?q=)
   ============================================================ */
export const getAllRecommendationsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { status: RS.PENDING };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [{ reason: { [Op.iLike]: `%${q}%` } }];
    }

    const recs = await Recommendation.findAll({
      where,
      attributes: ["id", "recommendation_date", "status", "reason"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["recommendation_date", "DESC"]],
      limit: 20,
    });

    const result = recs.map(r => ({
      id: r.id,
      patient: r.patient
        ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
        : "",
      doctor: r.doctor ? `${r.doctor.first_name} ${r.doctor.last_name}` : "",
      reason: r.reason || "",
      date: r.recommendation_date,
      status: r.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Recommendations loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load recommendations (lite)", err);
  }
};
