// 📁 billing-trigger-constants.js – Enterprise Master Pattern (FINAL)
// ============================================================================
// 🧭 Matches Billable Item / Department / Patient Constants Pattern
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
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
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
   👥 Role-Based Default Field Sets (Enterprise Master)
============================================================ */
export const FIELD_DEFAULTS_BILLING_TRIGGER = {
  superadmin: [
    "organization",
    "facility",

    "module_key",
    "trigger_status",
    "is_active",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",

    "actions",
  ],

  admin: [
    "organization",
    "facility",

    "module_key",
    "trigger_status",
    "is_active",

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

/* ============================================================
   ⚙️ Module Metadata (REQUIRED)
============================================================ */
export const MODULE_KEY_BILLING_TRIGGER = "billingTrigger";
export const MODULE_LABEL_BILLING_TRIGGER = "Billing Trigger";
