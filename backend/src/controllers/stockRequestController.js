// 📁 backend/src/controllers/stockRequestController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  StockRequest,
  StockRequestItem,
  User,
  Facility,
  Department,
  Organization,
  CentralStock,
  MasterItem,
  DepartmentStock,
  StockLedger,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import {
  STOCK_REQUEST_STATUS,
  STOCK_REQUEST_ITEM_STATUS,
  STOCK_LEDGER_TYPE,
  CENTRAL_STOCK_STATUS
} from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { inventoryService } from "../services/inventoryService.js";
import { stockService } from "../services/stockService.js";

/* ============================================================
   🔧 HELPERS
============================================================ */
function normalizeRole(user) {
  if (!user) return "";
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase().replace(/\s+/g, "")).find(Boolean) || "";
}
function isSuperAdmin(user) {
  return normalizeRole(user) === "superadmin";
}

/* ============================================================
   🔗 STATUS MAPS
============================================================ */
const REQUEST_STATUS = STOCK_REQUEST_STATUS;
const ITEM_STATUS = STOCK_REQUEST_ITEM_STATUS;

const REQUEST_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code"] },
  { model: Department, as: "department", attributes: ["id", "name", "code"] },
  {
    model: StockRequestItem,
    as: "items",
    attributes: [
      "id",
      "master_item_id",
      "central_stock_id",
      "quantity",
      "issued_quantity",
      "fulfilled_quantity",
      "status",
      "remarks",
    ],
    include: [
      { model: MasterItem, as: "masterItem", attributes: ["id", "name", "code"] },
      { model: CentralStock, as: "centralStock", attributes: ["id", "batch_number", "quantity"] },
    ],
  },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "approvedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "rejectedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "issuedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "fulfilledBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA
