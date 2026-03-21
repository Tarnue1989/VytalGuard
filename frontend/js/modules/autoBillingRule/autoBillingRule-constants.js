// 📁 autoBillingRule-constants.js
// ============================================================================
// 🔹 ENTERPRISE MASTER–ALIGNED (FULL UPGRADE)
// 🔹 Aligned with Registration Log + Lab Request MASTER patterns
// 🔹 Adds: RBAC superadmin, FIELD_GROUPS, unified export, strict ordering
// 🔹 Preserves ALL existing fields and structure (NO BREAKING CHANGES)
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (UNCHANGED + STANDARDIZED)
============================================================ */
export const FIELD_LABELS_AUTO_BILLING_RULE = {
  organization: "Organization",
  facility: "Facility",
  trigger_feature_module: "Feature Module",
  trigger_module: "Trigger Module",
  billableItem: "Billable Item",
  auto_generate: "Auto Generate",
  charge_mode: "Charge Mode",
  default_price: "Default Price",
  status: "Status",

  // 🧠 Audit
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  // ⚙️ Actions
  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER (MASTER-CONSISTENT)
   🔹 Actions ALWAYS LAST
============================================================ */
export const FIELD_ORDER_AUTO_BILLING_RULE = [
  // 🏢 Scope
  "organization",
  "facility",

  // ⚙️ Rule Logic
  "trigger_feature_module",
  "trigger_module",
  "billableItem",
  "auto_generate",
  "charge_mode",
  "default_price",
  "status",

  // 🧠 Audit
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  // ⚙️ Actions (ALWAYS LAST)
  "actions",
];

/* ============================================================
   👥 FIELD DEFAULTS (RBAC – FULL MASTER ALIGNMENT)
============================================================ */
export const FIELD_DEFAULTS_AUTO_BILLING_RULE = {
  // 🔓 FULL ACCESS
  superadmin: FIELD_ORDER_AUTO_BILLING_RULE,

  admin: [
    "organization", "facility",
    "trigger_feature_module", "trigger_module",
    "billableItem", "auto_generate", "charge_mode", "default_price",
    "status",
    "createdBy", "created_at",
    "updatedBy", "updated_at",
    "deletedBy", "deleted_at",
    "actions"
  ],

  manager: [
    "organization", "facility",
    "trigger_feature_module", "trigger_module",
    "billableItem", "auto_generate", "charge_mode", "default_price",
    "status",
    "createdBy", "created_at",
    "updatedBy", "updated_at",
    "actions"
  ],

  staff: [
    "facility",
    "trigger_feature_module", "trigger_module",
    "billableItem",
    "charge_mode",
    "status",
    "actions"
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (NEW – MASTER FEATURE)
   🔹 Enables card grouping + future UI sections
============================================================ */
export const FIELD_GROUPS_AUTO_BILLING_RULE = {
  org_scope: ["organization", "facility"],

  rule_logic: [
    "trigger_feature_module",
    "trigger_module",
    "billableItem",
    "auto_generate",
    "charge_mode",
    "default_price",
    "status",
  ],

  audit: [
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
  ],

  system: [
    "deletedBy",
    "deleted_at",
    "actions",
  ],
};

/* ============================================================
   💡 TOOLTIP MAP (UNCHANGED)
============================================================ */
export const TOOLTIP_AUTO_BILLING_RULE = {
  trigger_feature_module: "The system feature (e.g., Lab, Consultation, Ultrasound) that owns this rule.",
  trigger_module: "The specific module key (e.g., 'lab-results', 'consultations') linked to the billing trigger.",
  billableItem: "Linked billable item or service automatically charged when triggered.",
  auto_generate: "Indicates if billing should auto-generate upon trigger event.",
  charge_mode: "Defines how the amount is applied — fixed, per-unit, or percentage.",
  default_price: "Default charge if no override or price rule applies.",
  status: "Rule activation state — active or inactive.",
};

/* ============================================================
   ⚙️ MODULE META (STANDARDIZED)
============================================================ */
export const MODULE_KEY_AUTO_BILLING_RULE = "auto_billing_rule";
export const MODULE_LABEL_AUTO_BILLING_RULE = "Auto Billing Rule";

export const MODULE_META_AUTO_BILLING_RULE = {
  key: MODULE_KEY_AUTO_BILLING_RULE,
  label: MODULE_LABEL_AUTO_BILLING_RULE,
  icon: "💰",
  exportable: true,
  searchable: true,
  auditTrail: true,
};

/* ============================================================
   📦 UNIFIED EXPORT (MASTER PATTERN)
============================================================ */
export default {
  FIELD_LABELS_AUTO_BILLING_RULE,
  FIELD_ORDER_AUTO_BILLING_RULE,
  FIELD_DEFAULTS_AUTO_BILLING_RULE,
  FIELD_GROUPS_AUTO_BILLING_RULE,
  TOOLTIP_AUTO_BILLING_RULE,
  MODULE_KEY_AUTO_BILLING_RULE,
  MODULE_LABEL_AUTO_BILLING_RULE,
  MODULE_META_AUTO_BILLING_RULE,
};