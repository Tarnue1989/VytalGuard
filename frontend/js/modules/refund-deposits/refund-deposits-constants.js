// 📦 refund-deposits-constants.js – Enterprise MASTER–ALIGNED
// ============================================================================
// 🔹 Parity Source: deposit-constants.js + refund-constants.js
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// 🔹 RBAC-safe, lifecycle-aware, enterprise ordering guaranteed
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_REFUND_DEPOSIT = {
  refund_deposit_number: "Refund Deposit #",
  organization: "Organization",
  facility: "Facility",

  // Identity
  patient: "Patient",
  deposit: "Deposit",

  // Financial
  refund_amount: "Refund Amount",
  method: "Method",
  reason: "Reason",

  // Status
  status: "Status",

  // Lifecycle audit
  approvedBy: "Approved By",
  approved_at: "Approved At",
  processedBy: "Processed By",
  processed_at: "Processed At",
  reversedBy: "Reversed By",
  reversed_at: "Reversed At",
  voidedBy: "Voided By",
  voided_at: "Voided At",

  // Meta audit
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER (Enterprise-Consistent)
============================================================ */
export const FIELD_ORDER_REFUND_DEPOSIT = [
  "refund_deposit_number",
  "organization",
  "facility",

  "patient",
  "deposit",

  "method",
  "refund_amount",
  "reason",

  "status",

  // ---- Lifecycle ----
  "approvedBy",
  "approved_at",
  "processedBy",
  "processed_at",
  "reversedBy",
  "reversed_at",
  "voidedBy",
  "voided_at",

  // ---- Meta ----
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  "actions",
];

/* ============================================================
   👥 ROLE-BASED FIELD DEFAULTS (MASTER RBAC)
============================================================ */
export const FIELD_DEFAULTS_REFUND_DEPOSIT = {
  // 🧑‍💼 Full visibility
  superadmin: [...FIELD_ORDER_REFUND_DEPOSIT],
  admin: [...FIELD_ORDER_REFUND_DEPOSIT],

  // 👔 Manager (scoped lifecycle)
  manager: [
    "refund_deposit_number",
    "facility",
    "patient",
    "deposit",
    "method",
    "refund_amount",
    "reason",
    "status",

    "approvedBy",
    "approved_at",
    "processedBy",
    "processed_at",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",

    "actions",
  ],

  // 👷 Staff (essential only)
  staff: [
    "refund_deposit_number",
    "facility",
    "patient",
    "deposit",
    "method",
    "refund_amount",
    "reason",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_REFUND_DEPOSIT = {
  org_scope: ["organization", "facility"],
  patient_info: ["patient", "deposit"],
  financials: ["refund_amount", "method"],
  notes: ["reason"],
  lifecycle: [
    "approvedBy",
    "approved_at",
    "processedBy",
    "processed_at",
    "reversedBy",
    "reversed_at",
    "voidedBy",
    "voided_at",
  ],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_REFUND_DEPOSIT = "refund_deposits";
export const MODULE_LABEL_REFUND_DEPOSIT = "Refund Deposit";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_REFUND_DEPOSIT,
  FIELD_ORDER_REFUND_DEPOSIT,
  FIELD_DEFAULTS_REFUND_DEPOSIT,
  FIELD_GROUPS_REFUND_DEPOSIT,
  MODULE_KEY_REFUND_DEPOSIT,
  MODULE_LABEL_REFUND_DEPOSIT,
};