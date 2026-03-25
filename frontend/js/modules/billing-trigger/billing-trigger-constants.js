// 📁 billing-trigger-constants.js – Enterprise Master Pattern (FINAL FIXED)

/* ============================================================
   📋 Field Labels
============================================================ */
export const FIELD_LABELS_BILLING_TRIGGER = {
  // 🏢 Scope
  organization: "Organization",
  facility: "Facility",

  // 🔥 Feature Module (NEW PRIMARY DISPLAY)
  featureModule: "Module",

  // ⚙️ Trigger
  module_key: "Module Key",
  trigger_status: "Trigger Status",
  is_active: "Active",

  // 🧾 Audit
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
   📋 Field Order
============================================================ */
export const FIELD_ORDER_BILLING_TRIGGER = [
  "organization",
  "facility",

  "featureModule", // 🔥 NEW
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
];

/* ============================================================
   👥 Role Defaults
============================================================ */
export const FIELD_DEFAULTS_BILLING_TRIGGER = {
  superadmin: [
    "organization",
    "facility",

    "featureModule", // 🔥
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

    "featureModule",
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

    "featureModule",
    "module_key",

    "trigger_status",
    "is_active",

    "createdBy",
    "created_at",

    "actions",
  ],

  staff: [
    "featureModule", // 🔥
    "module_key",
    "trigger_status",
    "is_active",
    "actions",
  ],
};

/* ============================================================
   ⚙️ Module Metadata
============================================================ */
export const MODULE_KEY_BILLING_TRIGGER = "billingTrigger";
export const MODULE_LABEL_BILLING_TRIGGER = "Billing Trigger";