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
  InsuranceClaim,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import {
  INVOICE_STATUS,
  PAYMENT_METHODS, CURRENCY,
} from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { FIELD_VISIBILITY_INVOICE } from "../constants/fieldVisibility.js";

import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";

const MODULE_KEY = "invoices";

// 🔖 Local enum map for readability
const IS = INVOICE_STATUS;

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
  {  model: InsuranceClaim, as: "insuranceClaim", attributes: [ "id", "claim_number", "amount_claimed", "amount_approved", "status", ],},
];

/* ============================================================
   📋 ROLE-BASED JOI SCHEMAS (FINAL — CURRENCY SAFE)
============================================================ */
function buildInvoiceSchema(userRole, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),

    // 💱 REQUIRED (CRITICAL FIX)
    currency: Joi.string()
      .valid(...Object.values(CURRENCY))
      .required(),

    organization_id: Joi.string().uuid().required(),
    facility_id: Joi.string().uuid().allow(null),

    notes: Joi.string().allow(null, ""),

    status: Joi.string()
      .valid(...Object.values(INVOICE_STATUS))
      .default(IS.DRAFT),

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

    // 🔒 Require reason for audit
    base.reason = Joi.string().min(5).required();
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
   🔹 Extra schemas for financial actions (CURRENCY SAFE)
============================================================ */

/* ================= PAYMENT ================= */
const paymentSchema = Joi.object({
  invoice_id: Joi.string().uuid().required(),
  patient_id: Joi.string().uuid().required(),

  amount: Joi.number().positive().required(),

  method: Joi.string()
    .valid(...Object.values(PAYMENT_METHODS))
    .required(),

  // 💱 ADD (for dual currency safety)
  currency: Joi.string()
    .valid(...Object.values(CURRENCY))
    .required(),

  transaction_ref: Joi.string().allow(null, ""),
  status: Joi.forbidden(),
});

/* ================= REFUND ================= */
const refundSchema = Joi.object({
  payment_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  reason: Joi.string().required(),

  // 💱 OPTIONAL (depends on system design — safe to include)
  currency: Joi.string()
    .valid(...Object.values(CURRENCY))
    .optional(),

  status: Joi.forbidden(),
});

/* ================= DEPOSIT ================= */
const depositSchema = Joi.object({
  patient_id: Joi.string().uuid().required(),
  organization_id: Joi.string().uuid().required(),
  facility_id: Joi.string().uuid().allow(null),

  amount: Joi.number().positive().required(),
  method: Joi.string().required(),

  // 💱 CRITICAL FIX
  currency: Joi.string()
    .valid(...Object.values(CURRENCY))
    .required(),

  invoice_id: Joi.string().uuid().allow(null),
  status: Joi.forbidden(),
});

/* ================= WAIVER ================= */
const waiverSchema = Joi.object({
  invoice_id: Joi.string().uuid().required(),
  patient_id: Joi.string().uuid().required(),
  organization_id: Joi.string().uuid().required(),
  facility_id: Joi.string().uuid().allow(null),

  type: Joi.string().valid("percentage", "fixed").required(),
  value: Joi.number().positive().required(),
  reason: Joi.string().required(),

  // 💱 OPTIONAL (safe for audit consistency)
  currency: Joi.string()
    .valid(...Object.values(CURRENCY))
    .optional(),

  applied_total: Joi.number().min(0).optional(),
  status: Joi.forbidden(),
});

