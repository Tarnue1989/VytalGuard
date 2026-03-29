// 📦 refund-constants.js – Enterprise MASTER–ALIGNED (Refund ↔ Refund Deposit Parity)
// ============================================================================
// 🔹 Parity Source: refund-deposits-constants.js (MASTER)
// 🔹 Preserves ALL existing field IDs for HTML + JS compatibility
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// 🔹 RBAC-safe, lifecycle-aware, enterprise ordering guaranteed
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_REFUND = {
  refund_number: "Refund #",
  organization: "Organization",
  facility: "Facility",

  // Identity
  patient: "Patient",
  invoice: "Invoice",
  payment: "Payment",

  // Financial
  method: "Method",
  amount: "Amount",
  reason: "Reason",

  // Status
  status: "Status",

  // ---- Lifecycle audit ----
  approvedBy: "Approved By",
  approved_at: "Approved At",
  rejectedBy: "Rejected By",
  rejected_at: "Rejected At",
  processedBy: "Processed By",
  processed_at: "Processed At",
  cancelledBy: "Cancelled By",
  cancelled_at: "Cancelled At",

  // ---- Meta audit ----
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
export const FIELD_ORDER_REFUND = [
  "refund_number",
  "organization",
  "facility",

  "patient",
  "invoice",
  "payment",

  "method",
  "amount",
  "reason",

  "status",

  // ---- Lifecycle ----
  "approvedBy",
  "approved_at",
  "rejectedBy",
  "rejected_at",
  "processedBy",
  "processed_at",
  "cancelledBy",
  "cancelled_at",

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
export const FIELD_DEFAULTS_REFUND = {
  // 🧑‍💼 Full visibility
  superadmin: [...FIELD_ORDER_REFUND],
  admin: [...FIELD_ORDER_REFUND],

  // 👔 Manager (scoped lifecycle)
  manager: [
    "refund_number",
    "facility",
    "patient",
    "invoice",
    "payment",
    "method",
    "amount",
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
    "refund_number",
    "facility",
    "patient",
    "invoice",
    "payment",
    "method",
    "amount",
    "reason",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_REFUND = {
  org_scope: ["organization", "facility"],
  patient_info: ["patient", "invoice", "payment"],
  financials: ["method", "amount"],
  notes: ["reason"],
  lifecycle: [
    "approvedBy",
    "approved_at",
    "rejectedBy",
    "rejected_at",
    "processedBy",
    "processed_at",
    "cancelledBy",
    "cancelled_at",
  ],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_REFUND = "refunds";
export const MODULE_LABEL_REFUND = "Refund";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_REFUND,
  FIELD_ORDER_REFUND,
  FIELD_DEFAULTS_REFUND,
  FIELD_GROUPS_REFUND,
  MODULE_KEY_REFUND,
  MODULE_LABEL_REFUND,
};