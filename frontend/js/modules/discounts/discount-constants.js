// 📦 discount-constants.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposit-constants.js / consultation-constants.js for consistency
// 🔹 Keeps all original field IDs intact for HTML + JS compatibility
// 🔹 Supports dynamic table rendering, tooltips, exports, and role visibility
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_DISCOUNT = {
  organization: "Organization",
  facility: "Facility",
  invoice: "Invoice", // 🔗 Linked Invoice
  invoiceItem: "Invoice Item", // 🔗 Linked Invoice Item
  type: "Type", // percentage | fixed
  value: "Value", // amount or %
  reason: "Reason",
  status: "Status",

  // 🛡️ Audit fields
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  finalizedBy: "Finalized By",
  voidedBy: "Voided By",

  // 🕑 Timestamps
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  finalized_at: "Finalized At",
  voided_at: "Voided At",

  // 📝 Special
  void_reason: "Void Reason",

  actions: "Actions",
};

/* ============================================================
   🧩 FIELD ORDER
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
   👥 ROLE-BASED FIELD DEFAULTS
   Matches enterprise master RBAC visibility (admin → manager → staff)
============================================================ */
export const FIELD_DEFAULTS_DISCOUNT = {
  // 🧑‍💼 Admin: full visibility
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

  // 👔 Manager: scoped (no organization or delete info)
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

  // 👷 Staff: minimal operational view
  staff: [
    "facility",
    "invoice",
    "invoiceItem",
    "type",
    "value",
    "reason",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Optional Extension)
   Enables dynamic section toggling & report grouping
============================================================ */
export const FIELD_GROUPS_DISCOUNT = {
  org_scope: ["organization", "facility"],
  linked_items: ["invoice", "invoiceItem"],
  discount_info: ["type", "value", "reason", "status"],
  audit_trail: [
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
  ],
  finalization: [
    "finalizedBy",
    "finalized_at",
    "voidedBy",
    "voided_at",
    "void_reason",
  ],
  system: ["actions"],
};

/* ============================================================
   ⚙️ EXPORT (for external import)
============================================================ */
export default {
  FIELD_LABELS_DISCOUNT,
  FIELD_ORDER_DISCOUNT,
  FIELD_DEFAULTS_DISCOUNT,
  FIELD_GROUPS_DISCOUNT,
};
