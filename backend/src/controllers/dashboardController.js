// 📁 backend/src/controllers/dashboardController.js – Enterprise Compact Edition
// ============================================================================
// 🔹 Dynamic Dashboard Controller (Unified Enterprise Pattern)
// 🔹 Includes KPIs, Trendlines, Monthly Charts, Queues, Alerts, and Caching
// 🔹 Fully permission-synchronized with FeatureAccess for consistent visibility
// 🔹 Includes audit logs for module/access mapping & payload summary
// ============================================================================

import { Op, fn, col, literal } from "sequelize";
import {
  Appointment, LabRequest, Admission, Prescription, Payment, FeatureModule,
  FeatureAccess, Patient, LabRequestItem, BillableItem, Consultation,
  DeliveryRecord, Deposit, Discount, DiscountWaiver, UltrasoundRecord,
  EKGRecord, Surgery, MaternityVisit, CentralStock, DepartmentStock,
  Employee, Facility, Department, PharmacyTransaction, RegistrationLog,
  Invoice, LabResult, Recommendation, TriageRecord, MedicalRecord,
  NewbornRecord, Vital, Supplier, Organization, Role, User, MasterItem,
  Refund, AutoBillingRule, MasterItemCategory, StockAdjustment,
  StockReturn, StockLedger, StockRequest
} from "../models/index.js";

import {
  APPOINTMENT_STATUS, LAB_REQUEST_STATUS, ADMISSION_STATUS, PRESCRIPTION_STATUS,
  PAYMENT_STATUS, CONSULTATION_STATUS, DELIVERY_STATUS, TRIAGE_STATUS,
  VITAL_STATUS, RECOMMENDATION_STATUS, MEDICAL_RECORD_STATUS, DEPOSIT_STATUS,
  DISCOUNT_STATUS, DISCOUNT_WAIVER_STATUS, ULTRASOUND_STATUS, EKG_STATUS,
  SURGERY_STATUS, MATERNITY_VISIT_STATUS, CENTRAL_STOCK_STATUS,
  DEPARTMENT_STOCK_STATUS, STOCK_ADJUSTMENT_STATUS, STOCK_RETURN_STATUS,
  STOCK_REQUEST_STATUS, MASTER_ITEM_STATUS, MASTER_ITEM_CATEGORY_STATUS,
  PHARMACY_TRANSACTION_STATUS, SUPPLIER_STATUS, EMPLOYEE_STATUS,
  FACILITY_STATUS, DEPARTMENT_STATUS, ORG_STATUS, ROLE_STATUS, USER_STATUS,
  FEATURE_MODULE_STATUS, FEATURE_ACCESS_STATUS, REGISTRATION_LOG_STATUS,
  INVOICE_STATUS, LAB_RESULT_STATUS, REFUND_STATUS, AUTO_BILLING_RULE_STATUS,
  BILLABLE_ITEM_STATUS
} from "../constants/enums.js";
import { normalizeDateOnly } from "../utils/date-utils.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

import { logger } from "../utils/logger.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (THIS FILE ONLY)
   true  = debug ON for dashboard
   false = debug OFF for dashboard
============================================================ */
const DEBUG_OVERRIDE = true; // 👈 usually OFF
const debug = makeModuleLogger("dashboard", DEBUG_OVERRIDE);


const resolveTotal = summary =>
  summary.total ??
  summary.total_payments ??
  summary.total_transactions ??
  summary.total_waivers ??
  summary.total_refunds ??
  0;

/* ============================================================
   🧠 Cache (15 s TTL)
============================================================ */
const cache = new Map();
const TTL = 15_000;
const getCache = key => {
  const entry = cache.get(key);
  return !entry || Date.now() - entry.time > TTL ? null : entry.data;
};
const setCache = (key, data) => cache.set(key, { data, time: Date.now() });

// 🔥 FULL REPLACE — FIXES StockLedger.deleted_at ERROR

