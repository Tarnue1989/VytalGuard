// 📁 controllers/orderController.js
// ============================================================================
// 🧾 Order Controller — ENTERPRISE MASTER–ALIGNED (LabReq → Order Adaptation)
// ----------------------------------------------------------------------------
// 🔹 NO billing constants / shouldTriggerBilling
// 🔹 NO inline role helpers
// 🔹 Uses role-utils + resolveOrgFacility
// 🔹 Billing handled ONLY via billingService
// ============================================================================

/* ============================================================
   📦 CORE / THIRD-PARTY
============================================================ */
import Joi from "joi";
import { Op } from "sequelize";

/* ============================================================
   🗄️ MODELS
============================================================ */
import {
  sequelize,
  Order,
  OrderItem,
  Patient,
  Employee,
  Department,
  Consultation,
  RegistrationLog,
  BillableItem,
  Organization,
  Facility,
  User,
} from "../models/index.js";

/* ============================================================
   🧰 CORE UTILITIES
============================================================ */
import { success, error } from "../utils/response.js";
import { validate } from "../utils/validation.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { resolveClinicalLinks } from "../utils/autoLinkHelpers.js";

/* ============================================================
   🔐 ROLE & ACCESS
============================================================ */
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";

/* ============================================================
   📜 CONSTANTS
============================================================ */
import {
  ORDER_STATUS,
  ORDER_TYPE,
  ORDER_PRIORITY,
  ORDER_FULFILLMENT_STATUS,
  ORDER_BILLING_STATUS,
} from "../constants/enums.js";

import { FIELD_VISIBILITY_ORDER } from "../constants/fieldVisibility.js";

/* ============================================================
   🔧 SERVICES
============================================================ */
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { billingService } from "../services/billingService.js";

/* ============================================================
   🐞 DEBUG LOGGER (MASTER)
============================================================ */
import { makeModuleLogger } from "../utils/debugLogger.js";

const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("orderController", DEBUG_OVERRIDE);

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "orders";

/* ============================================================
   🔖 STATUS MAP (ENUM-DRIVEN, MASTER)
============================================================ */
const OS = {
  DRAFT: ORDER_STATUS[0],
  PENDING: ORDER_STATUS[1],
  APPROVED: ORDER_STATUS[2],
  IN_PROGRESS: ORDER_STATUS[3],
  COMPLETED: ORDER_STATUS[4],
  VERIFIED: ORDER_STATUS[5],
  FINALIZED: ORDER_STATUS[6],
  CANCELLED: ORDER_STATUS[7],
  VOIDED: ORDER_STATUS[8],
};

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
============================================================ */
const ORDER_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "provider", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  {
    model: RegistrationLog,
    as: "registrationLog",
    attributes: ["id", "registration_time", "log_status"],
  },
  {
    model: OrderItem,
    as: "items",
    required: false,
    where: {
      [Op.and]: [
        { status: { [Op.ne]: OS.CANCELLED } },
        { status: { [Op.ne]: OS.VOIDED } },
      ],
    },
    include: [
      { model: BillableItem, as: "billableItem", attributes: ["id", "name", "price"] },
    ],
  },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (ORDER — MASTER-ALIGNED)
