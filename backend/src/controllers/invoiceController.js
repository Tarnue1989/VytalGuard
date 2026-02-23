// 📁 backend/src/controllers/invoiceController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Invoice,
  InvoiceItem,
  Patient,
  Organization,
  Facility,
  User,
  Payment,
  Refund,
  Deposit,
  DiscountWaiver,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import {
  INVOICE_STATUS,
  PAYMENT_METHODS,
} from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { FIELD_VISIBILITY_INVOICE } from "../constants/fieldVisibility.js";

const MODULE_KEY = "invoice";

// 🔖 Local enum map for readability
const IS = {
  DRAFT: INVOICE_STATUS[0],
  ISSUED: INVOICE_STATUS[1],
  UNPAID: INVOICE_STATUS[2],
  PARTIAL: INVOICE_STATUS[3],
  PAID: INVOICE_STATUS[4],
  CANCELLED: INVOICE_STATUS[5],
  VOIDED: INVOICE_STATUS[6],
};

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
const INVOICE_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: InvoiceItem, as: "items" },
  { model: Payment, as: "payments" },
  { model: Refund, as: "refunds" },
  { model: Deposit, as: "appliedDeposits" },
  { model: DiscountWaiver, as: "waivers" },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 ROLE-BASED JOI SCHEMAS
============================================================ */
function buildInvoiceSchema(userRole, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    organization_id: Joi.string().uuid().required(),
    facility_id: Joi.string().uuid().allow(null),
    notes: Joi.string().allow(null, ""),
    status: Joi.string().valid(...INVOICE_STATUS).default(IS.DRAFT),
    items: Joi.array().items(
      Joi.object({
        billable_item_id: Joi.string().uuid().required(),
        description: Joi.string().allow(null, ""),
        unit_price: Joi.number().positive().required(),
        quantity: Joi.number().integer().min(1).default(1),
        discount_amount: Joi.number().min(0).default(0),
        tax_amount: Joi.number().min(0).default(0),
      })
    ).min(1),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => {
      base[k] = base[k].optional();
    });
    base.reason = Joi.string().min(5).required(); // reason for update
  }

  switch (userRole) {
    case "superadmin":
      break;
    case "org_owner":
    case "admin":
    case "facility_head":
      base.organization_id = Joi.forbidden();
      break;
    default: // staff
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.forbidden();
      base.status = Joi.forbidden();
  }

  return Joi.object(base);
}

/* ============================================================
   🔹 Extra schemas for financial actions
============================================================ */
const paymentSchema = Joi.object({
  invoice_id: Joi.string().uuid().required(),
  patient_id: Joi.string().uuid().required(),   // ✅ required for consistency
  amount: Joi.number().positive().required(),
  method: Joi.string().valid(...PAYMENT_METHODS).required(),
  transaction_ref: Joi.string().allow(null, ""),
  status: Joi.forbidden(), // 🚫 only service can set this
});

const refundSchema = Joi.object({
  payment_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  reason: Joi.string().required(),
  status: Joi.forbidden(), // 🚫 enforced by service
});

const depositSchema = Joi.object({
  patient_id: Joi.string().uuid().required(),
  organization_id: Joi.string().uuid().required(),
  facility_id: Joi.string().uuid().allow(null), // ✅ optional for org-level deposits
  amount: Joi.number().positive().required(),
  method: Joi.string().required(),
  invoice_id: Joi.string().uuid().allow(null),
  status: Joi.forbidden(), // 🚫 enforced by service
});

const waiverSchema = Joi.object({
  invoice_id: Joi.string().uuid().required(),
  patient_id: Joi.string().uuid().required(),
  organization_id: Joi.string().uuid().required(),
  facility_id: Joi.string().uuid().allow(null), // ✅ optional for org-level waivers
  type: Joi.string().valid("percentage", "fixed").required(),
  value: Joi.number().positive().required(),
  reason: Joi.string().required(),
  applied_total: Joi.number().min(0).optional(), // ✅ service recalcs if missing
  status: Joi.forbidden(), // 🚫 enforced by service
});

