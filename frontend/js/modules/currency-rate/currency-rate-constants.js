// 📁 currency-rate-fields.js – Enterprise-Aligned Master Pattern (Upgraded)
// ============================================================================
// 🔹 Pattern Source: role-fields.js (Enterprise Master)
// 🔹 Structural Consistency: Field labels, order, role-based visibility
// 🔹 100% ID retention style (safe for linked HTML and other JS modules)
// 🔹 Includes standardized metadata + hierarchical role visibility
// ============================================================================

export const FIELD_LABELS_CURRENCY_RATE = {
  organization: "Organization",
  facility: "Facility",
  from_currency: "From Currency",
  to_currency: "To Currency",
  rate: "Exchange Rate",
  effective_date: "Effective Date",
  status: "Status",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",
  actions: "Actions",
};

// ============================================================================
// 📋 Field Order (Enterprise-Consistent Across Modules)
// ============================================================================
export const FIELD_ORDER_CURRENCY_RATE = [
  "organization",
  "facility",
  "from_currency",
  "to_currency",
  "rate",
  "effective_date",
  "status",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

// ============================================================================
// 👥 Role-Based Field Visibility Defaults (Fully Enterprise-Aligned)
// ============================================================================
// 🧩 Admin: Full visibility (org, facility, metadata)
// 🧩 Manager: Scoped visibility (facility + audit trail)
// 🧩 Staff: Operational essentials only
// ============================================================================
export const FIELD_DEFAULTS_CURRENCY_RATE = {
  admin: [
    "organization",
    "facility",
    "from_currency",
    "to_currency",
    "rate",
    "effective_date",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  manager: [
    "facility",
    "from_currency",
    "to_currency",
    "rate",
    "effective_date",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "facility",
    "from_currency",
    "to_currency",
    "rate",
    "effective_date",
    "status",
    "actions",
  ],
};