/* ============================================================
   🔹 Tenant Filter Helper (DB-DRIVEN, FINAL, SAFE)
   ❌ NO deleted_at here (model-agnostic)
   ✅ Soft-delete handled ONLY inside summaryHelper
============================================================ */
const buildTenantWhere = ({
  module,
  orgId,
  facilities,
  start,
  end,
}) => {
  const where = {};

  /* ⏱️ Date filter */
  if (start && end) {
    where.created_at = {
      [Op.gte]: new Date(`${start}T00:00:00Z`),
      [Op.lte]: new Date(`${end}T23:59:59Z`),
    };
  }

  /* 🌍 GLOBAL MODULE */
  if (module.tenant_scope === "global") {
    return where;
  }

  /* 👑 SuperAdmin without org → cross-tenant */
  if (!orgId) {
    return where;
  }

  /* 🏢 Org scope */
  where.organization_id = orgId;

  /* 🏥 Facility scope */
  if (module.tenant_scope === "facility" && facilities?.length) {
    where.facility_id = { [Op.in]: facilities };
  }

  return where;
};


/* ============================================================
   📈 CHART BUILDERS (DB-DRIVEN)
============================================================ */
const CHART_BUILDERS = {
  appointments: {
    label: "Appointments by Month",
    type: "bar",
    model: Appointment,
  },
  lab_requests: {
    label: "Lab Requests by Month",
    type: "line",
    model: LabRequest,
  },
  patients: {
    label: "Patients Registered by Month",
    type: "line",
    model: Patient,
  },
};

/* ============================================================
   🔹 KPI HANDLERS (ULTRA-COMPACT)
============================================================ */
const K = (modelKey, model, statusEnums, aggregates) =>
  (where, allowCrossTenant = false) =>
    buildDynamicSummary({
      model,
      options: {
        where,
        allowCrossTenant, // ✅ CRITICAL FIX
      },
      ...(statusEnums && { statusEnums }),
      ...(aggregates && { aggregates }),
    });

const KPI_HANDLERS = {
  // 🩺 Core Clinical
  appointments: K("appointments", Appointment, APPOINTMENT_STATUS),
  lab_requests: K("lab_requests", LabRequest, LAB_REQUEST_STATUS),
  admissions: K("admissions", Admission, ADMISSION_STATUS),
  prescriptions: K("prescriptions", Prescription, PRESCRIPTION_STATUS, { total_value: fn("SUM", col("total_cost")) }),
  payments: K("payments", Payment, PAYMENT_STATUS, { total_amount: fn("SUM", col("amount")), avg_amount: fn("AVG", col("amount")) }),
  consultations: K("consultations", Consultation, CONSULTATION_STATUS),
  deliveries: K("deliveries", DeliveryRecord, DELIVERY_STATUS),
  deposits: K("deposits", Deposit, DEPOSIT_STATUS, { total_value: fn("SUM", col("amount")) }),
  discounts: K("discounts", Discount, DISCOUNT_STATUS, { total_value: fn("SUM", col("value")) }),
  discount_waivers: K("discount_waivers", DiscountWaiver, DISCOUNT_WAIVER_STATUS, { total_value: fn("SUM", col("amount")) }),
  ultrasound_records: K("ultrasound_records", UltrasoundRecord, ULTRASOUND_STATUS),
  ekg_records: K("ekg_records", EKGRecord, EKG_STATUS),
  maternity_visits: K("maternity_visits", MaternityVisit, MATERNITY_VISIT_STATUS),
  surgeries: K("surgeries", Surgery, SURGERY_STATUS, { total_value: fn("SUM", col("cost_override")) }),
  lab_results: K("lab_results", LabResult, LAB_RESULT_STATUS),
  registration_logs: K("registration_logs", RegistrationLog, REGISTRATION_LOG_STATUS),

  // 🏥 Clinical Extensions
  patients: K("patients", Patient),
  recommendations: K("recommendations", Recommendation),
  triage_records: K("triage_records", TriageRecord, TRIAGE_STATUS),
  medical_records: K("medical_records", MedicalRecord, MEDICAL_RECORD_STATUS),
  newborn_records: K("newborn_records", NewbornRecord),
  vitals: K("vitals", Vital),

  // 🏢 Admin & Support
  suppliers: K("suppliers", Supplier),
  organizations: K("organizations", Organization),
  roles: K("roles", Role),
  users: K("users", User),
  feature_modules: K("feature_modules", FeatureModule),
  feature_accesses: K("feature_accesses", FeatureAccess),
  master_items: K("master_items", MasterItem),
  master_item_categories: K("master_item_categories", MasterItemCategory),

  // 💳 Billing & Finance
  refunds: K("refunds", Refund),
  auto_billing_rules: K("auto_billing_rules", AutoBillingRule),
  invoices: K("invoices", Invoice, INVOICE_STATUS, { total_value: fn("SUM", col("total")) }),
  billable_items: K("billable_items", BillableItem, BILLABLE_ITEM_STATUS),

  // 🧱 Inventory
  facilities: K("facilities", Facility, FACILITY_STATUS),
  departments: K("departments", Department, DEPARTMENT_STATUS),
  employees: K("employees", Employee, EMPLOYEE_STATUS),
  pharmacy_transactions: K("pharmacy_transactions", PharmacyTransaction, PHARMACY_TRANSACTION_STATUS, { total_quantity: fn("SUM", col("quantity_dispensed")) }),
  central_stocks: K("central_stocks", CentralStock, Object.values(CENTRAL_STOCK_STATUS), { total_quantity: fn("SUM", col("quantity")) }),
  department_stocks: K("department_stocks", DepartmentStock, Object.values(DEPARTMENT_STOCK_STATUS), { total_quantity: fn("SUM", col("quantity")) }),
  stock_adjustments: K("stock_adjustments", StockAdjustment),
  stock_returns: K("stock_returns", StockReturn),
  stock_ledger: K("stock_ledger", StockLedger),
  stock_requests: K("stock_requests", StockRequest),
};


