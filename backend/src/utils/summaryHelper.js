// 📁 backend/src/utils/summaryHelper.js
// ============================================================================
// 🧠 Enterprise Summary Helper – VytalGuard Master Pattern (v2.4 Universal Safe)
// ----------------------------------------------------------------------------
// Supports:
//  ✅ Lifecycle summary (per status)
//  ✅ Deposit + Payment aggregates (amount, applied, remaining)
//  ✅ Aggregate sums (quantity, total_value) if fields exist
//  ✅ Expired batch count (if expiry_date exists)
//  ✅ Gender breakdown (if Patient join provided)
//  ✅ Boolean flag totals (e.g., is_emergency, is_active)
// ----------------------------------------------------------------------------
// Works safely with any model (Appointments, CentralStock, Surgery, Lab, Deposit, Payment…)
// ============================================================================

import { Op } from "sequelize";
import { sequelize } from "../models/index.js";

const SYSTEM_MODELS = [
  "FeatureModule",
  "Permission",
  "Role",
  "Organization", // ✅ REQUIRED
];


export async function buildDynamicSummary({
  model,
    options,
    statusEnums = [],
    includeGender = false,
    genderJoin = null,
  }) {
    const allowCrossTenant = options?.allowCrossTenant === true;
    const esc = v => String(v).replace(/'/g, "''");
    const hasDeletedAt = attrs =>
      attrs && Object.prototype.hasOwnProperty.call(attrs, "deleted_at");

    // ============================================================
    // 🧠 SYSTEM MODEL DETECTION (MUST COME FIRST)
    // ============================================================
    options = options || {};
    options.where = options.where || {};

    const isSystemModel = SYSTEM_MODELS.includes(model.name);

    // 🔥 HARD RESET FOR SYSTEM MODELS (NO TENANT FILTERS EVER)
    if (isSystemModel) {
      options.where = {};
    }

  // ============================================================
  // 🔒 HARD NORMALIZATION (TENANT-SAFE, UUID-SAFE)
  // ============================================================
  if (!isSystemModel && options?.where) {
    for (const key of Object.keys(options.where)) {
      const val = options.where[key];

      if (val && typeof val === "object" && !Array.isArray(val)) {
        if (typeof val.id === "string") {
          options.where[key] = val.id;
        } else if (val[Op.eq]) {
          options.where[key] = val[Op.eq];
        } else if (val[Op.in]) {
          options.where[key] = { [Op.in]: val[Op.in] };
        }
        // ❗ NEVER delete organization_id / facility_id
      }
    }
  }

  // ============================================================
  // 🔐 HARD TENANT NORMALIZATION (GLOBAL, SINGLE SOURCE OF TRUTH)
  // ============================================================
  if (
    !isSystemModel &&
    options?.where?.organization_id &&
    typeof options.where.organization_id === "object"
  ) {
    if (options.where.organization_id[Op.eq]) {
      options.where.organization_id = options.where.organization_id[Op.eq];
    }
  }

  // ============================================================
  // 🚨 FINAL GUARANTEE FOR TENANT-CRITICAL TABLES
  // ============================================================
  const TENANT_CRITICAL_TABLES = new Set([
    "payments",
    "refunds",
    "discounts",
    "discount_waivers",
    "deposits",
    "pharmacy_transactions",
  ]);

  const tableName =
    typeof model.getTableName() === "object"
      ? model.getTableName().tableName
      : model.getTableName();

  if (TENANT_CRITICAL_TABLES.has(tableName)) {
    if (!isSystemModel && !options?.where?.organization_id && !allowCrossTenant) {
      throw new Error(`[SECURITY] Missing organization_id in ${tableName} summary`);
    }
  }

  // ============================================================
  // 🧾 SUMMARY BASE OBJECTS
  // ============================================================
  const summary = {};
  const attrs = model.rawAttributes || {};

  // ============================================================
  // 🚫 Models with custom SQL summaries — skip generic lifecycle
  // ============================================================
  const LIFECYCLE_EXCLUDE_TABLES = new Set([
    "payments",
    "refunds",
    "discounts",
    "discount_waivers",
    "pharmacy_transactions",
    "deposits",
  ]);

  const skipLifecycle = LIFECYCLE_EXCLUDE_TABLES.has(tableName);

  // ✅ Always exclude soft-deleted records
  // ✅ Apply soft-delete filter ONLY if model supports it
  if (!isSystemModel && "deleted_at" in attrs) {
    options.where = {
      ...options.where,
      deleted_at: { [Op.is]: null },
    };
  }



  // 1️⃣ Lifecycle counts (per status) – supports array & object enums
  const normalizedStatuses = Array.isArray(statusEnums)
    ? statusEnums
    : statusEnums && typeof statusEnums === "object"
    ? Object.values(statusEnums)
    : [];

  if (normalizedStatuses.length > 0 && !skipLifecycle) {
    // 🔍 Detect the actual status field name safely
    const statusField =
      "status" in attrs
        ? "status"
        : "log_status" in attrs
        ? "log_status"
        : Object.keys(attrs).find(k => k.toLowerCase().includes("status")) || null;

    // ❌ Model has no status column → skip lifecycle safely
    if (!statusField) {
      // do nothing
    } else {
      // ✅ Initialize all statuses to 0 (CRITICAL FIX)
      normalizedStatuses.forEach(status => {
        summary[status] = 0;
      });

      // 🔍 Compute actual counts
      const lifecycleCounts = await Promise.all(
        normalizedStatuses.map(async status => {
          const count = await model.count({
            where: { ...options.where, [statusField]: status },
          });
          return { status, count };
        })
      );

      // 🧩 Apply results
      lifecycleCounts.forEach(({ status, count }) => {
        summary[status] = count;
      });
    }
  }

  // ============================================================
  // 2️⃣ Quantity / Value summaries (if fields exist)
  // ============================================================
  if ("quantity" in attrs) {
    const totalQty = await model.sum("quantity", { where: options.where });
    summary.total_quantity = Number(totalQty || 0);
  }

  if ("quantity" in attrs && "unit_cost" in attrs) {
    if (!isSystemModel && !options?.where?.organization_id && !allowCrossTenant) {
      throw new Error("[SECURITY] Missing organization_id in value summary");
    }

    const [totalValueRow] = await sequelize.query(`
      SELECT COALESCE(SUM(quantity * COALESCE(unit_cost,0)),0) AS total_value
      FROM "${tableName}"
      WHERE deleted_at IS NULL
      ${
        allowCrossTenant
          ? ""
          : `AND organization_id = '${esc(options.where.organization_id)}'`
      }

      ${
        options.where.facility_id
          ? `AND facility_id = '${esc(options.where.facility_id)}'`
          : ""
      }
    `);
    summary.total_value = parseFloat(totalValueRow[0]?.total_value || 0);
  }

  // ============================================================
  // 🏦 3️⃣ Deposit-specific aggregates (amount, applied, remaining)
  // ============================================================
  if (tableName === "deposits") {
    try {
      // 🔐 HARD TENANT ENFORCEMENT (MANDATORY)
      if (!isSystemModel && !options?.where?.organization_id && !allowCrossTenant) {
        throw new Error("[SECURITY] Missing organization_id in deposits summary");
      }


      const whereClauses = [
        hasDeletedAt(attrs) ? `deleted_at IS NULL` : `TRUE`,        `${allowCrossTenant ? "TRUE" : `"organization_id" = '${esc(options.where.organization_id)}'`}`,
      ];

      // 🏥 Optional facility scope (SAFE)
      if (options.where.facility_id) {
        whereClauses.push(
          `"facility_id" = '${esc(options.where.facility_id)}'`
        );
      }

      // ✅ SAFE FILTERS ONLY (NO org / facility here)
      const keys = [
        "patient_id",
        "status",
        "method",
        "transaction_ref",
        "applied_invoice_id",
      ];

      for (const key of keys) {
        const val = options?.where?.[key];
        if (!val) continue;

        if (Array.isArray(val)) {
          whereClauses.push(`"${key}" IN ('${val.join("','")}')`);
        } else if (val[Op.in]) {
          whereClauses.push(`"${key}" IN ('${val[Op.in].join("','")}')`);
        } else {
          whereClauses.push(`"${key}" = '${esc(val)}'`);
        }
      }

      // 📅 Date range
      const fromDate = options?.where?.created_at?.[Op.gte];
      const toDate   = options?.where?.created_at?.[Op.lte];

      if (fromDate) {
        whereClauses.push(
          `created_at >= '${fromDate.toISOString?.() || fromDate}'`
        );
      }
      if (toDate) {
        whereClauses.push(
          `created_at <= '${toDate.toISOString?.() || toDate}'`
        );
      }

      const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

      const [rows] = await sequelize.query(`
        SELECT 
          COALESCE(SUM(amount),0)             AS total_amount,
          COALESCE(SUM(applied_amount),0)     AS total_applied,
          COALESCE(SUM(remaining_balance),0)  AS total_remaining
        FROM "${tableName}"
        ${whereSQL};
      `);

      summary.total_amount    = Number(rows?.[0]?.total_amount || 0);
      summary.total_applied   = Number(rows?.[0]?.total_applied || 0);
      summary.total_remaining = Number(rows?.[0]?.total_remaining || 0);

    } catch (err) {
      console.warn("⚠️ Deposit aggregate summary failed:", err.message);
      summary.total_amount = 0;
      summary.total_applied = 0;
      summary.total_remaining = 0;
    }
  }

  // ============================================================
  // 💳 3️⃣b Payment-specific aggregates (amounts, lifecycle, methods)
  // ============================================================
  if (tableName === "payments") {
    try {
      // 🔐 HARD TENANT ENFORCEMENT
      if (!isSystemModel && !options?.where?.organization_id && !allowCrossTenant) {
        throw new Error("[SECURITY] Missing organization_id in payments summary");
      }


      const whereClauses = [
        hasDeletedAt(attrs) ? `deleted_at IS NULL` : `TRUE`,        `${allowCrossTenant ? "TRUE" : `"organization_id" = '${esc(options.where.organization_id)}'`}`,
      ];

      if (options.where.facility_id) {
        whereClauses.push(`"facility_id" = '${esc(options.where.facility_id)}'`);
      }

      const keys = [
        "patient_id",
        "status",
        "method",
        "transaction_ref",
        "invoice_id",
      ];

      for (const key of keys) {
        const val = options?.where?.[key];
        if (!val) continue;

        if (Array.isArray(val)) {
          whereClauses.push(`"${key}" IN ('${val.join("','")}')`);
        } else if (val[Op.in]) {
          whereClauses.push(`"${key}" IN ('${val[Op.in].join("','")}')`);
        } else {
          whereClauses.push(`"${key}" = '${esc(val)}'`);
        }
      }

      const fromDate = options?.where?.created_at?.[Op.gte];
      const toDate   = options?.where?.created_at?.[Op.lte];

      if (fromDate) {
        whereClauses.push(
          `created_at >= '${fromDate.toISOString?.() || fromDate}'`
        );
      }
      if (toDate) {
        whereClauses.push(
          `created_at <= '${toDate.toISOString?.() || toDate}'`
        );
      }

      const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

      const [rows] = await sequelize.query(`
        SELECT 
          COUNT(*) AS total_payments,
          COALESCE(SUM(amount), 0) AS total_amount,

          COUNT(*) FILTER (WHERE status = 'pending')   AS pending_count,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
          COUNT(*) FILTER (WHERE status = 'verified')  AS verified_count,
          COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
          COUNT(*) FILTER (WHERE status = 'failed')    AS failed_count,
          COUNT(*) FILTER (WHERE status = 'voided')    AS voided_count,
          COUNT(*) FILTER (WHERE status = 'reversed')  AS reversed_count,

          COALESCE(SUM(amount) FILTER (WHERE status='pending'),   0) AS total_pending_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='completed'), 0) AS total_completed_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='verified'),  0) AS total_verified_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='cancelled'), 0) AS total_cancelled_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='failed'),    0) AS total_failed_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='voided'),    0) AS total_voided_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='reversed'),  0) AS total_reversed_amount,

          COALESCE(SUM(amount) FILTER (WHERE method='cash'), 0) AS total_cash,
          COALESCE(SUM(amount) FILTER (WHERE method='card'), 0) AS total_card,
          COALESCE(SUM(
            CASE 
              WHEN (method::text) IN ('transfer','bank_transfer','wire_transfer','wire','electronic','eft','bank')
              THEN amount
              ELSE 0
            END
          ), 0) AS total_transfer,
          COALESCE(SUM(amount) FILTER (WHERE method='mobile_money'), 0) AS total_mobile_money,
          COALESCE(SUM(amount) FILTER (WHERE method='cheque'), 0) AS total_cheque
        FROM "${tableName}"
        ${whereSQL};
      `);

      const r = rows?.[0] || {};

      summary.payment_summary = {
        total_payments: Number(r.total_payments || 0),
        total_amount: parseFloat(r.total_amount || 0),
        by_status: {
          pending: parseInt(r.pending_count || 0),
          completed: parseInt(r.completed_count || 0),
          verified: parseInt(r.verified_count || 0),
          cancelled: parseInt(r.cancelled_count || 0),
          failed: parseInt(r.failed_count || 0),
          voided: parseInt(r.voided_count || 0),
          reversed: parseInt(r.reversed_count || 0),
        },
        by_method: {
          cash: parseFloat(r.total_cash || 0),
          card: parseFloat(r.total_card || 0),
          transfer: parseFloat(r.total_transfer || 0),
          mobile_money: parseFloat(r.total_mobile_money || 0),
          cheque: parseFloat(r.total_cheque || 0),
        },
      };

      summary.total_amount   = summary.payment_summary.total_amount;
      summary.total_payments = summary.payment_summary.total_payments;

    } catch (err) {
      console.warn("⚠️ Payment aggregate summary failed:", err.message);
      summary.total_amount = 0;
      summary.total_payments = 0;
    }
  }

  // ============================================================
  // 💸 3️⃣c Discount-specific aggregates (amounts, lifecycle, type)
  // ============================================================
  if (tableName === "discounts") {
    try {
      // 🔐 HARD TENANT ENFORCEMENT
      if (!isSystemModel && !options?.where?.organization_id && !allowCrossTenant) {
        throw new Error("[SECURITY] Missing organization_id in discounts summary");
      }


      const whereClauses = [
        hasDeletedAt(attrs) ? `deleted_at IS NULL` : `TRUE`,
        allowCrossTenant
          ? "TRUE"
          : `"organization_id" = '${esc(options.where.organization_id)}'`,
      ];


      if (options.where.facility_id) {
        whereClauses.push(`"facility_id" = '${esc(options.where.facility_id)}'`);
      }

      const keys = ["invoice_id", "status", "type"];

      for (const key of keys) {
        const val = options?.where?.[key];
        if (!val) continue;
        whereClauses.push(`"${key}" = '${esc(val)}'`);
      }

      const fromDate = options?.where?.created_at?.[Op.gte];
      const toDate   = options?.where?.created_at?.[Op.lte];

      if (fromDate) {
        whereClauses.push(
          `created_at >= '${fromDate.toISOString?.() || fromDate}'`
        );
      }
      if (toDate) {
        whereClauses.push(
          `created_at <= '${toDate.toISOString?.() || toDate}'`
        );
      }

      const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

      const [rows] = await sequelize.query(`
        SELECT
          COUNT(*) AS total_discounts,
          COALESCE(SUM(value), 0) AS total_value_sum,
          COALESCE(AVG(value), 0) AS average_discount_value,

          COUNT(*) FILTER (WHERE status='draft')     AS draft_count,
          COUNT(*) FILTER (WHERE status='active')    AS active_count,
          COUNT(*) FILTER (WHERE status='inactive')  AS inactive_count,
          COUNT(*) FILTER (WHERE status='finalized') AS finalized_count,
          COUNT(*) FILTER (WHERE status='voided')    AS voided_count,

          COALESCE(SUM(value) FILTER (WHERE status='draft'), 0)     AS total_draft_value,
          COALESCE(SUM(value) FILTER (WHERE status='active'), 0)    AS total_active_value,
          COALESCE(SUM(value) FILTER (WHERE status='finalized'), 0) AS total_finalized_value,
          COALESCE(SUM(value) FILTER (WHERE status='voided'), 0)    AS total_voided_value,

          COUNT(*) FILTER (WHERE type='percentage') AS count_percentage_type,
          COUNT(*) FILTER (WHERE type='fixed')      AS count_fixed_type,

          COUNT(DISTINCT invoice_id) AS linked_invoices_count,
          COUNT(DISTINCT invoice_item_id) FILTER (WHERE invoice_item_id IS NOT NULL) AS item_level_discounts,
          MAX(finalized_at) AS last_finalized_at
        FROM "${tableName}"
        ${whereSQL};
      `);

      const r = rows?.[0] || {};

      summary.discount_summary = {
        total_discounts: Number(r.total_discounts || 0),
        total_value_sum: parseFloat(r.total_value_sum || 0),
        average_discount_value: parseFloat(r.average_discount_value || 0),
        by_status: {
          draft: parseInt(r.draft_count || 0),
          active: parseInt(r.active_count || 0),
          inactive: parseInt(r.inactive_count || 0),
          finalized: parseInt(r.finalized_count || 0),
          voided: parseInt(r.voided_count || 0),
        },
        by_type: {
          percentage: parseInt(r.count_percentage_type || 0),
          fixed: parseInt(r.count_fixed_type || 0),
        },
        total_values_by_status: {
          draft: parseFloat(r.total_draft_value || 0),
          active: parseFloat(r.total_active_value || 0),
          finalized: parseFloat(r.total_finalized_value || 0),
          voided: parseFloat(r.total_voided_value || 0),
        },
        metrics: {
          linked_invoices_count: parseInt(r.linked_invoices_count || 0),
          item_level_discounts: parseInt(r.item_level_discounts || 0),
          last_finalized_at: r.last_finalized_at || null,
          active_percentage:
            r.total_discounts > 0
              ? ((r.active_count || 0) / r.total_discounts) * 100
              : 0,
        },
      };

      summary.total_discounts = summary.discount_summary.total_discounts;
      summary.total_value_sum = summary.discount_summary.total_value_sum;

    } catch (err) {
      console.warn("⚠️ Discount summary failed:", err.message);
      summary.discount_summary = {};
    }
  }

  // ============================================================
  // 🎟️ 3️⃣d Discount Waiver-specific aggregates (amounts, lifecycle, type)
  // ============================================================
  if (tableName === "discount_waivers") {
    try {
      // 🔐 HARD TENANT ENFORCEMENT
      if (!isSystemModel && !options?.where?.organization_id && !allowCrossTenant) {
        throw new Error("[SECURITY] Missing organization_id in discount waivers summary");
      }

      const whereClauses = [
        hasDeletedAt(attrs) ? `deleted_at IS NULL` : `TRUE`,
        allowCrossTenant
          ? "TRUE"
          : `"organization_id" = '${esc(options.where.organization_id)}'`,
      ];

      // 🏥 Optional facility scope
      if (options.where.facility_id) {
        whereClauses.push(`"facility_id" = '${esc(options.where.facility_id)}'`);
      }

      const keys = ["invoice_id", "status", "type"];

      for (const key of keys) {
        const val = options?.where?.[key];
        if (!val) continue;

        if (Array.isArray(val)) {
          whereClauses.push(`"${key}" IN ('${val.join("','")}')`);
        } else if (val[Op.in]) {
          whereClauses.push(`"${key}" IN ('${val[Op.in].join("','")}')`);
        } else {
          whereClauses.push(`"${key}" = '${esc(val)}'`);
        }
      }

      const fromDate = options?.where?.created_at?.[Op.gte];
      const toDate   = options?.where?.created_at?.[Op.lte];

      if (fromDate) {
        whereClauses.push(
          `created_at >= '${fromDate.toISOString?.() || fromDate}'`
        );
      }
      if (toDate) {
        whereClauses.push(
          `created_at <= '${toDate.toISOString?.() || toDate}'`
        );
      }

      const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

      const [rows] = await sequelize.query(`
        SELECT
          COUNT(*) AS total_waivers,
          COALESCE(SUM(COALESCE(applied_total, amount, 0)),0) AS total_amount_sum,
          COALESCE(SUM(applied_total),0) AS total_applied_sum,
          COALESCE(SUM(remaining_balance),0) AS total_remaining_sum,
          COALESCE(AVG(applied_total),0) AS average_waiver_value,

          COUNT(*) FILTER (WHERE status='pending')   AS pending_count,
          COUNT(*) FILTER (WHERE status='approved')  AS approved_count,
          COUNT(*) FILTER (WHERE status='applied')   AS applied_count,
          COUNT(*) FILTER (WHERE status='rejected')  AS rejected_count,
          COUNT(*) FILTER (WHERE status='voided')    AS voided_count,

          COALESCE(SUM(applied_total) FILTER (WHERE status='pending'),0)   AS total_pending_value,
          COALESCE(SUM(applied_total) FILTER (WHERE status='approved'),0)  AS total_approved_value,
          COALESCE(SUM(applied_total) FILTER (WHERE status='applied'),0)   AS total_applied_value,
          COALESCE(SUM(applied_total) FILTER (WHERE status='rejected'),0)  AS total_rejected_value,
          COALESCE(SUM(applied_total) FILTER (WHERE status='voided'),0)    AS total_voided_value,

          COUNT(*) FILTER (WHERE type='percentage') AS count_percentage_type,
          COUNT(*) FILTER (WHERE type='fixed')      AS count_fixed_type,

          COUNT(DISTINCT invoice_id) AS linked_invoices_count,
          MAX(approved_at) AS last_approved_at,
          MAX(finalized_at) AS last_applied_at
        FROM "${tableName}"
        ${whereSQL};
      `);

      const r = rows?.[0] || {};

      summary.discount_waiver_summary = {
        total_waivers: Number(r.total_waivers || 0),
        total_amount_sum: parseFloat(r.total_amount_sum || 0),
        total_applied_sum: parseFloat(r.total_applied_sum || 0),
        total_remaining_sum: parseFloat(r.total_remaining_sum || 0),
        average_waiver_value: parseFloat(r.average_waiver_value || 0),
        by_status: {
          pending: parseInt(r.pending_count || 0),
          approved: parseInt(r.approved_count || 0),
          applied: parseInt(r.applied_count || 0),
          rejected: parseInt(r.rejected_count || 0),
          voided: parseInt(r.voided_count || 0),
        },
        by_type: {
          percentage: parseInt(r.count_percentage_type || 0),
          fixed: parseInt(r.count_fixed_type || 0),
        },
        total_values_by_status: {
          pending: parseFloat(r.total_pending_value || 0),
          approved: parseFloat(r.total_approved_value || 0),
          applied: parseFloat(r.total_applied_value || 0),
          rejected: parseFloat(r.total_rejected_value || 0),
          voided: parseFloat(r.total_voided_value || 0),
        },
        metrics: {
          linked_invoices_count: parseInt(r.linked_invoices_count || 0),
          last_approved_at: r.last_approved_at || null,
          last_applied_at: r.last_applied_at || null,
          approval_rate:
            r.total_waivers > 0
              ? (((r.approved_count || 0) + (r.applied_count || 0)) / r.total_waivers) * 100
              : 0,
        },
      };

      summary.total_waivers = summary.discount_waiver_summary.total_waivers;
      summary.total_applied_sum = summary.discount_waiver_summary.total_applied_sum;

    } catch (err) {
      console.warn("⚠️ Discount Waiver summary failed:", err.message);
      summary.discount_waiver_summary = {};
    }
  }

  // ============================================================
  // 💸 3️⃣e Refund-specific aggregates (amounts, lifecycle, method)
  // ============================================================
  if (tableName === "refunds") {
    try {
      // 🔐 HARD TENANT ENFORCEMENT
      if (!isSystemModel && !options?.where?.organization_id && !allowCrossTenant) {
        throw new Error("[SECURITY] Missing organization_id in refunds summary");
      }

      const whereClauses = [
        hasDeletedAt(attrs) ? `deleted_at IS NULL` : `TRUE`,
        allowCrossTenant
          ? "TRUE"
          : `"organization_id" = '${esc(options.where.organization_id)}'`,
      ];

      // 🏥 Optional facility scope
      if (options.where.facility_id) {
        whereClauses.push(`"facility_id" = '${esc(options.where.facility_id)}'`);
      }

      const keys = ["invoice_id", "status", "method"];

      for (const key of keys) {
        const val = options?.where?.[key];
        if (!val) continue;
        whereClauses.push(`"${key}" = '${esc(val)}'`);
      }

      const fromDate = options?.where?.created_at?.[Op.gte];
      const toDate   = options?.where?.created_at?.[Op.lte];

      if (fromDate) {
        whereClauses.push(
          `created_at >= '${fromDate.toISOString?.() || fromDate}'`
        );
      }
      if (toDate) {
        whereClauses.push(
          `created_at <= '${toDate.toISOString?.() || toDate}'`
        );
      }

      const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

      const [rows] = await sequelize.query(`
        SELECT
          COUNT(*) AS total_refunds,
          COALESCE(SUM(amount), 0) AS total_refund_amount,
          COALESCE(AVG(amount), 0) AS average_refund_amount,

          COUNT(*) FILTER (WHERE status='pending')   AS pending_count,
          COUNT(*) FILTER (WHERE status='approved')  AS approved_count,
          COUNT(*) FILTER (WHERE status='rejected')  AS rejected_count,
          COUNT(*) FILTER (WHERE status='processed') AS processed_count,
          COUNT(*) FILTER (WHERE status='cancelled') AS cancelled_count,
          COUNT(*) FILTER (WHERE status='reversed')  AS reversed_count,
          COUNT(*) FILTER (WHERE status='voided')    AS voided_count,

          COALESCE(SUM(amount) FILTER (WHERE status='pending'),   0) AS total_pending_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='approved'),  0) AS total_approved_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='processed'), 0) AS total_processed_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='cancelled'), 0) AS total_cancelled_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='rejected'),  0) AS total_rejected_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='reversed'),  0) AS total_reversed_amount,
          COALESCE(SUM(amount) FILTER (WHERE status='voided'),    0) AS total_voided_amount,

          COALESCE(SUM(amount) FILTER (WHERE method='cash'), 0) AS total_cash,
          COALESCE(SUM(amount) FILTER (WHERE method='card'), 0) AS total_card,
          COALESCE(SUM(amount) FILTER (WHERE method='bank_transfer'), 0) AS total_transfer,
          COALESCE(SUM(amount) FILTER (WHERE method='mobile_money'), 0) AS total_mobile_money,
          COALESCE(SUM(amount) FILTER (WHERE method='cheque'), 0) AS total_cheque,

          COUNT(DISTINCT invoice_id) AS linked_invoices_count,
          MAX(processed_at) AS last_processed_at,
          MAX(approved_at)  AS last_approved_at
        FROM "${tableName}"
        ${whereSQL};
      `);

      const r = rows?.[0] || {};

      summary.refund_summary = {
        total_refunds: Number(r.total_refunds || 0),
        total_refund_amount: parseFloat(r.total_refund_amount || 0),
        average_refund_amount: parseFloat(r.average_refund_amount || 0),
        by_status: {
          pending: parseInt(r.pending_count || 0),
          approved: parseInt(r.approved_count || 0),
          rejected: parseInt(r.rejected_count || 0),
          processed: parseInt(r.processed_count || 0),
          cancelled: parseInt(r.cancelled_count || 0),
          reversed: parseInt(r.reversed_count || 0),
          voided: parseInt(r.voided_count || 0),
        },
        total_values_by_status: {
          pending: parseFloat(r.total_pending_amount || 0),
          approved: parseFloat(r.total_approved_amount || 0),
          processed: parseFloat(r.total_processed_amount || 0),
          cancelled: parseFloat(r.total_cancelled_amount || 0),
          rejected: parseFloat(r.total_rejected_amount || 0),
          reversed: parseFloat(r.total_reversed_amount || 0),
          voided: parseFloat(r.total_voided_amount || 0),
        },
        by_method: {
          cash: parseFloat(r.total_cash || 0),
          card: parseFloat(r.total_card || 0),
          bank_transfer: parseFloat(r.total_transfer || 0),
          mobile_money: parseFloat(r.total_mobile_money || 0),
          cheque: parseFloat(r.total_cheque || 0),
        },
        metrics: {
          linked_invoices_count: parseInt(r.linked_invoices_count || 0),
          last_processed_at: r.last_processed_at || null,
          last_approved_at: r.last_approved_at || null,
          processed_rate:
            r.total_refunds > 0
              ? ((r.processed_count || 0) / r.total_refunds) * 100
              : 0,
        },
      };

      summary.total_refunds = summary.refund_summary.total_refunds;
      summary.total_refund_amount = summary.refund_summary.total_refund_amount;
      summary.average_refund_amount = summary.refund_summary.average_refund_amount;

    } catch (err) {
      console.warn("⚠️ Refund summary failed:", err.message);
      summary.refund_summary = {};
    }
  }

  // ============================================================
  // 💊 3️⃣e Pharmacy Transaction aggregates (quantities, lifecycle, value)
  // ============================================================
  if (tableName === "pharmacy_transactions") {
    try {
      // 🔐 HARD TENANT ENFORCEMENT (NON-NEGOTIABLE)
      if (!isSystemModel && !options?.where?.organization_id && !allowCrossTenant) {
        throw new Error("[SECURITY] Missing organization_id in pharmacy summary");
      }

      const whereClauses = [
        hasDeletedAt(attrs) ? `deleted_at IS NULL` : `TRUE`,
        allowCrossTenant
          ? "TRUE"
          : `"organization_id" = '${esc(options.where.organization_id)}'`,
      ];

      // 🏥 Optional facility scope
      if (options.where.facility_id) {
        whereClauses.push(`"facility_id" = '${esc(options.where.facility_id)}'`);
      }

      // Optional safe filters (NO org / facility override allowed)
      const keys = [
        "patient_id",
        "department_id",
        "status",
        "type",
      ];

      for (const key of keys) {
        const val = options?.where?.[key];
        if (!val) continue;

        if (Array.isArray(val)) {
          whereClauses.push(`"${key}" IN ('${val.join("','")}')`);
        } else if (val[Op.in]) {
          whereClauses.push(`"${key}" IN ('${val[Op.in].join("','")}')`);
        } else {
          whereClauses.push(`"${key}" = '${esc(val)}'`);
        }
      }

      // Date range filters
      const fromDate = options?.where?.created_at?.[Op.gte];
      const toDate   = options?.where?.created_at?.[Op.lte];

      if (fromDate) {
        whereClauses.push(
          `created_at >= '${fromDate.toISOString?.() || fromDate}'`
        );
      }
      if (toDate) {
        whereClauses.push(
          `created_at <= '${toDate.toISOString?.() || toDate}'`
        );
      }

      const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

      // 📊 AGGREGATED SUMMARY (TENANT-SAFE / CROSS-TENANT SAFE)
      const [rows] = await sequelize.query(`
        SELECT
          COUNT(*) AS total_transactions,

          -- Total quantity ever involved (audit-safe)
          COALESCE(SUM(quantity_dispensed), 0) AS total_quantity,

          -- ✅ CURRENTLY DISPENSED (EXCLUDES voided & cancelled)
          COALESCE(SUM(
            CASE
              WHEN type = 'dispense'
              AND status NOT IN ('voided', 'cancelled')
              THEN quantity_dispensed
              ELSE 0
            END
          ), 0) AS total_dispensed,

          -- Current returned quantity
          COALESCE(SUM(
            CASE
              WHEN type = 'return'
              AND status NOT IN ('voided', 'cancelled')
              THEN quantity_dispensed
              ELSE 0
            END
          ), 0) AS total_returned,

          -- Lifecycle counts
          COUNT(*) FILTER (WHERE status = 'pending')              AS pending_count,
          COUNT(*) FILTER (WHERE status = 'dispensed')            AS dispensed_count,
          COUNT(*) FILTER (WHERE status = 'partially_dispensed')  AS partial_count,
          COUNT(*) FILTER (WHERE status = 'returned')             AS returned_count,
          COUNT(*) FILTER (WHERE status = 'verified')             AS verified_count,
          COUNT(*) FILTER (WHERE status = 'cancelled')            AS cancelled_count,
          COUNT(*) FILTER (WHERE status = 'voided')               AS voided_count,

          -- Emergency flag totals
          COUNT(*) FILTER (WHERE is_emergency IS TRUE)            AS emergency_count,

          -- Last fulfillment activity (audit)
          MAX(fulfillment_date) AS last_fulfillment_date
        FROM "${tableName}"
        ${whereSQL};
      `);

      const r = rows?.[0] || {};

      summary.pharmacy_summary = {
        total_transactions: Number(r.total_transactions || 0),
        total_quantity: Number(r.total_quantity || 0),
        total_dispensed: Number(r.total_dispensed || 0),
        total_returned: Number(r.total_returned || 0),

        by_status: {
          pending: parseInt(r.pending_count || 0),
          dispensed: parseInt(r.dispensed_count || 0),
          partially_dispensed: parseInt(r.partial_count || 0),
          returned: parseInt(r.returned_count || 0),
          verified: parseInt(r.verified_count || 0),
          cancelled: parseInt(r.cancelled_count || 0),
          voided: parseInt(r.voided_count || 0),
        },

        metrics: {
          emergency_count: parseInt(r.emergency_count || 0),
          last_fulfillment_date: r.last_fulfillment_date || null,

          // ✅ Quantity-based rates
          dispense_rate:
            r.total_quantity > 0
              ? Math.round((r.total_dispensed / r.total_quantity) * 100)
              : 0,

          return_rate:
            r.total_quantity > 0
              ? Math.round((r.total_returned / r.total_quantity) * 100)
              : 0,
        },
      };

      // Dashboard shorthands
      summary.total_transactions = summary.pharmacy_summary.total_transactions;
      summary.total_quantity = summary.pharmacy_summary.total_quantity;

    } catch (err) {
      console.warn("⚠️ Pharmacy Transaction summary failed:", err.message);
      summary.pharmacy_summary = {};
    }
  }


  // ============================================================
  // 4️⃣ Expired count (if expiry_date exists)
  // ============================================================
  if ("expiry_date" in attrs) {
    summary.expired_count = await model.count({
      where: { ...options.where, expiry_date: { [Op.lt]: new Date() } },
    });
  }

// ============================================================
// 5️⃣ Gender breakdown
// ============================================================
if (includeGender && genderJoin) {
  try {
    const joinTable =
      typeof genderJoin.model.getTableName() === "object"
        ? genderJoin.model.getTableName().tableName
        : genderJoin.model.getTableName();
    const joinAlias = genderJoin.as;
    const foreignKey = genderJoin.foreignKey || `${joinAlias}_id`;

    const whereClauses = [
      ("deleted_at" in attrs) ? `a.deleted_at IS NULL` : `TRUE`
    ];

    ["organization_id", "facility_id", "patient_id", "status", "method", "transaction_ref"].forEach(
      (key) => {
        if (
          options.where[key] &&
          !(key === "organization_id" && allowCrossTenant)
        ) {
          whereClauses.push(`a."${key}" = '${esc(options.where[key])}'`);
        }
      }
    );

    if (options.where.created_at?.[Op.gte]) {
      whereClauses.push(
        `a.created_at >= '${
          options.where.created_at[Op.gte].toISOString?.() ||
          options.where.created_at[Op.gte]
        }'`
      );
    }

    if (options.where.created_at?.[Op.lte]) {
      whereClauses.push(
        `a.created_at <= '${
          options.where.created_at[Op.lte].toISOString?.() ||
          options.where.created_at[Op.lte]
        }'`
      );
    }

    const whereSQL = `WHERE ${whereClauses.join(" AND ")}`;

    const sql = `
      SELECT
        CAST(p.gender AS TEXT) AS gender,
        COUNT(DISTINCT p.id) AS count
      FROM "${tableName}" AS a
      INNER JOIN "${joinTable}" AS p ON a."${foreignKey}" = p.id
      ${whereSQL}
      GROUP BY CAST(p.gender AS TEXT)
    `;

    const [rows] = await sequelize.query(sql);

    summary.gender_breakdown = rows.reduce((acc, row) => {
      acc[row.gender || "Unknown"] = parseInt(row.count, 10);
      return acc;
    }, {});
  } catch (err) {
    console.warn("⚠️ Gender breakdown failed:", err.message);
    summary.gender_breakdown = {};
  }
}

  // ============================================================
  // 6️⃣ Emergency / Boolean flag summary
  // ============================================================
  if ("is_emergency" in attrs) {
    summary.total_emergency = await model.count({
      where: { ...options.where, is_emergency: true },
    });
  }

  // ============================================================
  // 7️⃣ Universal total count (FINAL SAFE VERSION)
  // ============================================================

  // Only apply generic totals to SIMPLE models
  const GENERIC_TOTAL_ALLOWED =
    !isSystemModel &&
    ![
      "payments",
      "refunds",
      "discounts",
      "discount_waivers",
      "pharmacy_transactions",
      "deposits",
    ].includes(tableName);


  if (GENERIC_TOTAL_ALLOWED) {
    if (summary.total == null) {
      const countWhere = allowCrossTenant
        ? Object.fromEntries(
            Object.entries(options.where || {}).filter(
              ([k]) => k !== "organization_id"
            )
          )
        : options.where;

      summary.total = await model.count({ where: countWhere });
    }
  }


  return summary;
}