/* ============================================================
   📌 GET ALL INVOICES (MASTER-ALIGNED — FINAL FIXED)
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

    /* ================= PAGINATION ================= */
    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_INVOICE[role] || FIELD_VISIBILITY_INVOICE.staff;

    /* ================= SAFE QUERY (MASTER PARITY) ================= */
    const { dateRange, ...safeQuery } = req.query;

    safeQuery.limit = limit;
    safeQuery.page = page;

    req.query = safeQuery;

    const options = buildQueryOptions(
      req,
      "created_at",
      "DESC",
      visibleFields
    );

    options.where = { [Op.and]: [] };
    options.include = options.include || [];

    /* ================= DATE RANGE ================= */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }

    /* ================= TENANT ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (role === "facility_head") {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }

      if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
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

    /* ================= FILTERS ================= */

    if (req.query.patient_id) {
      options.where[Op.and].push({
        patient_id: req.query.patient_id,
      });
    }

    if (req.query.status) {
      const statuses = req.query.status
        .split(",")
        .map((s) => IS[s.trim().toUpperCase()] || s.trim())
        .filter(Boolean);

      options.where[Op.and].push({
        status:
          statuses.length > 1
            ? { [Op.in]: statuses }
            : statuses[0],
      });
    }

    if (req.query.currency) {
      options.where[Op.and].push({
        currency: req.query.currency,
      });
    }

    if (req.query.payer_type) {
      options.where[Op.and].push({
        payer_type: req.query.payer_type,
      });
    }

    if (req.query.invoice_number) {
      options.where[Op.and].push({
        invoice_number: req.query.invoice_number,
      });
    }

    if (req.query.is_locked !== undefined) {
      options.where[Op.and].push({
        is_locked: req.query.is_locked === "true",
      });
    }

    if (req.query.invoice_date) {
      options.where[Op.and].push({
        invoice_date: req.query.invoice_date,
      });
    }

    if (req.query.due_date) {
      options.where[Op.and].push({
        due_date: req.query.due_date,
      });
    }

    /* ================= SEARCH ================= */
    if (options.search) {
      const term = `%${options.search}%`;

      options.where[Op.and].push({
        [Op.or]: [
          { "$patient.first_name$": { [Op.iLike]: term } },
          { "$patient.last_name$": { [Op.iLike]: term } },
          { "$patient.pat_no$": { [Op.iLike]: term } },
          { invoice_number: { [Op.iLike]: term } },
          { status: { [Op.iLike]: term } },
          { payer_type: { [Op.iLike]: term } },
        ],
      });

      const allIncludes = [
        ...INVOICE_INCLUDES,
        ...(options.include || []),
      ];

      const hasPatient = allIncludes.some((i) => i.as === "patient");

      if (!hasPatient) {
        options.include.push({
          model: Patient,
          as: "patient",
          attributes: [],
        });
      }
    }

    /* ================= MAIN QUERY ================= */
    const { count, rows } = await Invoice.findAndCountAll({
      where: options.where,
      include: [...INVOICE_INCLUDES, ...options.include],
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    /* ================= SUMMARY ================= */
    const summary = { total: count };

    const statusCounts = await Invoice.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    Object.values(IS).forEach((status) => {
      const found = statusCounts.find((s) => s.status === status);
      summary[status] = found ? Number(found.get("count")) : 0;
    });

    const totals = await Invoice.findAll({
      where: options.where,
      attributes: [
        [sequelize.fn("SUM", sequelize.col("total")), "total"],
        [sequelize.fn("SUM", sequelize.col("balance")), "balance"],
        [sequelize.fn("SUM", sequelize.col("total_paid")), "paid"],
      ],
      raw: true,
    });

    summary.financials = totals[0] || {};

    /* ================= FORCE RECALC ================= */
    if (req.query.forceRecalc === "true") {
      for (const r of rows) {
        await financialService.recalcInvoice(r.id);
        await r.reload();
      }
    }

    /* ================= FORMAT ================= */
    const records = rows.map((r) => {
      const plain = r.get({ plain: true });

      const currency = plain.currency || CURRENCY.LRD;

      const subtotal = parseFloat(plain.subtotal || 0).toFixed(2);
      const total_tax = parseFloat(plain.total_tax || 0).toFixed(2);
      const total = parseFloat(plain.total || 0).toFixed(2);
      const balance = parseFloat(plain.balance || 0).toFixed(2);

      const patientLabel = plain.patient
        ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
        : "Unknown Patient";

      const dateLabel = plain.created_at
        ? new Date(plain.created_at).toLocaleDateString()
        : "Unknown Date";

      return {
        ...plain,
        currency,
        subtotal,
        total_tax,
        total,
        balance,
        label: `${dateLabel} · ${patientLabel} · ${plain.invoice_number} · ${currency} · Bal: ${balance}`,
        patient_label: patientLabel,
        organization_label: plain.organization?.name || "",
        facility_label: plain.facility?.name || "",
      };
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        query: req.query,
        returned: count,
        pagination: { page, limit },
      },
    });

    return success(res, "✅ Invoices loaded", {
      records,
      summary,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error("❌ getAllInvoices FAILED:", err);
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
    const currency = plain.currency || CURRENCY.LRD;
    plain.currency = currency;
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
        ? plain.items.filter(it => it.status !== IS.VOIDED)
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

    plain.label = `${plain.invoice_number} · ${patientLabel} · ${plain.currency} · Bal: ${plain.balance}`;
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
   📌 GET ALL INVOICES LITE (PAYABLE ONLY – MASTER — FINAL FIXED)
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

    /* ================= TENANT SCOPE ================= */
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
    where[Op.and].push({
      balance: { [Op.gt]: 0 },
    });

    /* ================= PATIENT ================= */
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
        "currency", // 💱 FIX: include currency
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

      const currency = p.currency || CURRENCY.LRD; // 💱 safe fallback

      const subtotal = parseFloat(p.subtotal || 0).toFixed(2);
      const total_tax = parseFloat(p.total_tax || 0).toFixed(2);
      const total = parseFloat(p.total || 0).toFixed(2);
      const balance = parseFloat(p.balance || 0).toFixed(2);

      const patientLabel = p.patient
        ? `${p.patient.pat_no} - ${p.patient.first_name} ${p.patient.last_name}`
        : "Unknown Patient";

      return {
        id: p.id,
        invoice_number: p.invoice_number,
        status: p.status,
        currency, // 💱 exposed

        subtotal,
        total_tax,
        total,
        balance,

        patient_id: p.patient?.id || null,
        patient_label: patientLabel,

        organization_label: p.organization?.name || null,
        facility_label: p.facility?.name || null,

        created_at: p.created_at,

        label: `${p.invoice_number} · ${patientLabel} · ${currency} · Bal: ${balance}`, // 💱 fixed label
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
   📌 GET INVOICE ITEMS LITE (FINAL FIXED — SAFE)
============================================================ */
export const getInvoiceItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const { q } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    /* ================= TENANT CHECK ================= */
    const whereInvoice = { id };

    if (!isSuperAdmin(req.user)) {
      whereInvoice.organization_id = req.user.organization_id;

      if (role === "facility_head") {
        whereInvoice.facility_id = req.user.facility_id;
      }
    }

    const invoice = await Invoice.findOne({ where: whereInvoice });

    if (!invoice) {
      return error(res, "❌ Invoice not found", null, 404);
    }

    /* ================= ITEM FILTER ================= */
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

      const net = parseFloat(plain.net_amount || 0).toFixed(2);

      return {
        id: plain.id,
        description: plain.description || "Unnamed Item",
        unit_price: parseFloat(plain.unit_price || 0).toFixed(2),
        quantity: plain.quantity,
        discount_amount: parseFloat(plain.discount_amount || 0).toFixed(2),
        tax_amount: parseFloat(plain.tax_amount || 0).toFixed(2),
        total_price: parseFloat(plain.total_price || 0).toFixed(2),
        net_amount: net,
        status: plain.status,

        // ✅ clean + safe label
        label: `${plain.description || "Item"} · Qty ${plain.quantity} · ${net}`,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_items_lite",
      entityId: id,
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Invoice items loaded (lite)", {
      records: result,
    });
  } catch (err) {
    return error(res, "❌ Failed to load invoice items (lite)", err);
  }
};

/* ============================================================
   📌 UPDATE INVOICE (FINAL — SAFE)
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
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Invoice.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Invoice not found", null, 404);
    }

    /* ================= LOCK PROTECTION ================= */
    if (
      record.is_locked ||
      [IS.PAID, IS.CANCELLED, IS.VOIDED].includes(record.status)
    ) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot update a locked or finalized invoice",
        null,
        400
      );
    }

    /* ================= 🔒 PROTECT CURRENCY ================= */
    if ("currency" in value) {
      delete value.currency;
    }

    await record.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Invoice.findOne({
      where: { id },
      include: INVOICE_INCLUDES,
    });

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
   💵 APPLY PAYMENT (FINAL — SAFE + CURRENCY LOCKED)