============================================================ */
function buildOrderSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    provider_id: Joi.string().uuid().allow(null, ""),
    department_id: Joi.string().uuid().allow(null, ""),
    consultation_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),

    type: Joi.string().valid(...ORDER_TYPE).default(ORDER_TYPE[0]),
    priority: Joi.string().valid(...ORDER_PRIORITY).default("routine"),

    order_date: Joi.date().default(() => new Date()),
    notes: Joi.string().allow("", null),

    // 🔒 lifecycle-controlled
    status: Joi.forbidden(),
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
    billing_status: Joi.forbidden(),
    fulfillment_status: Joi.forbidden(),

    items: Joi.array()
      .items(
        Joi.object({
          billable_item_id: Joi.string().uuid().required(),
          quantity: Joi.number().integer().min(1).default(1),
          notes: Joi.string().allow("", null),
        })
      )
      .min(1)
      .required(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });

    base.items = Joi.array()
      .items(
        Joi.object({
          id: Joi.string().uuid().optional(),
          billable_item_id: Joi.string().uuid().optional(),
          quantity: Joi.number().integer().min(1).optional(),
          notes: Joi.string().allow("", null),
          _delete: Joi.boolean().optional().default(false),
        })
      )
      .optional();
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE ORDER — MASTER / CONSULTATION PARITY (DEBUG SAFE)
============================================================ */
export const createOrders = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    debug.log("createOrders → RAW BODY", req.body);

    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    if (!payloads.length) {
      await t.rollback();
      return error(res, "Payload must not be empty", null, 400);
    }

    const createdIds = [];
    const skipped = [];

    for (const [idx, payload] of payloads.entries()) {
      const { value, errors } = validate(
        buildOrderSchema("create"),
        payload
      );

      if (errors) {
        skipped.push({ index: idx, reason: "Validation failed", errors });
        continue;
      }

      debug.log("createOrders → VALIDATED VALUE", value);

      const { orgId, facilityId } = await resolveOrgFacility({
        user: req.user,
        value,
        body: payload,
      });

      const resolved = await resolveClinicalLinks({
        value,
        user: req.user,
        orgId,
        facilityId,
        transaction: t,
      });

      if (!isSuperAdmin(req.user) && !resolved.provider_id) {
        resolved.provider_id = req.user.employee_id;
      }

      if (isSuperAdmin(req.user) && !resolved.provider_id) {
        skipped.push({
          index: idx,
          reason: "Provider is required for superadmin",
        });
        continue;
      }

      if (!resolved.registration_log_id) {
        skipped.push({
          index: idx,
          reason: "No active registration log found",
        });
        continue;
      }

      const seen = new Set();
      for (const item of resolved.items) {
        if (seen.has(item.billable_item_id)) {
          skipped.push({
            index: idx,
            reason: `Duplicate billable_item_id in payload: ${item.billable_item_id}`,
          });
          continue;
        }
        seen.add(item.billable_item_id);
      }

      const order = await Order.create(
        {
          patient_id: resolved.patient_id,
          provider_id: resolved.provider_id,
          department_id: resolved.department_id,
          consultation_id: resolved.consultation_id,
          registration_log_id: resolved.registration_log_id,
          order_date: resolved.order_date
            ? new Date(resolved.order_date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          notes: resolved.notes,
          type: resolved.type,
          priority: resolved.priority,
          status: OS.DRAFT,
          billing_status: ORDER_BILLING_STATUS.NOT_BILLED,
          fulfillment_status: ORDER_FULFILLMENT_STATUS.PENDING,
          organization_id: orgId,
          facility_id: facilityId,
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );

      debug.log("createOrders → CREATED ORDER", order.id);

      const uniqueItems = [...seen].map((billable_item_id) => {
        const original = resolved.items.find(
          (i) => i.billable_item_id === billable_item_id
        );

        return {
          order_id: order.id,
          billable_item_id,
          quantity: original?.quantity || 1,
          notes: original?.notes || null,
          status: order.status,
          billing_status: ORDER_BILLING_STATUS.NOT_BILLED,
          organization_id: orgId,
          facility_id: facilityId,
          created_by_id: req.user?.id || null,
        };
      });

      debug.log("createOrders → ITEMS TO INSERT", uniqueItems);

      await OrderItem.bulkCreate(uniqueItems, {
        transaction: t,
        validate: true,
      });

      createdIds.push(order.id);
    }

    await t.commit();

    const records = createdIds.length
      ? await Order.findAll({
          where: { id: { [Op.in]: createdIds } },
          include: ORDER_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: createdIds.length > 1 ? "bulk_create" : "create",
      details: {
        created: createdIds.length,
        skipped: skipped.length,
      },
    });

    return success(res, "✅ Orders created", {
      records,
      skipped,
    });
  } catch (err) {
    await t.rollback();

    debug.error("createOrders → FAILED", {
      name: err.name,
      message: err.message,
      fields: err.errors?.map(e => ({
        field: e.path,
        message: e.message,
        value: e.value,
      })),
      stack: err.stack,
    });

    return error(res, "❌ Failed to create orders", err);
  }
};

