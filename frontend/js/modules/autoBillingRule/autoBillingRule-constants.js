// 📁 autoBillingRule-constants.js
// ============================================================================
// 🧭 Master Pattern Alignment: BillableItem / Vital / Central Stock
// 🔹 Full Enterprise Standardization for Consistent UI & Role Logic
// 🔹 Supports auto-permission mapping, tooltips, and action matrix
// 🔹 Includes Feature Module reference for dynamic linkage
// ============================================================================

/* ============================================================
   📌 FIELD LABELS
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
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  actions: "Actions",
};

/* ============================================================
   📌 FIELD ORDER
   🔹 Determines table and form rendering sequence
============================================================ */
export const FIELD_ORDER_AUTO_BILLING_RULE = [
  "organization",
  "facility",
  "trigger_feature_module",
  "trigger_module",
  "billableItem",
  "auto_generate",
  "charge_mode",
  "default_price",
  "status",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

/* ============================================================
   📌 FIELD DEFAULTS (by role)
   🔹 Controls field visibility for role-based rendering
   🔹 Used by auto field-selector UI and permission checks
============================================================ */
export const FIELD_DEFAULTS_AUTO_BILLING_RULE = {
  admin: [
    "organization", "facility", "trigger_feature_module", "trigger_module",
    "billableItem", "auto_generate", "charge_mode", "default_price",
    "status", "createdBy", "created_at", "updatedBy", "updated_at",
    "deletedBy", "deleted_at", "actions"
  ],

  manager: [
    "organization", "facility", "trigger_feature_module", "trigger_module",
    "billableItem", "auto_generate", "charge_mode", "default_price",
    "status", "createdBy", "created_at", "updatedBy", "updated_at", "actions"
  ],

  staff: [
    "facility", "trigger_feature_module", "trigger_module",
    "billableItem", "charge_mode", "status", "actions"
  ],
};

/* ============================================================
   📌 TOOLTIP MAP (Enterprise Consistency)
============================================================ */
export const TOOLTIP_AUTO_BILLING_RULE = {
  trigger_feature_module: "The system feature (e.g., Lab, Consultation, Ultrasound) that owns this rule.",
  trigger_module: "The specific module key (e.g., 'lab-results', 'consultations') linked to the billing trigger.",
  billableItem: "Linked billable item or service automatically charged when triggered.",
  auto_generate: "Indicates if billing should auto-generate upon trigger event.",
  charge_mode: "Defines how the amount is applied — fixed, per-unit, or percentage.",
  default_price: "Default charge if no override or price rule applies.",
  status: "Rule activation state — active, inactive, or deleted.",
};

/* ============================================================
   📌 MODULE META
============================================================ */
export const MODULE_META_AUTO_BILLING_RULE = {
  key: "auto_billing_rule",
  label: "Auto Billing Rule",
  icon: "💰",
  exportable: true,
  searchable: true,
  auditTrail: true,
};
