// 📁 billable-item-constants.js – Enterprise MASTER–ALIGNED (Billable Item Parity)
// ============================================================================
// 🔹 Converted from: prescription-constants.js
// 🔹 Pattern Source: lab-request-constants.js (Enterprise MASTER)
// 🔹 Structural Consistency: labels, order, RBAC visibility, metadata
// 🔹 100% ID retention (safe for existing HTML + JS modules)
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_BILLABLE_ITEM = {
  // 🏢 Core Relations
  organization: "Organization",
  facility: "Facility",
  department: "Department",
  masterItem: "Master Item",
  category: "Category",

  // 💰 Billable Item Details
  name: "Name",
  code: "Code",
  description: "Description",
  prices: "Prices",
  price: "Price",
  currency: "Currency",
  payer_type: "Payer Type",
  is_default: "Default Price",

  // ⚙️ Flags
  taxable: "Taxable",
  discountable: "Discountable",
  override_allowed: "Override Allowed",
  status: "Status",

  // 🕓 Lifecycle / Audit
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  // ⚙️ Actions
  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER (Enterprise-Consistent)
============================================================ */
export const FIELD_ORDER_BILLABLE_ITEM = [
  // 🏢 Core
  "organization",
  "facility",
  "department",
  "masterItem",
  "category",

  // 💰 Details
  "name",
  "code",
  "description",
  "prices",
  "price",
  "currency",
  "payer_type",
  "is_default",

  // ⚙️ Flags
  "taxable",
  "discountable",
  "override_allowed",
  "status",

  // 🧠 Audit
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  // ⚙️ Actions
  "actions",
];

/* ============================================================
   👥 ROLE-BASED FIELD DEFAULTS (MASTER RBAC)
============================================================ */
export const FIELD_DEFAULTS_BILLABLE_ITEM = {
  superadmin: FIELD_ORDER_BILLABLE_ITEM,

  admin: [
    "organization",
    "facility",
    "department",
    "masterItem",
    "category",
    "name",
    "code",
    "prices",
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
    "category",
    "name",
    "prices",
    "status",
    "createdBy",
    "created_at",
    "actions",
  ],

  manager: [
    "facility",
    "department",
    "masterItem",
    "category",
    "name",
    "prices",
    "status",
    "createdBy",
    "created_at",
    "actions",
  ],

  staff: [
    "facility",
    "name",
    "prices",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_BILLABLE_ITEM = {
  org_scope: ["organization", "facility"],
  item_info: ["name", "code", "description"],
  classification: ["masterItem", "category", "department"],
  pricing: ["prices", "price", "currency", "payer_type", "is_default"],
  flags: ["taxable", "discountable", "override_allowed"],
  lifecycle: ["status"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_BILLABLE_ITEM = "billable_items";
export const MODULE_LABEL_BILLABLE_ITEM = "Billable Item";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_BILLABLE_ITEM,
  FIELD_ORDER_BILLABLE_ITEM,
  FIELD_DEFAULTS_BILLABLE_ITEM,
  FIELD_GROUPS_BILLABLE_ITEM,
  MODULE_KEY_BILLABLE_ITEM,
  MODULE_LABEL_BILLABLE_ITEM,
};