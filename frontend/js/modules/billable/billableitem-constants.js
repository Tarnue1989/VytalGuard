// 📁 billableitem-constants.js – FINAL (Enterprise MASTER + Pricing-Aware)
// ============================================================================
// 🔹 Upgraded for BILLABLE ITEM CONTROLLER (multi-price + payer_type ready)
// 🔹 Maintains MASTER structure (department pattern)
// 🔹 Adds payer_type support + audit consistency
// 🔹 100% ID safe (no breaking changes)
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

  // 🔥 PRICING (UPDATED)
  payer_type: "Payer Type",
  price: "Price",
  currency: "Currency",

  taxable: "Taxable",
  discountable: "Discountable",
  override_allowed: "Allow Override",
  status: "Status",

  // 🔥 AUDIT (CONSISTENT WITH CONTROLLER)
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  actions: "Actions",
};

/* ============================================================
   📋 Field Order (Enterprise-Consistent + Pricing Inserted)
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

  // 🔥 PRICING POSITIONED PROPERLY
  "payer_type",
  "price",
  "currency",

  "taxable",
  "discountable",
  "override_allowed",
  "status",

  // 🔥 AUDIT (ORDER STANDARDIZED)
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  "actions",
];

/* ============================================================
   👥 Role-Based Field Visibility Defaults (Enterprise MASTER)
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

    "payer_type",
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

    "payer_type",
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

    "payer_type",
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

    "payer_type",
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

    "payer_type",
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