/* ============================================================
   📌 UPDATE ORDER — MASTER / CONSULTATION PARITY (DEBUG SAFE)
============================================================ */
export const updateOrder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    debug.log("updateOrder → RAW BODY", req.body);

    const { value, errors } = validate(
      buildOrderSchema("update"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    debug.log("updateOrder → VALIDATED VALUE", value);

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      body: value,
    });

    const record = await Order.findOne({
      where: {
        id: req.params.id,
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!record) {
      await t.rollback();
      return error(res, "Order not found", null, 404);
    }

    if (
      [OS.COMPLETED, OS.VERIFIED, OS.CANCELLED, OS.VOIDED].includes(
        record.status
      )
    ) {
      await t.rollback();
      return error(res, "Finalized order cannot be edited", null, 400);
    }

    const existingItems = await OrderItem.findAll({
      where: { order_id: record.id },
      transaction: t,
    });

    if (!isSuperAdmin(req.user) && !value.provider_id) {
      value.provider_id = req.user.employee_id;
    }

    const updatePayload = {};

    [
      "patient_id",
      "provider_id",
      "department_id",
      "consultation_id",
      "registration_log_id",
      "order_date",
      "notes",
      "type",
      "priority",
    ].forEach((field) => {
      if (field === "order_date" && value.order_date) {
        updatePayload.order_date =
          new Date(value.order_date).toISOString().split("T")[0];
        return;
      }

      if (value[field] !== undefined) {
        updatePayload[field] = value[field];
      }
    });

    updatePayload.updated_by_id = req.user?.id || null;

    await record.update(updatePayload, { transaction: t });

    if (Array.isArray(value.items)) {
      const existingMap = new Map(
        existingItems.map(i => [i.billable_item_id, i])
      );

      const incomingIds = new Set();

      for (const it of value.items) {
        incomingIds.add(it.billable_item_id);

        const existing = existingMap.get(it.billable_item_id);

        if (existing) {
          if (it._delete) {
            await existing.update(
              {
                status: OS.CANCELLED,
                deleted_by_id: req.user?.id || null,
              },
              { transaction: t }
            );

            await billingService.voidCharges({
              module_key: MODULE_KEY,
              entityId: existing.id,
              user: req.user,
              transaction: t,
            });

            continue;
          }

          await existing.update(
            {
              quantity: it.quantity ?? existing.quantity,
              notes: it.notes ?? existing.notes,
              updated_by_id: req.user?.id || null,
            },
            { transaction: t }
          );

          continue;
        }

        if (!it._delete) {
          await OrderItem.create(
            {
              order_id: record.id,
              billable_item_id: it.billable_item_id,
              quantity: it.quantity || 1,
              notes: it.notes || null,
              status: record.status,
              organization_id: record.organization_id,
              facility_id: record.facility_id,
              created_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
        }
      }

      for (const existing of existingItems) {
        if (!incomingIds.has(existing.billable_item_id)) {
          await existing.update(
            {
              status: OS.CANCELLED,
              deleted_by_id: req.user?.id || null,
            },
            { transaction: t }
          );

          await billingService.voidCharges({
            module_key: MODULE_KEY,
            entityId: existing.id,
            user: req.user,
            transaction: t,
          });
        }
      }
    }

    await t.commit();

    const full = await Order.findOne({
      where: { id: record.id },
      include: ORDER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Order updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update order", err);
  }
};

/* ============================================================
   📌 GET ORDER BY ID — MASTER
============================================================ */
export const getOrderById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const record = await Order.findOne({
      where: {
        id: req.params.id,
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      include: ORDER_INCLUDES,
    });

    if (!record) {
      return error(res, "Order not found", null, 404);
    }

    const plain = record.get({ plain: true });

    const patientLabel = plain.patient
      ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
      : "Unknown Patient";

    const providerLabel = plain.provider
      ? `Dr. ${plain.provider.first_name} ${plain.provider.last_name}`
      : "No Provider";

    const items = (plain.items || [])
      .map((i) => i.billableItem?.name)
      .filter(Boolean)
      .join(", ");

    plain.label = `${patientLabel} · ${items || "No items"} · ${plain.status}`;
    plain.patient_label = patientLabel;
    plain.provider_label = providerLabel;

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "view",
      entityId: plain.id,
    });

    return success(res, "Order loaded", plain);
  } catch (err) {
    debug.error("getOrderById → FAILED", err);
    return error(res, "Failed to load order", err);
  }
};

/* ============================================================
   📌 GET ALL ORDERS — MASTER (STRICT + FILTERS + SUMMARY)
   🔥 FIXED: Audit-based date filter (created_at)
============================================================ */
export const getAllOrders = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_ORDER[role] ||
      FIELD_VISIBILITY_ORDER.staff;

    const {
      dateRange,
      status,
      patient_id,
      provider_id,
      department_id,
      consultation_id,
      facility_id,
      ...safeQuery
    } = req.query;

    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    /* 🔥 FIX: use created_at for sorting (audit) */
    const options = buildQueryOptions(
      req,
      "created_at",
      "DESC",
      visibleFields
    );

    options.where = { [Op.and]: [] };

    /* 🔥 FIX: use created_at for date filtering */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }

    /* ================= TENANT SCOPING ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      } else if (facility_id) {
        options.where[Op.and].push({ facility_id });
      }
    } else {
      if (req.query.organization_id) {
        options.where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (facility_id) {
        options.where[Op.and].push({ facility_id });
      }
    }

    /* ================= FILTERS ================= */
    if (patient_id) options.where[Op.and].push({ patient_id });
    if (provider_id) options.where[Op.and].push({ provider_id });
    if (department_id) options.where[Op.and].push({ department_id });
    if (consultation_id) options.where[Op.and].push({ consultation_id });

    if (status) {
      const statuses = Array.isArray(status)
        ? status
        : status.split(",").map((s) => s.trim());

      options.where[Op.and].push({
        status: { [Op.in]: statuses },
      });
    }

    /* ================= SEARCH ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { notes: { [Op.iLike]: `%${options.search}%` } },
          { "$patient.first_name$": { [Op.iLike]: `%${options.search}%` } },
          { "$patient.last_name$": { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ================= QUERY ================= */
    const { count, rows } = await Order.findAndCountAll({
      where: options.where,
      include: ORDER_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    /* ================= SUMMARY ================= */
    const summary = { total: count };

    const statusCounts = await Order.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    Object.values(OS).forEach((s) => {
      const found = statusCounts.find((r) => r.status === s);
      summary[s] = found ? Number(found.get("count")) : 0;
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list",
      details: {
        query: safeQuery,
        returned: count,
        pagination: { page, limit },
      },
    });

    return success(res, "✅ Orders loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    debug.error("getAllOrders → FAILED", err);
    return error(res, "❌ Failed to load orders", err);
  }
};
/* ============================================================
   📌 GET ALL ORDERS — LITE (MASTER SAFE)
============================================================ */
export const getAllOrdersLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, patient_id, status } = req.query;

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: req.query,
      body: req.query,
    });

    if (!orgId) {
      return error(res, "organization_id unresolved", null, 400);
    }

    const where = {
      organization_id: orgId,
      ...(facilityId ? { facility_id: facilityId } : {}),
      ...(patient_id ? { patient_id } : {}),
      ...(status ? { status } : {}),
    };

    if (q) {
      where[Op.or] = [
        { notes: { [Op.iLike]: `%${q}%` } },
        { "$patient.first_name$": { [Op.iLike]: `%${q}%` } },
        { "$patient.last_name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rows = await Order.findAll({
      where,
      attributes: ["id", "order_date", "status"],
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["pat_no", "first_name", "last_name"],
        },
      ],
      order: [["order_date", "DESC"]],
      limit: 50,
    });

    const records = rows.map((r) => ({
      id: r.id,
      label: `${r.patient?.pat_no || "PAT"} · ${r.status}`,
      patient: r.patient
        ? `${r.patient.first_name} ${r.patient.last_name}`
        : "Unknown",
      date: r.order_date,
      status: r.status,
    }));

    return success(res, "Orders loaded (lite)", { records });
  } catch (err) {
    debug.error("getAllOrdersLite → FAILED", err);
    return error(res, "Failed to load orders (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL ORDER ITEMS — LITE (MASTER SAFE)
============================================================ */
export const getAllOrderItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { order_id, status } = req.query;

    if (!order_id) {
      return error(res, "order_id is required", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: req.query,
      body: req.query,
    });

    if (!orgId) {
      return error(res, "organization_id unresolved", null, 400);
    }

    const where = {
      order_id,
      organization_id: orgId,
      ...(facilityId ? { facility_id: facilityId } : {}),
      ...(status ? { status } : {}),
    };

    const items = await OrderItem.findAll({
      where,
      attributes: ["id", "order_id", "billable_item_id", "status", "notes", "quantity"],
      include: [
        {
          model: BillableItem,
          as: "billableItem",
          attributes: ["id", "name", "price"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    const records = items.map((i) => ({
      id: i.id,
      label: `${i.billableItem?.name || "Unnamed Item"} · ${(i.status || "").toLowerCase()}`,
      order_id: i.order_id,
      billable_item_id: i.billable_item_id,
      item: i.billableItem?.name || "",
      quantity: i.quantity,
      status: i.status,
      notes: i.notes || "",
    }));

    return success(res, "Order items loaded (lite)", { records });
  } catch (err) {
    debug.error("getAllOrderItemsLite → FAILED", err);
    return error(res, "Failed to load order items (lite)", err);
  }
};

/* ============================================================
   📌 ACTIVATE ORDER(S) (pending → in_progress) — MASTER
============================================================ */
export const activateOrders = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const orders = await Order.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: OS.PENDING,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!orders.length) {
      await t.rollback();
      return error(res, "No pending orders found", null, 404);
    }

    for (const o of orders) {
      await o.update(
        {
          status: OS.IN_PROGRESS,
          fulfillment_status: ORDER_FULFILLMENT_STATUS.IN_PROGRESS,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const records = await Order.findAll({
      where: { id: { [Op.in]: ids } },
      include: ORDER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_activate" : "activate",
      details: { count: records.length },
    });

    return success(res, "Orders activated", { records });
  } catch (err) {
    await t.rollback();
    debug.error("activateOrders → FAILED", err);
    return error(res, "Failed to activate orders", err);
  }
};

/* ============================================================
   📌 DELETE ORDER(S) (SOFT DELETE) — MASTER
============================================================ */
export const deleteOrders = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const orders = await Order.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      include: [{ model: OrderItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!orders.length) {
      await t.rollback();
      return error(res, "No orders found", null, 404);
    }

    const deleted = [];
    const skipped = [];

    for (const o of orders) {
      if ([OS.COMPLETED, OS.VERIFIED].includes(o.status)) {
        skipped.push({ id: o.id, reason: "Finalized order cannot be deleted" });
        continue;
      }

      for (const item of o.items || []) {
        await billingService.voidCharges({
          module_key: MODULE_KEY,
          entityId: item.id,
          user: req.user,
          transaction: t,
        });
      }

      await OrderItem.update(
        { status: OS.CANCELLED },
        { where: { order_id: o.id }, transaction: t }
      );

      await o.update({ deleted_by_id: req.user.id }, { transaction: t });
      await o.destroy({ transaction: t });

      deleted.push(o.id);
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_delete" : "delete",
      details: { deleted, skipped },
    });

    return success(res, "Orders deleted", { deleted, skipped });
  } catch (err) {
    await t.rollback();
    debug.error("deleteOrders → FAILED", err);
    return error(res, "Failed to delete orders", err);
  }
};

/* ============================================================
   📌 COMPLETE ORDER(S) (in_progress → completed) — MASTER
   🔥 NO BILLING (ALREADY DONE AT PENDING)
============================================================ */
export const completeOrders = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const orders = await Order.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: OS.IN_PROGRESS,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!orders.length) {
      await t.rollback();
      return error(res, "No in-progress orders found", null, 404);
    }

    const updated = [];

    for (const o of orders) {
      await o.update(
        {
          status: OS.COMPLETED,
          fulfillment_status: ORDER_FULFILLMENT_STATUS.COMPLETED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      await OrderItem.update(
        {
          status: OS.COMPLETED,
          updated_by_id: req.user.id,
        },
        { where: { order_id: o.id }, transaction: t }
      );

      // ❌ NO BILLING HERE

      updated.push(o.id);
    }

    await t.commit();

    const records = await Order.findAll({
      where: { id: { [Op.in]: updated } },
      include: ORDER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_complete" : "complete",
      details: { updated },
    });

    return success(res, "Orders completed", { records });
  } catch (err) {
    await t.rollback();
    debug.error("completeOrders → FAILED", err);
    return error(res, "Failed to complete orders", err);
  }
};

/* ============================================================
   📌 VERIFY ORDER(S) (completed → verified) — ADMIN ONLY
   🔥 NO BILLING (ALREADY DONE AT PENDING)
============================================================ */
export const verifyOrders = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "verify",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const orders = await Order.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: OS.COMPLETED,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!orders.length) {
      await t.rollback();
      return error(res, "No completed orders found", null, 404);
    }

    const updated = [];

    for (const o of orders) {
      await o.update(
        {
          status: OS.VERIFIED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      await OrderItem.update(
        {
          status: OS.VERIFIED,
          updated_by_id: req.user.id,
        },
        { where: { order_id: o.id }, transaction: t }
      );

      // ❌ NO BILLING HERE
      updated.push(o.id);
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_verify" : "verify",
      details: { updated },
    });

    return success(res, "Orders verified", { updated });
  } catch (err) {
    await t.rollback();
    debug.error("verifyOrders → FAILED", err);
    return error(res, "Failed to verify orders", err);
  }
};
/* ============================================================
   📌 CANCEL ORDER(S) (pending / in_progress → cancelled)
============================================================ */
export const cancelOrders = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const orders = await Order.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: { [Op.in]: [OS.PENDING, OS.IN_PROGRESS] },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!orders.length) {
      await t.rollback();
      return error(res, "No cancellable orders found", null, 404);
    }

    const orderIds = orders.map(o => o.id);

    const items = await OrderItem.findAll({
      where: { order_id: { [Op.in]: orderIds } },
      transaction: t,
    });

    const updated = [];

    for (const o of orders) {
      await o.update(
        {
          status: OS.CANCELLED,
          fulfillment_status: ORDER_FULFILLMENT_STATUS.CANCELLED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      const orderItems = items.filter(i => i.order_id === o.id);

      for (const item of orderItems) {
        await billingService.voidCharges({
          module_key: MODULE_KEY,
          entityId: item.id,
          user: req.user,
          transaction: t,
        });
      }

      await OrderItem.update(
        { status: OS.CANCELLED },
        { where: { order_id: o.id }, transaction: t }
      );

      updated.push(o.id);
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_cancel" : "cancel",
      details: { updated },
    });

    return success(res, "Orders cancelled", { updated });
  } catch (err) {
    await t.rollback();
    debug.error("cancelOrders → FAILED", err);
    return error(res, "Failed to cancel orders", err);
  }
};