/* ============================================================
   🔹 Trendline Helper (SAFE + COMPACT + DATE-ONLY)
============================================================ */
const buildTrendSeries = async (model, where, start, end) => {
  // 🔒 Normalize inputs (DATE-ONLY → Date objects)
  const startDate = new Date(`${start}T00:00:00`);
  const endDate   = new Date(`${end}T23:59:59`);

  // 🧠 Decide granularity
  const daySpan = Math.ceil((endDate - startDate) / 864e5);
  const unit = daySpan > 45 ? "week" : "day";

  // 📊 Fetch aggregated rows
  const rows = await model.findAll({
    where,
    attributes: [
      [fn("date_trunc", unit, col("created_at")), "p"],
      [fn("COUNT", col("id")), "c"],
    ],
    group: ["p"],
    order: [[literal("p"), "ASC"]],
    raw: true,
  });

  // 🧭 Map results → DATE-ONLY keys
  const map = Object.fromEntries(
    rows.map(r => {
      const d = new Date(r.p);
      const key =
        unit === "week"
          ? d.toISOString().slice(0, 7)   // YYYY-MM
          : d.toISOString().slice(0, 10); // YYYY-MM-DD
      return [key, Number(r.c)];
    })
  );

  // 🔁 Fill missing dates/weeks with 0
  const trend = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const key =
      unit === "week"
        ? cursor.toISOString().slice(0, 7)
        : cursor.toISOString().slice(0, 10);

    trend.push(map[key] || 0);

    // ⏭️ Advance cursor
    if (unit === "week") {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return trend;
};

/* ============================================================
   🔹 Monthly Chart Helper (SAFE + COMPACT)
============================================================ */
const buildMonthlySeries = async (model, where) =>
  (await model.findAll({
    where,
    attributes: [
      [fn("date_trunc", "month", col("created_at")), "m"],
      [fn("COUNT", col("id")), "c"],
    ],
    group: ["m"],
    order: [[fn("date_trunc", "month", col("created_at")), "ASC"]],
    raw: true,
  })).map(r => ({
    label: r.m.toISOString().slice(0, 7), // YYYY-MM
    value: Number(r.c),
  }));

const CROSS_TENANT_MODULES = [
  "payments",
  "refunds",
  "invoices",
  "deposits",
  "discount_waivers",
  "discounts",
  "pharmacy_transactions",
];

/* ============================================================
   📊 MAIN CONTROLLER (DB-DRIVEN, ENTERPRISE-FINAL)
============================================================ */
export const getDashboardData = async (req, res) => {
  try {
    const {
      roles = [],
      facility_ids = [],
      organization_id,
    } = req.user || {};

    const orgId =
      typeof organization_id === "string"
        ? organization_id
        : organization_id?.id || null;

    const facilityIds = Array.isArray(facility_ids)
      ? facility_ids
          .map(f => (typeof f === "string" ? f : f?.id))
          .filter(Boolean)
      : [];

    const { start_date, end_date, light } = req.query;

    const start =
      normalizeDateOnly(start_date) ||
      normalizeDateOnly(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      );

    const end =
      normalizeDateOnly(end_date) ||
      normalizeDateOnly(new Date());

    const cacheKey = `${orgId || "global"}-${facilityIds.join(",")}-${start}-${end}-${light ? "L" : "F"}`;

    const cached = getCache(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const isSuperAdmin = roles.some(r =>
      ["super admin", "superadmin"].includes((r.name || "").toLowerCase())
    );

    const modules = await FeatureModule.findAll({
      include: [{
        model: FeatureAccess,
        as: "access",
        required: false,
        where: {
          role_id: { [Op.in]: roles.map(r => r.id) },
          ...(orgId && { organization_id: orgId }),
          ...(facilityIds.length && { facility_id: { [Op.in]: facilityIds } }),
          status: "active",
        },
      }],
      where: {
        enabled: true,
        status: "active",
        deleted_at: null,
        ...(isSuperAdmin ? {} : { "$access.id$": { [Op.ne]: null } }),
      },
      order: [["dashboard_order", "ASC"]],
      raw: true,
    });

    const dashboardModules = modules
      .filter(m => isSuperAdmin || m.show_on_dashboard === true)
      .sort((a, b) => a.dashboard_order - b.dashboard_order);

    const kpis = [];

    for (const mod of dashboardModules) {
      const handler = KPI_HANDLERS[mod.key];
      if (!handler) continue;

      if (
        ["global_kpi", "global_chart"].includes(mod.dashboard_type) &&
        mod.tenant_scope !== "global"
      ) continue;

      const isCrossTenant =
        isSuperAdmin && CROSS_TENANT_MODULES.includes(mod.key);

      const where = buildTenantWhere({
        module: mod,
        orgId: isCrossTenant ? null : orgId,
        facilities: facilityIds,
        start,
        end,
      });

      const summary = await handler(where, isCrossTenant);
      if (!summary || !Object.keys(summary).length) continue;

      const modelMap = {
        appointments: Appointment,
        lab_requests: LabRequest,
        prescriptions: Prescription,
        admissions: Admission,
        payments: Payment,
        consultations: Consultation,
        deliveries: DeliveryRecord,
        deposits: Deposit,
        discounts: Discount,
        discount_waivers: DiscountWaiver,
        ultrasound_records: UltrasoundRecord,
        ekg_records: EKGRecord,
        surgeries: Surgery,
        maternity_visits: MaternityVisit,
        central_stocks: CentralStock,
        department_stocks: DepartmentStock,
        billable_items: BillableItem,
        employees: Employee,
        facilities: Facility,
        departments: Department,
        lab_results: LabResult,
        invoices: Invoice,
        pharmacy_transactions: PharmacyTransaction,
        registration_logs: RegistrationLog,
        patients: Patient,
        master_item_categories: MasterItemCategory,
      };

      kpis.push({
        key: mod.key,
        label: mod.name,
        icon: mod.icon || "activity",
        link: mod.route || `/${mod.key.replace(/_/g, "-")}-list.html`,
        total: resolveTotal(summary),
        value: summary.total_amount || summary.total_value || null,
        summary,
        trend: modelMap[mod.key]
          ? await buildTrendSeries(modelMap[mod.key], where, start, end)
          : [],
      });
    }

    const charts = [];

    for (const mod of dashboardModules) {
      if (!["chart", "global_chart"].includes(mod.dashboard_type)) continue;

      const cfg = CHART_BUILDERS[mod.key];
      if (!cfg) continue;

      const where = buildTenantWhere({
        module: mod,
        orgId,
        facilities: facilityIds,
        start,
        end,
      });

      const d = await buildMonthlySeries(cfg.model, where);

      charts.push({
        label: cfg.label,
        type: cfg.type,
        data: {
          labels: d.map(x => x.label),
          series: [d.map(x => x.value)],
        },
      });
    }

    const payload = {
      kpis,
      charts,
      queues: [],
      alerts: [],
      start_date: start,
      end_date: end,
      timestamp: normalizeDateOnly(new Date()),
    };

    setCache(cacheKey, payload);
    res.json(payload);

  } catch (err) {
    logger.error("[dashboardController] FAILED", {
      message: err.message,
      stack: err.stack,
      userId: req.user?.id,
      organization_id: req.user?.organization_id || null,
    });
    res.status(500).json({ error: err.message });
  }
};
