// ============================================================================
// 📁 backend/src/controllers/reportController.js
// 🧠 Enterprise Report Engine (Stable + Centralized Debug Logging)
// - Safe groupField resolution
// - Works for all modules
// - Uses centralized debug logger + config flags
// ============================================================================

import { Op, fn, col } from "sequelize";
import {
  RegistrationLog, Patient, Consultation, TriageRecord, Vital, Admission,
  DeliveryRecord, UltrasoundRecord, EKGRecord, Appointment, LabRequest,
  LabRequestItem, Prescription, PrescriptionItem, BillableItem, Invoice,
  InvoiceItem, Deposit, DepositApplication, Payment, Refund, RefundTransaction,
  Discount, DiscountWaiver,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { isSuperAdmin } from "../utils/role-utils.js";
import { resolveEnumLabel, resolveStatusGroup } from "../utils/enumResolver.js";
import { FIELD_LABELS, FIELD_ORDER, FIELD_VISIBILITY, FIELD_DEFAULTS } from "../constants/moduleFields.js";

import { APP_CONFIG } from "../config/appConfig.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

// 🎯 Create a module-scoped logger
const log = makeModuleLogger("REPORT");

/* ============================================================
   🧠 ENTERPRISE REPORT ENGINE (Final Centralized Build)
============================================================ */
export const generateReport = async (req, res) => {
  try {
    if (APP_CONFIG.FEATURES.ENABLE_REPORT_DEBUG) log.log("Controller initialized (safe mode)");

    // 🔐 RBAC
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "reports",
      action: "view",
      res,
    });
    if (!allowed) return;

    const { modelType, aggregate_by, date_range, format } = req.query;
    if (!modelType) return error(res, "Missing modelType", null, 400);

    /* -------------------- Filters + Tenant -------------------- */
    const queryOptions = buildQueryOptions(req, {
      defaultSort: ["created_at", "DESC"],
      allowedFilters: ["organization_id", "facility_id", "department_id", "doctor_id", "status", "method", "gender"],
    });
    queryOptions.where ||= {};
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    if (!isSuperAdmin(req.user)) {
      queryOptions.where.organization_id = req.user.organization_id;
      if (role === "facility_head" || req.user.facility_id)
        queryOptions.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) queryOptions.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) queryOptions.where.facility_id = req.query.facility_id;
    }

    /* -------------------- Date Field -------------------- */
    const DATE_FIELD_MAP = {
      consultation: "consultation_date",
      appointment: "appointment_date",
      lab_request: "requested_at",
      invoice: "invoice_date",
      payment: "payment_date",
      refund: "refund_date",
      deposit: "transaction_date",
      vital: "recorded_at",
      admission: "admitted_at",
      delivery: "delivery_date",
    };
    const dateField = DATE_FIELD_MAP[modelType] || "created_at";

    const now = new Date();
    const presets = {
      today: [new Date(now.setHours(0, 0, 0, 0)), new Date()],
      last_7_days: [new Date(Date.now() - 7 * 864e5), new Date()],
      last_30_days: [new Date(Date.now() - 30 * 864e5), new Date()],
      month_to_date: [new Date(now.getFullYear(), now.getMonth(), 1), new Date()],
      year_to_date: [new Date(now.getFullYear(), 0, 1), new Date()],
    };
    let [fromDate, toDate] = presets[date_range] || [];
    if (req.query.from_date && req.query.to_date)
      [fromDate, toDate] = [new Date(req.query.from_date), new Date(req.query.to_date)];
    if (fromDate) queryOptions.where[dateField] = { [Op.between]: [fromDate, toDate] };

    /* -------------------- Model Map -------------------- */
    const MODELS = {
      registration: RegistrationLog, patient: Patient, consultation: Consultation,
      triage: TriageRecord, vital: Vital, admission: Admission, delivery: DeliveryRecord,
      ultrasound: UltrasoundRecord, ekg: EKGRecord, appointment: Appointment,
      lab_request: LabRequest, lab_request_item: LabRequestItem, prescription: Prescription,
      prescription_item: PrescriptionItem, billable_item: BillableItem, invoice: Invoice,
      invoice_item: InvoiceItem, deposit: Deposit, deposit_application: DepositApplication,
      payment: Payment, refund: Refund, refund_transaction: RefundTransaction,
      discount: Discount, discount_waiver: DiscountWaiver,
    };

    const MAPS = {
      group: {
        registration: "log_status", patient: "gender", consultation: "status",
        triage: "triage_status", vital: "status", admission: "status",
        delivery: "status", ultrasound: "status", ekg: "status",
        appointment: "status", lab_request: "status", lab_request_item: "lab_test_id",
        prescription: "status", prescription_item: "billable_item_id",
        billable_item: "category_id", invoice: "status", invoice_item: "billable_item_id",
        deposit: "method", deposit_application: "status", payment: "method",
        refund: "status", refund_transaction: "method",
        discount: "status", discount_waiver: "status",
      },
      agg: {
        invoice: ["total", "balance"], invoice_item: ["total_price"],
        deposit: ["amount"], deposit_application: ["applied_amount"],
        payment: ["amount"], refund: ["amount"], refund_transaction: ["amount"],
        discount: ["value"], discount_waiver: ["value"],
        prescription_item: ["quantity", "dispensed_qty"], billable_item: ["price"],
      },
    };

    const model = MODELS[modelType];
    if (!model) return error(res, `Unknown report type: ${modelType}`, null, 400);

    /* -------------------- Safe Group Field -------------------- */
    let groupField = req.query.groupField;
    if (!groupField || groupField === "groupField" || groupField === "undefined") {
      groupField = MAPS.group?.[modelType] || "status";
    }

    if (!model.rawAttributes[groupField]) {
      log.warn(`Invalid groupField "${groupField}" for ${modelType}`);
      groupField =
        Object.keys(model.rawAttributes).find(k => k.endsWith("_status")) ||
        (model.rawAttributes.status ? "status" : Object.keys(model.rawAttributes)[0]);
    }

    const aggFields = MAPS.agg[modelType] || [];
    const fmt = format === "formatted";
    const money = v => isNaN(v) ? v : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    /* -------------------- Aggregations -------------------- */
    log.log(`modelType=${modelType}, groupField=${groupField}`);

    const totalCount = await model.count({ where: queryOptions.where });
    const attrs = [
      [col(groupField), "group_value"],
      [fn("COUNT", col("id")), "count"],
      ...aggFields.flatMap(f => [
        [fn("SUM", col(f)), `sum_${f}`],
        [fn("AVG", col(f)), `avg_${f}`],
      ]),
    ];

    const grouped = await model.findAll({
      attributes: attrs,
      where: queryOptions.where,
      group: [groupField],
      order: [[groupField, "ASC"]],
      raw: true,
    });

    /* -------------------- Enrichment -------------------- */
    const labels = FIELD_LABELS?.[modelType] || {};
    const visible = FIELD_VISIBILITY?.[modelType]?.[role] || [];
    const order = FIELD_ORDER?.[modelType] || [];

    const groupedFormatted = await Promise.all(
      grouped.map(async (d) => {
        const value = d.group_value;

        // 1️⃣ Resolve Status labels
        if (groupField.includes("status")) {
          d.status_label = resolveEnumLabel(modelType, value);
          d.status_group = resolveStatusGroup(value);
        }

        // 2️⃣ FK Reference: Category lookup
        if (groupField === "category_id" && modelType === "billable_item") {
          try {
            const { MasterItemCategory } = await import("../models/index.js");
            const cat = await MasterItemCategory.findByPk(value, { attributes: ["name"] });
            d.category_name = cat?.name || "(Uncategorized)";
          } catch (err) {
            log.warn("Category lookup failed:", err.message);
          }
        }

        // 3️⃣ Format numbers
        if (fmt) {
          for (const k of Object.keys(d))
            if (k.startsWith("sum_") || k.startsWith("avg_"))
              d[`${k}_formatted`] = money(d[k]);
        }

        return d;
      })
    );

    /* -------------------- Trend -------------------- */
    let trend = [];
    if (aggregate_by) {
      const period = aggregate_by === "month" ? "month" :
        aggregate_by === "year" ? "year" : "day";
      const dateExpr = period === "day"
        ? fn("DATE", col(dateField))
        : fn("DATE_TRUNC", period, col(dateField));
      const tAttrs = [[dateExpr, "date"], [fn("COUNT", col("id")), "count"]];
      if (aggFields.length) tAttrs.push([fn("SUM", col(aggFields[0])), "sum_value"]);
      trend = (
        await model.findAll({
          attributes: tAttrs,
          where: queryOptions.where,
          group: ["date"],
          order: [[col("date"), "ASC"]],
          raw: true,
        })
      ).map(d => {
        if (fmt && d.sum_value) d.sum_value_formatted = money(d.sum_value);
        return d;
      });
    }

    /* -------------------- Audit + Response -------------------- */
    await auditService.logAction({
      user: req.user,
      module: "reports",
      action: "generate",
      details: { modelType, filters: req.query, totalCount },
    });

    return success(res, "✅ Report generated successfully", {
      type: modelType,
      filters: req.query,
      summary: { total_count: totalCount },
      grouped: groupedFormatted,
      trend,
      meta: { labels, order, visible, defaults: FIELD_DEFAULTS?.[modelType]?.[role] },
      scope: {
        organization_id: queryOptions.where.organization_id,
        facility_id: queryOptions.where.facility_id,
      },
    });

  } catch (err) {
    log.error("Failed in generateReport:", err);
    return error(res, "❌ Failed to generate report", err);
  }
};
