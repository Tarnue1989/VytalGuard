// 📁 billing-trigger-constants.js – Enterprise Master Pattern
// ============================================================================
// 🧭 Matches Patient / Employee / Delivery Record Constants Pattern
// 🔹 Fully aligned with BillingTrigger model + API payload
// 🔹 NO phantom fields
// 🔹 Safe for list, export, detail, and lite views
// ============================================================================

/* ============================================================
   📋 Field Labels (Enterprise Aligned)
============================================================ */
export const FIELD_LABELS_BILLING_TRIGGER = {
  // 🏢 Organizational Scope
  organization: "Organization",
  facility: "Facility",

  // ⚙️ Trigger Definition
  module_key: "Module Key",
  trigger_status: "Trigger Status",
  is_active: "Active",

  // 🧾 Audit Trail
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  // ⚙️ System
  actions: "Actions",
};

/* ============================================================
   📋 Field Display Order (Table / Export / Detail)
============================================================ */
export const FIELD_ORDER_BILLING_TRIGGER = [
  "organization",
  "facility",
  "module_key",
  "trigger_status",
  "is_active",

  // 🧾 AUDIT
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  "actions",
];

/* ============================================================
   👥 Role-Based Default Field Sets
============================================================ */
export const FIELD_DEFAULTS_BILLING_TRIGGER = {
  admin: [
    "organization",
    "facility",
    "module_key",
    "trigger_status",
    "is_active",

    // 🧾 AUDIT
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",

    "actions",
  ],

  manager: [
    "organization",
    "facility",
    "module_key",
    "trigger_status",
    "is_active",

    // 🧾 AUDIT (read-only)
    "createdBy",
    "created_at",

    "actions",
  ],

  staff: [
    "module_key",
    "trigger_status",
    "is_active",
    "actions",
  ],
};