/* ============================================================
   📌 VOID ORDER(S) (any → voided) — ADMIN ONLY
============================================================ */
export const voidOrders = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "void",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const orders = await Order.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: { [Op.ne]: OS.VERIFIED },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!orders.length) {
      await t.rollback();
      return error(res, "No voidable orders found", null, 404);
    }

    const orderIds = orders.map(o => o.id);

    const items = await OrderItem.findAll({
      where: { order_id: { [Op.in]: orderIds } },
      transaction: t,
    });

    const updated = [];

    for (const o of orders) {
      await o.update(
        {
          status: OS.VOIDED,
          fulfillment_status: ORDER_FULFILLMENT_STATUS.VOIDED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      const orderItems = items.filter(i => i.order_id === o.id);

      for (const item of orderItems) {
        await billingService.voidCharges({
          module_key: MODULE_KEY,
          entityId: item.id,
          user: req.user,
          transaction: t,
        });
      }

      await OrderItem.update(
        { status: OS.VOIDED },
        { where: { order_id: o.id }, transaction: t }
      );

      updated.push(o.id);
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_void" : "void",
      details: { updated },
    });

    return success(res, "Orders voided", { updated });
  } catch (err) {
    await t.rollback();
    debug.error("voidOrders → FAILED", err);
    return error(res, "Failed to void orders", err);
  }
};

