// 📦 refund-deposits-constants.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors refund-constants.js for PERFECT consistency
// 🔹 Deposit Refund lifecycle + readable deposit formatting
// 🔹 Supports dropdowns, tables, RBAC, exports, actions
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_REFUND_DEPOSIT = {
  organization: "Organization",
  facility: "Facility",

  // Patient
  patient: "Patient",

  // Deposit (clean, readable)
  deposit: "Deposit",

  // Refund fields
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

  // Generic audit
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  actions: "Actions",
};

/* ============================================================
   🧩 FIELD ORDER (Table Column Sequence)
   EXACT SAME STRUCTURE as refund table ordering
============================================================ */
export const FIELD_ORDER_REFUND_DEPOSIT = [
  "organization",
  "facility",

  "patient",
  "deposit",

  "method",
  "refund_amount",
  "reason",

  "status",

  // ---- Lifecycle Group ----
  "approvedBy",
  "approved_at",
  "processedBy",
  "processed_at",
  "reversedBy",
  "reversed_at",
  "voidedBy",
  "voided_at",

  // ---- Meta Group ----
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  "actions",
];

/* ============================================================
   👥 ROLE-BASED FIELD DEFAULTS
   Mirrors refund default structure
============================================================ */
export const FIELD_DEFAULTS_REFUND_DEPOSIT = {
  // 🧑‍💼 Admin & Superadmin see everything
  admin: [...FIELD_ORDER_REFUND_DEPOSIT],
  superadmin: [...FIELD_ORDER_REFUND_DEPOSIT],

  // 👔 Manager
  manager: [
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

  // 👷 Staff (bare minimum)
  staff: [
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
   🧠 FIELD GROUPS (used in renderers & filters)
============================================================ */
export const FIELD_GROUPS_REFUND_DEPOSIT = {
  org_scope: ["organization", "facility"],

  patient_info: ["patient"],

  financials: ["deposit", "refund_amount", "method"],

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
   ⚙️ EXPORT DEFAULT
============================================================ */
export default {
  FIELD_LABELS_REFUND_DEPOSIT,
  FIELD_ORDER_REFUND_DEPOSIT,
  FIELD_DEFAULTS_REFUND_DEPOSIT,
  FIELD_GROUPS_REFUND_DEPOSIT,
};