/* ============================================================
   📌 GET ALL INVOICES (with labels, optimized)
============================================================ */
export const getAllInvoices = async (req, res) => {
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
      FIELD_VISIBILITY_INVOICE[role] || FIELD_VISIBILITY_INVOICE.staff;

    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);
    options.where = options.where || {};

    // 🔒 Org/facility scoping
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    // ✅ Direct filters
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;

    if (req.query.status) {
      const statuses = req.query.status.split(",").map(s => s.trim()).filter(Boolean);
      options.where.status = statuses.length > 1 ? { [Op.in]: statuses } : statuses[0];
    }

    // ✅ Date filters
    if (req.query["created_at[gte]"]) {
      options.where.created_at = {
        ...(options.where.created_at || {}),
        [Op.gte]: req.query["created_at[gte]"],
      };
    }
    if (req.query["created_at[lte]"]) {
      options.where.created_at = {
        ...(options.where.created_at || {}),
        [Op.lte]: req.query["created_at[lte]"],
      };
    }

    // 🔎 Unified search
    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.or] = [
        { "$patient.first_name$": { [Op.iLike]: term } },
        { "$patient.last_name$": { [Op.iLike]: term } },
        { "$patient.pat_no$": { [Op.iLike]: term } },
        { invoice_number: { [Op.iLike]: term } },
        { status: { [Op.iLike]: term } },
      ];
      options.include = options.include || [];
      if (!options.include.find(i => i.as === "patient")) {
        options.include.push({ model: Patient, as: "patient", attributes: [] });
      }
    }

    const { count, rows } = await Invoice.findAndCountAll({
      where: options.where,
      include: [...INVOICE_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    // 🔹 If ?forceRecalc=true, recalc each invoice balance
    if (req.query.forceRecalc === "true") {
      for (const r of rows) {
        await financialService.recalcInvoice(r.id);
        await r.reload();
      }
    }

    const records = rows.map(r => {
      const plain = r.get({ plain: true });

      // 🔹 normalize invoice-level numbers
      plain.subtotal = plain.subtotal != null ? parseFloat(plain.subtotal).toFixed(2) : "0.00";
      plain.total_tax = plain.total_tax != null ? parseFloat(plain.total_tax).toFixed(2) : "0.00";
      plain.total = plain.total != null ? parseFloat(plain.total).toFixed(2) : "0.00";
      plain.balance = plain.balance != null ? parseFloat(plain.balance).toFixed(2) : "0.00";

      // 🔹 normalize items
      if (plain.items) {
        plain.items = plain.items.map(it => ({
          ...it,
          subtotal: it.subtotal != null ? parseFloat(it.subtotal).toFixed(2) : "0.00",
          unit_price: it.unit_price != null ? parseFloat(it.unit_price).toFixed(2) : "0.00",
          discount_amount: it.discount_amount != null ? parseFloat(it.discount_amount).toFixed(2) : "0.00",
          tax_amount: it.tax_amount != null ? parseFloat(it.tax_amount).toFixed(2) : "0.00",
          total_price: it.total_price != null ? parseFloat(it.total_price).toFixed(2) : "0.00",
          net_amount: it.net_amount != null ? parseFloat(it.net_amount).toFixed(2) : "0.00",
        }));
      }

      const patientLabel = plain.patient
        ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
        : "Unknown Patient";
      const orgLabel = plain.organization ? plain.organization.name : "Unknown Organization";
      const facilityLabel = plain.facility ? plain.facility.name : "Unknown Facility";
      const dateLabel = plain.created_at
        ? new Date(plain.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "Unknown Date";

      return {
        ...plain,
        label: `${dateLabel} · ${patientLabel} · ${plain.invoice_number} · Bal: ${plain.balance}`,
        patient_label: patientLabel,
        organization_label: orgLabel,
        facility_label: facilityLabel,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Invoices loaded", {
      records,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load invoices", err);
  }
};


/* ============================================================
   📌 GET INVOICE BY ID (with recalc)
============================================================ */
export const getInvoiceById = async (req, res) => {
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

    // ✅ detect print context
    const isPrint = req.query.print === "true";

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    let record = await Invoice.findOne({ where, include: INVOICE_INCLUDES });
    if (!record) return error(res, "❌ Invoice not found", null, 404);

    // 🔹 Always recalc on single fetch
    await financialService.recalcInvoice(record.id);
    await record.reload({ include: INVOICE_INCLUDES });

    const plain = record.get({ plain: true });

    /* ============================================================
       🔢 Normalize invoice-level numbers
    ============================================================ */
    plain.subtotal = plain.subtotal != null ? parseFloat(plain.subtotal).toFixed(2) : "0.00";
    plain.total_tax = plain.total_tax != null ? parseFloat(plain.total_tax).toFixed(2) : "0.00";
    plain.total = plain.total != null ? parseFloat(plain.total).toFixed(2) : "0.00";
    plain.balance = plain.balance != null ? parseFloat(plain.balance).toFixed(2) : "0.00";

    /* ============================================================
       📦 Normalize items
       ✅ EXCLUDE voided items ONLY when printing
    ============================================================ */
    if (Array.isArray(plain.items)) {
      const items = isPrint
        ? plain.items.filter(it => it.status !== "voided")
        : plain.items;

      plain.items = items.map(it => ({
        ...it,
        subtotal: it.subtotal != null ? parseFloat(it.subtotal).toFixed(2) : "0.00",
        unit_price: it.unit_price != null ? parseFloat(it.unit_price).toFixed(2) : "0.00",
        discount_amount: it.discount_amount != null ? parseFloat(it.discount_amount).toFixed(2) : "0.00",
        tax_amount: it.tax_amount != null ? parseFloat(it.tax_amount).toFixed(2) : "0.00",
        total_price: it.total_price != null ? parseFloat(it.total_price).toFixed(2) : "0.00",
        net_amount: it.net_amount != null ? parseFloat(it.net_amount).toFixed(2) : "0.00",
      }));
    }

    /* ============================================================
       🏷️ Labels
    ============================================================ */
    const patientLabel = plain.patient
      ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
      : "Unknown Patient";

    plain.label = `${plain.invoice_number} · ${patientLabel} · Bal: ${plain.balance}`;
    plain.patient_label = patientLabel;
    plain.organization_label = plain.organization?.name || "Unknown Organization";
    plain.facility_label = plain.facility?.name || "Unknown Facility";

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      details: { print: isPrint },
    });

    return success(res, "✅ Invoice loaded", plain);
  } catch (err) {
    return error(res, "❌ Failed to load invoice", err);
  }
};


/* ============================================================
   📌 GET ALL INVOICES LITE (PAYABLE ONLY – MASTER)
   Used by: Payment / Deposit / Waiver forms
============================================================ */
export const getAllInvoicesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, patient_id } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { [Op.and]: [] };

    /* ================= TENANT SCOPE (MASTER) ================= */
    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (role === "facility_head") {
        where[Op.and].push({
          facility_id: req.user.facility_id,
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
          facility_id: req.query.facility_id,
        });
      }
    }

    /* ================= PAYABLE ONLY ================= */
    // 🔒 Exclude fully-paid invoices
    where[Op.and].push({
      balance: { [Op.gt]: 0 },
    });

    /* ================= PATIENT FILTER ================= */
    if (patient_id) {
      where[Op.and].push({ patient_id });
    }

    /* ================= SEARCH ================= */
    if (q) {
      const term = `%${q}%`;
      where[Op.and].push({
        [Op.or]: [
          { invoice_number: { [Op.iLike]: term } },
          { "$patient.first_name$": { [Op.iLike]: term } },
          { "$patient.last_name$": { [Op.iLike]: term } },
          { "$patient.pat_no$": { [Op.iLike]: term } },
        ],
      });
    }

    const invoices = await Invoice.findAll({
      where,
      attributes: [
        "id",
        "invoice_number",
        "status",
        "subtotal",
        "total_tax",
        "total",
        "balance",
        "created_at",
      ],
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "pat_no", "first_name", "last_name"],
        },
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name"],
        },
        {
          model: Facility,
          as: "facility",
          attributes: ["id", "name"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    const records = invoices.map((inv) => {
      const p = inv.get({ plain: true });
      const patientLabel = p.patient
        ? `${p.patient.pat_no} - ${p.patient.first_name} ${p.patient.last_name}`
        : "Unknown Patient";

      return {
        id: p.id,
        invoice_number: p.invoice_number,
        status: p.status,
        subtotal: parseFloat(p.subtotal || 0).toFixed(2),
        total_tax: parseFloat(p.total_tax || 0).toFixed(2),
        total: parseFloat(p.total || 0).toFixed(2),
        balance: parseFloat(p.balance || 0).toFixed(2),
        patient_id: p.patient?.id || null,
        patient_label: patientLabel,
        organization_label: p.organization?.name || null,
        facility_label: p.facility?.name || null,
        created_at: p.created_at,
        label: `${p.invoice_number} · ${patientLabel} · Bal: ${parseFloat(
          p.balance || 0
        ).toFixed(2)}`,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: records.length,
        query: q || null,
        patient_id: patient_id || null,
      },
    });

    return success(res, "✅ Invoices loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load invoices (lite)", err);
  }
};