============================================================ */
export const applyPayment = async (req, res) => {
  try {
    const { error: validationError, value } = paymentSchema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      return error(res, "Validation failed", validationError, 400);
    }

    /* ================= 💱 CURRENCY CHECK ================= */
    const invoice = await Invoice.findByPk(value.invoice_id);

    if (!invoice) {
      return error(res, "❌ Invoice not found", null, 404);
    }

    if (value.currency !== invoice.currency) {
      return error(
        res,
        "❌ Currency mismatch with invoice",
        null,
        400
      );
    }

    /* ================= APPLY PAYMENT ================= */
    const { payment, invoice: updatedInvoice } =
      await financialService.applyPayment({
        ...value,
        user: req.user,
      });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "apply_payment",
      entityId: payment.id,
      entity: payment,
      details: value,
    });

    return success(res, "✅ Payment applied", {
      payment,
      invoice: updatedInvoice,
    });
  } catch (err) {
    return error(res, "❌ Failed to apply payment", err);
  }
};

/* ============================================================
   🔄 APPLY REFUND (FINAL — SAFE + CURRENCY LOCKED)
============================================================ */
export const applyRefund = async (req, res) => {
  try {
    const { error: validationError, value } = refundSchema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      return error(res, "Validation failed", validationError, 400);
    }

    /* ================= 💱 CURRENCY CHECK ================= */
    const payment = await Payment.findByPk(value.payment_id);

    if (!payment) {
      return error(res, "❌ Payment not found", null, 404);
    }

    // If currency is provided, enforce match
    if (value.currency && value.currency !== payment.currency) {
      return error(
        res,
        "❌ Currency mismatch with payment",
        null,
        400
      );
    }

    /* ================= APPLY REFUND ================= */
    const { refund, invoice } = await financialService.applyRefund({
      ...value,
      user: req.user,
    });

    /* ================= AUDIT ================= */
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
   💰 APPLY DEPOSIT (FINAL — SAFE)
============================================================ */
export const applyDeposit = async (req, res) => {
  try {
    const { error: validationError, value } = depositSchema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      return error(res, "Validation failed", validationError, 400);
    }

    /* ================= 💱 CURRENCY CHECK ================= */
    if (value.invoice_id) {
      const invoice = await Invoice.findByPk(value.invoice_id);

      if (!invoice) {
        return error(res, "❌ Invoice not found", null, 404);
      }

      if (value.currency !== invoice.currency) {
        return error(
          res,
          "❌ Currency mismatch with invoice",
          null,
          400
        );
      }
    }

    const { deposit, invoice } = await financialService.applyDeposit({
      ...value,
      user: req.user,
    });

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
   🎟️ APPLY WAIVER (FINAL — SAFE)
============================================================ */
export const applyWaiver = async (req, res) => {
  try {
    const { error: validationError, value } = waiverSchema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      return error(res, "Validation failed", validationError, 400);
    }

    const { waiver, invoice } = await financialService.applyWaiver({
      ...value,
      user: req.user,
    });

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
   ❌ REVERSE TRANSACTION (FINAL — FIXED)
============================================================ */
export const reverseTransaction = async (req, res) => {
  try {
    const { type, id, reason } = req.body;

    if (!["payment", "refund", "deposit", "waiver"].includes(type)) {
      return error(res, "❌ Invalid reversal type", null, 400);
    }

    const result = await financialService.reverseTransaction({
      type,
      id,
      reason, // ✅ FIX: pass reason
      user: req.user,
    });

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
   📌 TOGGLE INVOICE STATUS (FINAL — SAFE)
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

    /* ================= 🔒 LOCK PROTECTION ================= */
    if (record.is_locked) {
      await t.rollback();
      return error(res, "❌ Cannot modify locked invoice", null, 400);
    }

    const oldStatus = record.status;
    let newStatus = oldStatus;

    /* ================= STATUS TOGGLE ================= */
    if (oldStatus === IS.DRAFT) newStatus = IS.ISSUED;
    else if (oldStatus === IS.ISSUED) newStatus = IS.DRAFT;

    if (newStatus !== oldStatus) {
      await record.update(
        {
          status: newStatus,
          updated_by_id: req.user?.id || null,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const full = await Invoice.findOne({
      where: { id },
      include: INVOICE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: {
        from: oldStatus,
        to: newStatus,
        changed: newStatus !== oldStatus,
      },
    });

    const msg =
      newStatus !== oldStatus
        ? `✅ Invoice status changed from ${oldStatus} → ${newStatus}`
        : `ℹ️ Invoice status unchanged (${oldStatus})`;

    return success(res, msg, full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to toggle invoice status", err);
  }
};