/* ============================================================
   📌 SUBMIT ORDER(S) (draft → pending)
   🔥 BILLING AT PENDING (ITEM-LEVEL — PRESCRIPTION PATTERN)
   ✅ FINAL FIX: VALIDATION SAFE + NO BLOCKING + DEBUG ENABLED
============================================================ */
export const submitOrders = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOAD ORDERS ================= */
    const orders = await Order.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: OS.DRAFT,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!orders.length) {
      await t.rollback();
      return error(res, "No draft orders found", null, 404);
    }

    /* ================= LOAD ITEMS ================= */
    const items = await OrderItem.findAll({
      where: {
        order_id: { [Op.in]: orders.map(o => o.id) },
        status: { [Op.notIn]: [OS.CANCELLED, OS.VOIDED] },
      },
      include: [
        {
          model: BillableItem,
          as: "billableItem",
          attributes: ["id", "name", "price"],
        },
      ],
      transaction: t,
    });

    /* ================= MAP ITEMS ================= */
    const itemsByOrder = {};
    for (const item of items) {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }
      itemsByOrder[item.order_id].push(item);
    }

    const updated = [];
    const skipped = [];

    for (const o of orders) {
      try {
        const orderItems = itemsByOrder[o.id] || [];

        /* ================= STATUS UPDATE (SAFE) ================= */
        await o.update(
          {
            status: OS.PENDING,
            billing_status: ORDER_BILLING_STATUS.PENDING,
            updated_by_id: req.user?.id || null,
          },
          {
            transaction: t,
            validate: false, // ✅ FIX
          }
        );

        await OrderItem.update(
          {
            status: OS.PENDING,
            updated_by_id: req.user?.id || null,
          },
          {
            where: { order_id: o.id },
            transaction: t,
            validate: false, // ✅ 🔥 CRITICAL FIX
          }
        );

        /* ================= BILL ONLY IF ITEMS EXIST ================= */
        if (orderItems.length) {
          await billingService.billOrderItems({
            order: o,
            user: {
              ...req.user,
              organization_id: orgId,
              facility_id: facilityId,
            },
            transaction: t,
          });
        } else {
          console.warn("⚠️ No items found for billing:", o.id);
        }

        updated.push(o.id);

      } catch (innerErr) {
        console.error("❌ SUBMIT ERROR FULL:", {
          id: o.id,
          message: innerErr.message,
          errors: innerErr.errors,
          fields: innerErr?.errors?.map(e => ({
            field: e.path,
            message: e.message,
            value: e.value,
          })),
        });

        skipped.push({
          id: o.id,
          reason: innerErr.message || "Submit/Billing failed",
        });
      }
    }

    await t.commit();

    const records = await Order.findAll({
      where: { id: { [Op.in]: updated } },
      include: ORDER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_submit" : "submit",
      details: { updated, skipped },
    });

    return success(res, "Orders submitted (item-level billing)", {
      records,
      updated,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    debug.error("submitOrders → FAILED", err);
    return error(res, "Failed to submit orders", err);
  }
};