/* ============================================================
   📌 GET INVOICE ITEMS LITE (for dropdowns when applying discounts)
   Endpoint: GET /api/lite/invoices/:id/items
============================================================ */
export const getInvoiceItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY, // still "invoice"
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params; // invoice_id
    const { q } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    // 🔒 Scope check
    const whereInvoice = { id };
    if (!isSuperAdmin(req.user)) {
      whereInvoice.organization_id = req.user.organization_id;
      if (role === "facility_head") whereInvoice.facility_id = req.user.facility_id;
    }

    const invoice = await Invoice.findOne({ where: whereInvoice });
    if (!invoice) return error(res, "❌ Invoice not found", null, 404);

    // 🔍 Item filtering
    const whereItem = { invoice_id: id };
    if (q) {
      const term = `%${q}%`;
      whereItem[Op.or] = [
        { description: { [Op.iLike]: term } },
        sequelize.where(
          sequelize.cast(sequelize.col("InvoiceItem.status"), "text"),
          { [Op.iLike]: term }
        ),
      ];
    }

    const items = await InvoiceItem.findAll({
      where: whereItem,
      attributes: [
        "id",
        "description",
        "unit_price",
        "quantity",
        "discount_amount",
        "tax_amount",
        "total_price",
        "net_amount",
        "status",
      ],
      order: [["created_at", "DESC"]],
    });

    const result = items.map((it) => {
      const plain = it.get({ plain: true });
      return {
        id: plain.id,
        description: plain.description || "Unnamed Item",
        unit_price: plain.unit_price,
        quantity: plain.quantity,
        discount_amount: plain.discount_amount,
        tax_amount: plain.tax_amount,
        total_price: plain.total_price,
        net_amount: plain.net_amount,
        status: plain.status,
        // ✅ Compact label for dropdowns
        label: `${plain.description || "Item"} · Qty ${plain.quantity} · ${plain.net_amount}`,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_items_lite",
      entityId: id,
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Invoice items loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load invoice items (lite)", err);
  }
};


/* ============================================================
   📌 UPDATE INVOICE (limited fields)
============================================================ */
export const updateInvoice = async (req, res) => {
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildInvoiceSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Invoice.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Invoice not found", null, 404);
    }

    // Restrict locked/finalized invoices
    if (record.is_locked || [IS.PAID, IS.CANCELLED, IS.VOIDED].includes(record.status)) {
      await t.rollback();
      return error(res, "❌ Cannot update a locked or finalized invoice", null, 400);
    }

    await record.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Invoice.findOne({ where: { id }, include: INVOICE_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Invoice updated", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update invoice", err);
  }
};

