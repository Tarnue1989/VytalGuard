// 📁 billableitem-constants.js

/* ============================================================
   📌 FIELD LABELS
============================================================ */
export const FIELD_LABELS_BILLABLE_ITEM = {
  organization: "Organization",
  facility: "Facility",
  department: "Department",
  masterItem: "Master Item",
  name: "Name",
  code: "Code",
  description: "Description",
  category_id: "Category",   
  price: "Price",
  currency: "Currency",
  taxable: "Taxable",
  discountable: "Discountable",
  overrideAllowed: "Allow Override",
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
============================================================ */
export const FIELD_ORDER_BILLABLE_ITEM = [
  "organization",
  "facility",
  "department",
  "masterItem",
  "name",
  "code",
  "description",
  "category_id",  
  "price",
  "currency",
  "taxable",
  "discountable",
  "overrideAllowed",
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
============================================================ */
export const FIELD_DEFAULTS_BILLABLE_ITEM = {
  admin: [
    "organization",
    "facility",
    "department",
    "masterItem",
    "name",
    "code",
    "category_id", 
    "price",
    "currency",
    "status",
    "created_at",
    "actions",
  ],
  manager: [
    "facility",
    "department",
    "masterItem",
    "name",
    "code",
    "description",
    "category_id",   
    "price",
    "currency",
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
