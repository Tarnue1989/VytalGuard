// 📁 billableitem-constants.js – Enterprise-Aligned Master Pattern
// ============================================================================
// 🔹 Pattern Source: department-constants.js (Enterprise Master)
// 🔹 Structural Consistency: Field labels, order, role-based visibility
// 🔹 100% ID retention (safe for linked HTML + JS modules)
// 🔹 Includes standardized metadata + hierarchical visibility map
// ============================================================================

/* ============================================================
   🏷️ Field Labels
============================================================ */
export const FIELD_LABELS_BILLABLE_ITEM = {
  organization: "Organization",
  facility: "Facility",
  department: "Department",
  masterItem: "Master Item",
  name: "Name",
  code: "Code",
  description: "Description",
  category: "Category",
  price: "Price",
  currency: "Currency",
  taxable: "Taxable",
  discountable: "Discountable",
  override_allowed: "Allow Override",
  status: "Status",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",
  actions: "Actions",
};

/* ============================================================
   📋 Field Order (Enterprise-Consistent)
============================================================ */
export const FIELD_ORDER_BILLABLE_ITEM = [
  "organization",
  "facility",
  "department",
  "masterItem",
  "name",
  "code",
  "description",
  "category",
  "price",
  "currency",
  "taxable",
  "discountable",
  "override_allowed",
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
   👥 Role-Based Field Visibility Defaults (Enterprise Master)
============================================================ */
export const FIELD_DEFAULTS_BILLABLE_ITEM = {
  superadmin: [
    "organization",
    "facility",
    "department",
    "masterItem",
    "name",
    "code",
    "description",
    "category",
    "price",
    "currency",
    "taxable",
    "discountable",
    "override_allowed",
    "status",
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
    "department",
    "masterItem",
    "name",
    "code",
    "description",
    "category",
    "price",
    "currency",
    "taxable",
    "discountable",
    "override_allowed",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  facility_head: [
    "facility",
    "department",
    "masterItem",
    "name",
    "code",
    "description",
    "category",
    "price",
    "currency",
    "taxable",
    "discountable",
    "override_allowed",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "facility",
    "department",
    "masterItem",
    "name",
    "code",
    "description",
    "category",
    "price",
    "currency",
    "taxable",
    "discountable",
    "override_allowed",
    "status",
    "actions",
  ],

  staff: [
    "department",
    "masterItem",
    "name",
    "description",
    "price",
    "currency",
    "status",
    "actions",
  ],
};

/* ============================================================
   ⚙️ Module Metadata
============================================================ */
export const MODULE_KEY_BILLABLE_ITEM = "billableItem";
export const MODULE_LABEL_BILLABLE_ITEM = "Billable Item";