/* ============================================================
   💵 APPLY PAYMENT
============================================================ */
export const applyPayment = async (req, res) => {
  try {
    const { error: validationError, value } = paymentSchema.validate(req.body, { stripUnknown: true });
    if (validationError) return error(res, "Validation failed", validationError, 400);

    const { payment, invoice } = await financialService.applyPayment({ ...value, user: req.user });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "apply_payment",
      entityId: payment.id,
      entity: payment,
      details: value,
    });

    return success(res, "✅ Payment applied", { payment, invoice });
  } catch (err) {
    return error(res, "❌ Failed to apply payment", err);
  }
};

/* ============================================================
   🔄 APPLY REFUND
============================================================ */
export const applyRefund = async (req, res) => {
  try {
    const { error: validationError, value } = refundSchema.validate(req.body, { stripUnknown: true });
    if (validationError) return error(res, "Validation failed", validationError, 400);

    const { refund, invoice } = await financialService.applyRefund({ ...value, user: req.user });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "apply_refund",
      entityId: refund.id,
      entity: refund,
      details: value,
    });

    return success(res, "✅ Refund applied", { refund, invoice });
  } catch (err) {
    return error(res, "❌ Failed to apply refund", err);
  }
};

/* ============================================================
   💰 APPLY DEPOSIT
============================================================ */
export const applyDeposit = async (req, res) => {
  try {
    const { error: validationError, value } = depositSchema.validate(req.body, { stripUnknown: true });
    if (validationError) return error(res, "Validation failed", validationError, 400);

    const { deposit, invoice } = await financialService.applyDeposit({ ...value, user: req.user });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "apply_deposit",
      entityId: deposit.id,
      entity: deposit,
      details: value,
    });

    return success(res, "✅ Deposit recorded", { deposit, invoice });
  } catch (err) {
    return error(res, "❌ Failed to apply deposit", err);
  }
};