============================================================ */
function buildRequestSchema(userRole, mode = "create") {
  const base = {
    department_id: Joi.string().uuid().required(),
    reference_number: Joi.string().max(50).allow("", null),
    notes: Joi.string().max(500).allow("", null),
    items: Joi.array().items(
      Joi.object({
        id: Joi.string().uuid().optional(),
        master_item_id: Joi.string().uuid().required(),
        quantity: Joi.number().integer().positive().required(),
        remarks: Joi.string().allow("", null),
      })
    ),
  };

  // required items on create
  if (mode === "create") base.items = base.items.min(1).required();
  else Object.keys(base).forEach(k => (base[k] = base[k].optional()));

  // superadmins may pass org/fac
  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().optional();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE STOCK REQUEST (role-aware + auto-ref-number)
============================================================ */
function generateReferenceNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SR-${datePart}-${rand}`;
}

export const createRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "stock_requests",
      action: "create",
      res,
    });
    if (!allowed) return;

    const role = normalizeRole(req.user);
    const schema = buildRequestSchema(role, "create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const { items, ...requestData } = value;

    // 🔐 Determine org/facility based on role
    let orgId = req.user.organization_id || null;
    let facilityId = req.user.facility_id || null;

    if (role === "superadmin") {
      orgId = value.organization_id || orgId;
      facilityId = value.facility_id || facilityId;
    } else if (role === "orgowner") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || null;
    } else if (role === "admin") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || req.user.facility_id;
    } else if (role === "facilityhead") {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    // 🧠 Auto-generate reference number if blank
    if (!requestData.reference_number || requestData.reference_number.trim() === "") {
      requestData.reference_number = generateReferenceNumber();
    }

    const request = await inventoryService.requestStock(
      { ...requestData, organization_id: orgId, facility_id: facilityId },
      items,
      req.user.id,
      t
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: "stock_requests",
      action: "create",
      entityId: request.id,
      entity: request,
    });

    return success(res, "✅ Stock Request created", request);
  } catch (err) {
    await t.rollback();

    // 🧩 Handle duplicate reference_number gracefully
    if (err.name === "SequelizeUniqueConstraintError" && err.fields?.reference_number) {
      return error(
        res,
        "❌ Reference number already exists. Please use a unique one.",
        err,
        409
      );
    }

    console.error("❌ [createRequest] error:", err);
    return error(res, "❌ Failed to create stock request", err);
  }
};

/* ============================================================
   📌 UPDATE STOCK REQUEST (role-aware + consistent formatting)
============================================================ */
export const updateRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "stock_requests",
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = normalizeRole(req.user);
    const schema = buildRequestSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔐 Determine org/facility by role
    let orgId = req.user.organization_id || null;
    let facilityId = req.user.facility_id || null;

    if (role === "superadmin") {
      orgId = value.organization_id || orgId;
      facilityId = value.facility_id || facilityId;
    } else if (role === "orgowner") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || null;
    } else if (role === "admin") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || req.user.facility_id;
    } else if (role === "facilityhead") {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    const request = await StockRequest.findOne({
      where: { id, organization_id: orgId },
      include: [{ model: StockRequestItem, as: "items" }],
      transaction: t,
    });

    if (!request) {
      await t.rollback();
      return error(res, "❌ Stock Request not found", null, 404);
    }

    if (![REQUEST_STATUS.DRAFT, REQUEST_STATUS.PENDING].includes(request.status)) {
      await t.rollback();
      return error(res, "❌ Only draft/pending requests can be updated", null, 409);
    }

    // 🧩 Split data
    const { items, ...requestData } = value;

    // 🧠 Auto-fix empty reference_number if user cleared it
    if (!requestData.reference_number || requestData.reference_number.trim() === "") {
      requestData.reference_number = request.reference_number; // keep old one
    }

    await request.update(
      {
        ...requestData,
        updated_by_id: req.user.id,
        organization_id: orgId,
        facility_id: facilityId,
      },
      { transaction: t }
    );

    // 🧾 Sync items
    if (Array.isArray(items)) {
      const seen = new Set();
      const uniqueItems = items.filter((i) => {
        if (!i.master_item_id) return false;
        if (seen.has(i.master_item_id)) return false;
        seen.add(i.master_item_id);
        return true;
      });

      const existingIds = request.items.map((i) => i.id);

      // 🔁 Upsert items
      for (const item of uniqueItems) {
        if (item.id && existingIds.includes(item.id)) {
          await StockRequestItem.update(
            { quantity: item.quantity, remarks: item.remarks || null },
            { where: { id: item.id }, transaction: t }
          );
        } else {
          await StockRequestItem.create(
            {
              ...item,
              stock_request_id: id,
              organization_id: orgId,
              facility_id: facilityId,
            },
            { transaction: t }
          );
        }
      }

      // 🗑️ Delete removed ones
      const incomingIds = uniqueItems.filter((i) => i.id).map((i) => i.id);
      const toDelete = existingIds.filter((x) => !incomingIds.includes(x));
      if (toDelete.length) {
        await StockRequestItem.destroy({ where: { id: toDelete }, transaction: t });
      }
    }

    await t.commit();

    await request.reload({ include: REQUEST_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "stock_requests",
      action: "update",
      entityId: id,
      entity: request,
    });

    return success(res, "✅ Stock Request updated", request);
  } catch (err) {
    await t.rollback();

    // 🧩 Graceful duplicate handling (same as create)
    if (err.name === "SequelizeUniqueConstraintError" && err.fields?.reference_number) {
      return error(
        res,
        `❌ Reference number "${err.fields.reference_number}" already exists. Please use a unique one.`,
        err,
        409
      );
    }

    console.error("❌ [updateRequest] error:", err);
    return error(res, "❌ Failed to update stock request", err);
  }
};

/* ============================================================
   📌 SUBMIT REQUEST (Draft → Pending)
============================================================ */
export const submitRequest = async (req, res) => {
  return sequelize.transaction(async (t) => {
    try {
      const { id } = req.params;

      const request = await StockRequest.findByPk(id, {
        include: { model: StockRequestItem, as: "items" },
        transaction: t,
      });

      if (!request) return error(res, "❌ Not found", null, 404);

      // ✅ Guard: only draft can be submitted
      if (request.status !== REQUEST_STATUS.DRAFT) {
        return error(res, "❌ Only draft requests can be submitted", null, 409);
      }

      if (!request.items || !request.items.length) {
        return error(res, "❌ Cannot submit request without items", null, 400);
      }

      await request.update(
        {
          status: REQUEST_STATUS.PENDING,
          updated_by_id: req.user.id,
          updated_at: new Date(),
        },
        { transaction: t }
      );

      await auditService.logAction({
        user: req.user,
        module: "stock_requests",
        action: "submit",
        entityId: id,
        entity: request,
      });

      return success(res, "✅ Request submitted (pending approval)", request);
    } catch (err) {
      return error(res, "❌ Failed to submit request", err);
    }
  });
};
/* ============================================================
   📌 GET ALL REQUESTS (with optimized availability per item)
============================================================ */
export const getAllRequests = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "stock_requests",
      action: "read",
      res,
    });
    if (!allowed) return;

    const options = buildQueryOptions(req, "created_at", "DESC");
    options.where = options.where || {};

    // 🔹 Tenant user scope
    if (!isSuperAdmin(req.user)) {
      if (req.user.organization_id) options.where.organization_id = req.user.organization_id;
      if (req.user.facility_id) options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    // 🔹 Status filter
    if (req.query.status) options.where.status = req.query.status;

    // 🔹 Search filter
    if (options.search) {
      options.where[Op.or] = [
        { reference_number: { [Op.iLike]: `%${options.search}%` } },
        { notes: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    // 🔹 Cleanup
    Object.keys(options.where).forEach((k) => {
      const v = options.where[k];
      if (!v || v === "undefined" || v === "null") delete options.where[k];
    });

    options.where.deleted_at = null;

    const { count, rows } = await StockRequest.findAndCountAll({
      where: options.where,
      include: REQUEST_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    // 🔹 Collect all facility/item pairs in this page
    const pairs = [];
    for (const reqRow of rows) {
      if (!reqRow.facility_id) continue;
      for (const item of reqRow.items || []) {
        pairs.push({ facility_id: reqRow.facility_id, master_item_id: item.master_item_id });
      }
    }

    if (pairs.length > 0) {
      const availability = await CentralStock.findAll({
        where: {
          [Op.and]: [
            { [Op.or]: pairs },
            {
              [Op.or]: [
                { expiry_date: null },
                { expiry_date: { [Op.gt]: new Date() } },
              ],
            },
          ],
          status: CENTRAL_STOCK_STATUS.ACTIVE,
          is_locked: false,
          quantity: { [Op.gt]: 0 },
        },

        attributes: [
          "facility_id",
          "master_item_id",
          [sequelize.fn("SUM", sequelize.col("quantity")), "available_qty"],
        ],
        group: ["facility_id", "master_item_id"],
        raw: true,
      });

      const availMap = {};
      for (const a of availability) {
        availMap[`${a.facility_id}_${a.master_item_id}`] = parseInt(a.available_qty, 10);
      }

      for (const reqRow of rows) {
        for (const item of reqRow.items || []) {
          const key = `${reqRow.facility_id}_${item.master_item_id}`;
          item.dataValues.available_quantity = availMap[key] || 0;
        }
      }
    }

    await auditService.logAction({
      user: req.user,
      module: "stock_requests",
      action: "list",
      details: { returned: count },
    });

    return success(res, "✅ Stock Requests loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load stock requests", err);
  }
};

/* ============================================================
   📌 GET REQUEST BY ID (optimized availability per item)
============================================================ */
export const getRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const found = await StockRequest.findOne({
      where: { id },
      include: REQUEST_INCLUDES,
    });
    if (!found) return error(res, "❌ Stock Request not found", null, 404);

    if (found.facility_id && found.items.length > 0) {
      const availability = await CentralStock.findAll({
        where: {
          facility_id: found.facility_id,
          master_item_id: { [Op.in]: found.items.map(i => i.master_item_id) },
          status: CENTRAL_STOCK_STATUS.ACTIVE,
          is_locked: false,
          quantity: { [Op.gt]: 0 },
          [Op.or]: [
            { expiry_date: null },
            { expiry_date: { [Op.gt]: new Date() } },
          ],
        },
        attributes: [
          "master_item_id",
          [sequelize.fn("SUM", sequelize.col("quantity")), "available_qty"],
        ],
        group: ["master_item_id"],
        raw: true,
      });

      const availMap = {};
      for (const a of availability) {
        availMap[a.master_item_id] = parseInt(a.available_qty, 10);
      }

      for (const item of found.items) {
        item.dataValues.available_quantity = availMap[item.master_item_id] || 0;
      }
    }

    await auditService.logAction({
      user: req.user,
      module: "stock_requests",
      action: "view",
      entityId: id,
    });

    return success(res, "✅ Stock Request loaded", found);
  } catch (err) {
    return error(res, "❌ Failed to load stock request", err);
  }
};

/* ============================================================
   📌 GET REQUESTS LITE (enterprise-safe)
============================================================ */
export const getAllRequestsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "stock_requests",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;
    const where = {};

    // 🔹 Tenant scope
    if (!isSuperAdmin(req.user)) {
      if (req.user.organization_id) where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    // 🔹 Safe search filter (Op.or wrapped)
    if (q) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { reference_number: { [Op.iLike]: `%${q}%` } },
            { notes: { [Op.iLike]: `%${q}%` } },
          ],
        },
      ];
    }

    // 🔹 Cleanup invalid filters
    Object.keys(where).forEach((k) => {
      const v = where[k];
      if (!v || v === "undefined" || v === "null") delete where[k];
    });

    // 🔹 Soft delete safety
    where.deleted_at = null;

    const items = await StockRequest.findAll({
      where,
      attributes: ["id", "reference_number", "status", "department_id", "created_at"],
      order: [["created_at", "DESC"]],
      limit: 20,
      paranoid: true,
    });

    const records = items.map((r) => ({
      id: r.id,
      reference_number: r.reference_number,
      status: r.status,
      department_id: r.department_id,
      created_at: r.created_at,
    }));

    await auditService.logAction({
      user: req.user,
      module: "stock_requests",
      action: "list_lite",
      details: { q, count: records.length },
    });

    return success(res, "✅ Stock Requests loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load stock requests (lite)", err);
  }
};

/* ============================================================
   📌 CHECK AVAILABILITY FOR AN ITEM
============================================================ */
export const getItemAvailability = async (req, res) => {
  try {
    const { master_item_id, facility_id } = req.query;
    if (!master_item_id || !facility_id) {
      return error(res, "❌ master_item_id and facility_id required", null, 400);
    }

    const stocks = await CentralStock.findAll({
      where: {
        master_item_id,
        facility_id,
        status: CENTRAL_STOCK_STATUS.ACTIVE,
        is_locked: false,
        quantity: { [Op.gt]: 0 },
        [Op.or]: [
          { expiry_date: null },
          { expiry_date: { [Op.gt]: new Date() } },
        ],
      },
      order: [["expiry_date", "ASC NULLS LAST"]],
      attributes: ["id", "batch_number", "quantity", "expiry_date", "is_locked", "status"],
    });

    const totalAvailable = stocks.reduce((sum, s) => sum + s.quantity, 0);

    return success(res, "✅ Availability loaded", {
      master_item_id,
      facility_id,
      totalAvailable,
      batches: stocks,
    });
  } catch (err) {
    return error(res, "❌ Failed to load availability", err);
  }
};


// 📌 ITEM AVAILABILITY (Lite)
export const getItemAvailabilityLite = async (req, res) => {
  try {
    const { master_item_id, facility_id } = req.query;

    if (!master_item_id || !facility_id) {
      return res.status(400).json({
        success: false,
        message: "❌ master_item_id and facility_id are required",
      });
    }

    const stocks = await CentralStock.findAll({
      where: {
        master_item_id,
        facility_id,
        status: CENTRAL_STOCK_STATUS.ACTIVE,
        is_locked: false,
        quantity: { [Op.gt]: 0 },
      },
      attributes: ["id", "batch_number", "quantity", "expiry_date", "is_locked", "status"],
      order: [["expiry_date", "ASC NULLS LAST"]],
      limit: 20,
    });

    return res.json({ success: true, data: { records: stocks } });
  } catch (err) {
    console.error("❌ Failed to load item availability:", err);
    return res.status(500).json({
      success: false,
      message: "❌ Failed to load item availability",
      error: err.message,
    });
  }
};

/* ============================================================
   📌 FULFILL REQUEST ITEM
============================================================ */
export const fulfillRequestItem = async (req, res) => {
  return sequelize.transaction(async (t) => {
    try {
      const { id } = req.params;
      const { quantity, notes } = req.body;

      const item = await StockRequestItem.findByPk(id, { transaction: t });
      if (!item) return error(res, "❌ Item not found", null, 404);

      if (quantity <= 0) return error(res, "❌ Fulfilled quantity must be greater than zero", null, 400);
      if (quantity > item.issued_quantity)
        return error(res, "❌ Fulfilled quantity cannot exceed issued quantity", null, 400);

      const newStatus =
        quantity < item.issued_quantity ? ITEM_STATUS.PARTIALLY_FULFILLED : ITEM_STATUS.FULFILLED;

      await item.update(
        {
          fulfilled_quantity: quantity,
          status: newStatus,
          fulfillment_notes: notes || null,
          fulfilled_by_id: req.user.id,
          fulfilled_at: new Date(),
        },
        { transaction: t }
      );

      // 🔄 Recheck parent request
      const request = await StockRequest.findByPk(item.stock_request_id, {
        include: [{ model: StockRequestItem, as: "items" }],
        transaction: t,
      });

      if (request) {
        const statuses = request.items.map((i) => i.status);
        let parentStatus = request.status;

        if (statuses.every((s) => s === ITEM_STATUS.FULFILLED)) {
          parentStatus = REQUEST_STATUS.FULFILLED;
        } else if (
          statuses.some((s) =>
            [ITEM_STATUS.FULFILLED, ITEM_STATUS.PARTIALLY_FULFILLED].includes(s)
          ) &&
          statuses.some((s) =>
            [ITEM_STATUS.PENDING, ITEM_STATUS.APPROVED, ITEM_STATUS.ISSUED].includes(s)
          )
        ) {
          // 🚩 keep parent as "issued" until all are fulfilled
          parentStatus = REQUEST_STATUS.ISSUED;
        }

        if (parentStatus !== request.status) {
          await request.update(
            { status: parentStatus, fulfilled_by_id: req.user.id, fulfilled_at: new Date() },
            { transaction: t }
          );
        }

        await request.reload({ include: REQUEST_INCLUDES, transaction: t });
      }

      await auditService.logAction({
        user: req.user,
        module: "stock_request_items",
        action: "fulfill",
        entityId: id,
        entity: item,
      });

      return success(res, "✅ Item fulfilled", { item, parent: request });
    } catch (err) {
      return error(res, "❌ Failed to fulfill item", err);
    }
  });
};

/* ============================================================
   📌 APPROVE / REJECT REQUEST
============================================================ */
export const approveRequest = async (req, res) => {
  return sequelize.transaction(async (t) => {
    try {
      const { id } = req.params;
      const request = await StockRequest.findByPk(id, {
        include: { model: StockRequestItem, as: "items" },
        transaction: t,
      });
      if (!request) return error(res, "❌ Not found", null, 404);
      if (request.status !== REQUEST_STATUS.PENDING)
        return error(res, "❌ Only pending requests can be approved", null, 409);

      await request.update(
        { status: REQUEST_STATUS.APPROVED, approved_by_id: req.user.id, approved_at: new Date() },
        { transaction: t }
      );
      await StockRequestItem.update(
        { status: ITEM_STATUS.APPROVED },
        { where: { stock_request_id: id }, transaction: t }
      );

      await auditService.logAction({ user: req.user, module: "stock_requests", action: "approve", entityId: id });
      return success(res, "✅ Request approved", request);
    } catch (err) {
      return error(res, "❌ Failed to approve request", err);
    }
  });
};

export const rejectRequest = async (req, res) => {
  return sequelize.transaction(async (t) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const request = await StockRequest.findByPk(id, {
        include: { model: StockRequestItem, as: "items" },
        transaction: t,
      });
      if (!request) return error(res, "❌ Not found", null, 404);

      await request.update(
        {
          status: REQUEST_STATUS.REJECTED,
          rejection_reason: reason || null,
          rejected_by_id: req.user.id,
          rejected_at: new Date(),
        },
        { transaction: t }
      );
      await StockRequestItem.update(
        { status: ITEM_STATUS.REJECTED, rejection_reason: reason || null },
        { where: { stock_request_id: id }, transaction: t }
      );

      await auditService.logAction({ user: req.user, module: "stock_requests", action: "reject", entityId: id });
      return success(res, "✅ Request rejected", request);
    } catch (err) {
      return error(res, "❌ Failed to reject request", err);
    }
  });
};

/* ============================================================
   📌 FULFILL REQUEST (bulk: set fulfilled_quantity = issued_quantity)
============================================================ */
export const fulfillRequest = async (req, res) => {
  return sequelize.transaction(async (t) => {
    try {
      const { id } = req.params;

      // 🔹 Find request
      const request = await StockRequest.findByPk(id, {
        include: [{ model: StockRequestItem, as: "items" }],
        transaction: t,
      });
      if (!request) return error(res, "❌ Not found", null, 404);

      // 🔹 Update parent
      await request.update(
        {
          status: REQUEST_STATUS.FULFILLED,
          fulfilled_by_id: req.user.id,
          fulfilled_at: new Date(),
        },
        { transaction: t }
      );

      // 🔹 Update child items (set fulfilled_quantity = issued_quantity)
      await StockRequestItem.update(
        {
          status: ITEM_STATUS.FULFILLED,
          fulfilled_quantity: sequelize.col("issued_quantity"),
        },
        { where: { stock_request_id: id }, transaction: t }
      );

      await auditService.logAction({
        user: req.user,
        module: "stock_requests",
        action: "fulfill",
        entityId: id,
      });

      return success(res, "✅ Request fulfilled", request);
    } catch (err) {
      return error(res, "❌ Failed to fulfill request", err);
    }
  });
};

/* ============================================================
   📌 CANCEL REQUEST (only draft/pending/approved)
============================================================ */
export const cancelRequest = async (req, res) => {
  return sequelize.transaction(async (t) => {
    try {
      const { id } = req.params;
      const request = await StockRequest.findByPk(id, {
        include: [{ model: StockRequestItem, as: "items" }],
        transaction: t,
      });
      if (!request) return error(res, "❌ Not found", null, 404);

      // 🚫 Block if already issued or fulfilled
      if ([REQUEST_STATUS.ISSUED, REQUEST_STATUS.FULFILLED].includes(request.status)) {
        return error(
          res,
          "❌ Cannot cancel an issued/fulfilled request. Please create a Stock Return instead.",
          null,
          409
        );
      }

      // ✅ Update request & items to cancelled
      await request.update({ status: REQUEST_STATUS.CANCELLED }, { transaction: t });
      await StockRequestItem.update(
        { status: ITEM_STATUS.CANCELLED },
        { where: { stock_request_id: id }, transaction: t }
      );

      // 🔹 Log cancel event
      await StockLedger.create(
        {
          organization_id: request.organization_id,
          facility_id: request.facility_id,
          stock_request_id: request.id,
          ledger_type: STOCK_LEDGER_TYPE.STATUS_CHANGE,
          quantity: 0,
          balance_after: 0,
          created_by_id: req.user.id,
        },
        { transaction: t }
      );

      await auditService.logAction({
        user: req.user,
        module: "stock_requests",
        action: "cancel",
        entityId: id,
      });

      return success(res, "✅ Request cancelled", request);
    } catch (err) {
      return error(res, `❌ Failed to cancel request: ${err.message}`, err, 400);
    }
  });
};

/* ============================================================
   📌 VOID ISSUED REQUEST (reverse stock safely)
============================================================ */
export const voidRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const request = await StockRequest.findByPk(id, {
      include: [{ model: StockRequestItem, as: "items" }],
      transaction: t,
    });

    if (!request) {
      await t.rollback();
      return error(res, "❌ Request not found", null, 404);
    }

    // 🚫 Only ISSUED requests can be voided
    if (request.status !== REQUEST_STATUS.ISSUED) {
      await t.rollback();
      return error(res, "❌ Only ISSUED requests can be voided", null, 409);
    }

    // 🚫 Block if any item already fulfilled
    const hasFulfilled = request.items.some(
      (i) =>
        i.fulfilled_quantity > 0 ||
        [ITEM_STATUS.FULFILLED, ITEM_STATUS.PARTIALLY_FULFILLED].includes(i.status)
    );

    if (hasFulfilled) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot void request with fulfilled items. Use Stock Return instead.",
        null,
        409
      );
    }

    /* ----------------------------------------------------------
       🔁 REVERSE STOCK (PER ITEM, SAME BATCH)
    ---------------------------------------------------------- */
    for (const item of request.items) {
      if (!item.central_stock_id || item.issued_quantity <= 0) continue;

      await CentralStock.increment(
        { quantity: item.issued_quantity },
        { where: { id: item.central_stock_id }, transaction: t }
      );

      await item.update(
        {
          status: ITEM_STATUS.VOIDED,
          issued_quantity: 0,
          issued_at: null,
          issued_by_id: null,
          central_stock_id: null,
        },
        { transaction: t }
      );
    }

    /* ----------------------------------------------------------
       🔄 RESET PARENT REQUEST
    ---------------------------------------------------------- */
    await request.update(
      {
        status: REQUEST_STATUS.PENDING,
        issued_at: null,
        issued_by_id: null,
        updated_by_id: req.user.id,
        updated_at: new Date(),
      },
      { transaction: t }
    );

    /* ----------------------------------------------------------
       🧾 LEDGER ENTRY
    ---------------------------------------------------------- */
    await StockLedger.create(
      {
        organization_id: request.organization_id,
        facility_id: request.facility_id,
        stock_request_id: request.id,
        ledger_type: STOCK_LEDGER_TYPE.VOID_ISSUE,
        quantity: 0,
        balance_after: 0,
        created_by_id: req.user.id,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: "stock_requests",
      action: "void",
      entityId: request.id,
      entity: request,
    });

    return success(res, "✅ Issued request voided successfully", request);
  } catch (err) {
    await t.rollback();
    return error(res, `❌ Failed to void request: ${err.message}`, err, 400);
  }
};


/* ============================================================
   📌 RESTORE REQUEST (reset to draft, clear stale metadata)
============================================================ */
export const restoreRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const request = await StockRequest.findByPk(id, { transaction: t, paranoid: false });
    if (!request) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }
    if (!request.deleted_at) {
      await t.rollback();
      return error(res, "❌ Request is not deleted", null, 409);
    }

    // ✅ Restore and reset status/metadata
    await request.restore({ transaction: t });
    await request.update(
      {
        deleted_at: null,
        deleted_by_id: null,
        status: REQUEST_STATUS.DRAFT,
        rejection_reason: null,
        fulfilled_at: null,
        approved_at: null,
        rejected_at: null,
        issued_at: null,
        updated_by_id: req.user.id,
        updated_at: new Date(),
      },
      { transaction: t }
    );

    await StockLedger.create(
      {
        organization_id: request.organization_id,
        facility_id: request.facility_id,
        stock_request_id: request.id,
        ledger_type: STOCK_LEDGER_TYPE.RESTORE,
        quantity: 0,
        balance_after: 0,
        created_by_id: req.user.id,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: "stock_requests",
      action: "restore",
      entityId: id,
      entity: request,
    });

    return success(res, "✅ Stock Request restored (reset to draft)", request);
  } catch (err) {
    await t.rollback();
    return error(res, `❌ Failed to restore stock request: ${err.message}`, err, 400);
  }
};


/* ============================================================
   📌 ISSUE REQUEST (with partial support)
============================================================ */
export const issueRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await stockService.issueStock(id, req.user.id);

    // 🔹 Parent status logic
    const itemStatuses = request.items.map(i => i.status);
    if (itemStatuses.every(s => s === ITEM_STATUS.ISSUED)) {
      await request.update(
        { status: REQUEST_STATUS.ISSUED, issued_by_id: req.user.id, issued_at: new Date() }
      );
    } else if (itemStatuses.some(s => s === ITEM_STATUS.ISSUED)) {
      await request.update(
        { status: REQUEST_STATUS.APPROVED, updated_by_id: req.user.id, updated_at: new Date() }
      );
    }

    await auditService.logAction({
      user: req.user,
      module: "stock_requests",
      action: "issue",
      entityId: id,
      entity: request,
    });

    return success(res, "✅ Request issued", request);
  } catch (err) {
    return error(res, `❌ Failed to issue request: ${err.message}`, err, 400);
  }
};

/* ============================================================
   📌 ITEM-LEVEL ACTIONS (with parent sync)
============================================================ */
export const approveRequestItem = async (req, res) => {
  return sequelize.transaction(async (t) => {
    try {
      const { id } = req.params;
      const item = await StockRequestItem.findByPk(id, {
        include: [{ model: StockRequest, as: "stockRequest", include: [{ model: StockRequestItem, as: "items" }] }],
        transaction: t,
      });
      if (!item) return error(res, "❌ Item not found", null, 404);

      // ✅ Approve this item
      await item.update({ status: ITEM_STATUS.APPROVED }, { transaction: t });

      const request = item.stockRequest;
      if (request) {
        const allApproved = request.items.every(i =>
          i.id === item.id ? ITEM_STATUS.APPROVED : i.status === ITEM_STATUS.APPROVED
        );
        if (allApproved && request.status === REQUEST_STATUS.PENDING) {
          await request.update(
            { status: REQUEST_STATUS.APPROVED, approved_by_id: req.user.id, approved_at: new Date() },
            { transaction: t }
          );
        }
      }

      await auditService.logAction({
        user: req.user,
        module: "stock_request_items",
        action: "approve",
        entityId: id,
        entity: item,
      });

      return success(res, "✅ Item approved", item);
    } catch (err) {
      return error(res, "❌ Failed to approve item", err);
    }
  });
};

export const rejectRequestItem = async (req, res) => {
  return sequelize.transaction(async (t) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const item = await StockRequestItem.findByPk(id, {
        include: [{ model: StockRequest, as: "stockRequest", include: [{ model: StockRequestItem, as: "items" }] }],
        transaction: t,
      });
      if (!item) return error(res, "❌ Item not found", null, 404);

      // ✅ Reject this item
      await item.update({ status: ITEM_STATUS.REJECTED, rejection_reason: reason || null }, { transaction: t });

      const request = item.stockRequest;
      if (request) {
        const allRejected = request.items.every(i =>
          i.id === item.id ? ITEM_STATUS.REJECTED : i.status === ITEM_STATUS.REJECTED
        );
        if (allRejected) {
          await request.update(
            {
              status: REQUEST_STATUS.REJECTED,
              rejection_reason: reason || null,
              rejected_by_id: req.user.id,
              rejected_at: new Date(),
            },
            { transaction: t }
          );
        }
      }

      await auditService.logAction({
        user: req.user,
        module: "stock_request_items",
        action: "reject",
        entityId: id,
        entity: item,
      });

      return success(res, "✅ Item rejected", item);
    } catch (err) {
      return error(res, "❌ Failed to reject item", err);
    }
  });
};

export const issueRequestItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await stockService.issueStockItem(id, req.user.id);

    await auditService.logAction({
      user: req.user,
      module: "stock_request_items",
      action: "issue",
      entityId: id,
      entity: item,
    });

    return success(res, "✅ Item issued", item);
  } catch (err) {
    // 👇 Pass user-friendly message from service
    return error(
      res,
      `❌ Failed to issue item: ${err.message || "Unexpected error"}`,
      err,
      400
    );
  }
};

/* ============================================================
   📌 DELETE REQUEST (soft delete, paranoid-safe)
============================================================ */
export const deleteRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    // 🔹 Find request
    const request = await StockRequest.findByPk(id, { transaction: t });
    if (!request) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    // 🔹 Only allow draft/pending deletes
    if (![REQUEST_STATUS.DRAFT, REQUEST_STATUS.PENDING].includes(request.status)) {
      await t.rollback();
      return error(res, "❌ Only draft/pending requests can be deleted", null, 409);
    }

    // 🔹 Paranoid delete (sets deleted_at automatically)
    await request.destroy({ transaction: t });

    // 🔹 Record who deleted
    await request.update(
      { deleted_by_id: req.user.id },
      { transaction: t, paranoid: false } // 👈 allow update even though it's "deleted"
    );

    await t.commit();

    // 🔹 Audit log
    await auditService.logAction({
      user: req.user,
      module: "stock_requests",
      action: "delete",
      entityId: id,
    });

    return success(res, "✅ Stock Request deleted");
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete stock request", err);
  }
};
