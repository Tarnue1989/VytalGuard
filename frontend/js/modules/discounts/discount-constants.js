// 📦 discount-constants.js – Enterprise MASTER–ALIGNED (Deposit Parity)
// ============================================================================
// 🔹 Pattern Source: deposit-constants.js (Consultation Parity)
// 🔹 Structural Consistency: labels, order, RBAC visibility, metadata
// 🔹 100% ID retention (safe for existing HTML + JS modules)
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_DISCOUNT = {
  organization: "Organization",
  facility: "Facility",
  invoice: "Invoice",
  invoiceItem: "Invoice Item",
  type: "Type",
  value: "Value",
  reason: "Reason",
  status: "Status",

  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  finalizedBy: "Finalized By",
  finalized_at: "Finalized At",
  voidedBy: "Voided By",
  voided_at: "Voided At",
  void_reason: "Void Reason",

  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER (Enterprise-Consistent)
============================================================ */
export const FIELD_ORDER_DISCOUNT = [
  "organization",
  "facility",
  "invoice",
  "invoiceItem",
  "type",
  "value",
  "reason",
  "status",

  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  "finalizedBy",
  "finalized_at",
  "voidedBy",
  "voided_at",
  "void_reason",

  "actions",
];

/* ============================================================
   👥 ROLE-BASED FIELD DEFAULTS (MASTER RBAC)
============================================================ */
export const FIELD_DEFAULTS_DISCOUNT = {
  superadmin: [
    "organization",
    "facility",
    "invoice",
    "invoiceItem",
    "type",
    "value",
    "reason",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "finalizedBy",
    "finalized_at",
    "voidedBy",
    "voided_at",
    "void_reason",
    "actions",
  ],

  admin: [
    "organization",
    "facility",
    "invoice",
    "invoiceItem",
    "type",
    "value",
    "reason",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "finalizedBy",
    "finalized_at",
    "voidedBy",
    "voided_at",
    "void_reason",
    "actions",
  ],

  manager: [
    "facility",
    "invoice",
    "invoiceItem",
    "type",
    "value",
    "reason",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "finalizedBy",
    "finalized_at",
    "actions",
  ],

  staff: [
    "facility",
    "invoice",
    "invoiceItem",
    "type",
    "value",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_DISCOUNT = {
  org_scope: ["organization", "facility"],
  linked_items: ["invoice", "invoiceItem"],
  discount_info: ["type", "value", "reason", "status"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  audit: ["deletedBy", "deleted_at"],
  finalization: ["finalizedBy", "finalized_at", "voidedBy", "voided_at", "void_reason"],
  system: ["actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_DISCOUNT = "discounts";
export const MODULE_LABEL_DISCOUNT = "Discount";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_DISCOUNT,
  FIELD_ORDER_DISCOUNT,
  FIELD_DEFAULTS_DISCOUNT,
  FIELD_GROUPS_DISCOUNT,
  MODULE_KEY_DISCOUNT,
  MODULE_LABEL_DISCOUNT,
};