/* ============================================================
   🎟️ APPLY WAIVER
============================================================ */
export const applyWaiver = async (req, res) => {
  try {
    const { error: validationError, value } = waiverSchema.validate(req.body, { stripUnknown: true });
    if (validationError) return error(res, "Validation failed", validationError, 400);

    const { waiver, invoice } = await financialService.applyWaiver({ ...value, user: req.user });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "apply_waiver",
      entityId: waiver.id,
      entity: waiver,
      details: value,
    });

    return success(res, "✅ Waiver applied", { waiver, invoice });
  } catch (err) {
    return error(res, "❌ Failed to apply waiver", err);
  }
};

/* ============================================================
   ❌ REVERSE TRANSACTION (any type)
============================================================ */
export const reverseTransaction = async (req, res) => {
  try {
    const { type, id, reason } = req.body;
    if (!["payment", "refund", "deposit", "waiver"].includes(type)) {
      return error(res, "❌ Invalid reversal type", null, 400);
    }

    const result = await financialService.reverseTransaction({ type, id, user: req.user });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reverse_transaction",
      entityId: id,
      entity: result,
      details: { type, reason: reason || "manual reversal" },
    });

    return success(res, result.message, result);
  } catch (err) {
    return error(res, "❌ Failed to reverse transaction", err);
  }
};
/* ============================================================
   📌 TOGGLE INVOICE STATUS (draft ↔ issued)
============================================================ */
export const toggleInvoiceStatus = async (req, res) => {
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
    const record = await Invoice.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Invoice not found", null, 404);
    }

    const oldStatus = record.status;
    let newStatus = oldStatus;

    // 🔹 Only allow toggling between Draft ↔ Issued
    if (oldStatus === IS.DRAFT) newStatus = IS.ISSUED;
    else if (oldStatus === IS.ISSUED) newStatus = IS.DRAFT;

    // ✅ Update only if status actually changes
    if (newStatus !== oldStatus) {
      await record.update(
        { status: newStatus, updated_by_id: req.user?.id || null },
        { transaction: t }
      );
    }

    await t.commit();

    const full = await Invoice.findOne({ where: { id }, include: INVOICE_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: newStatus, changed: newStatus !== oldStatus },
    });

    const msg =
      newStatus !== oldStatus
        ? `✅ Invoice status changed from ${oldStatus} → ${newStatus}`
        : `ℹ️ Invoice status left unchanged (${oldStatus})`;

    return success(res, msg, full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to toggle invoice status", err);
  }
};
