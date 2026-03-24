// 📁 order-constants.js – Enterprise MASTER–ALIGNED (LabRequest → Order Adaptation)
// ============================================================================
// 🔹 Pattern Source: lab-request-constants.js (Enterprise MASTER)
// 🔹 Adapted for Order module (billable items instead of lab tests)
// 🔹 100% MASTER parity (RBAC, table, card, export safe)
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_ORDER = {
  // 🏢 Core Relations
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  provider: "Provider",
  department: "Department",
  consultation: "Consultation",
  registrationLog: "Registration Log",

  // 📦 Order Details
  items: "Order Items",
  order_date: "Order Date",
  notes: "Notes",
  priority: "Priority",
  status: "Status",

  // 🧾 Billing
  invoice: "Invoice",
  billableItem: "Billable Item",

  // 🕓 Lifecycle
  cancelled_at: "Cancelled At",
  cancelledBy: "Cancelled By",
  voided_at: "Voided At",
  voidedBy: "Voided By",

  // 🧠 Audit
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
   📋 FIELD ORDER
============================================================ */
export const FIELD_ORDER_ORDER = [
  // 🏢 Core
  "organization",
  "facility",
  "patient",
  "provider",
  "department",
  "consultation",
  "registrationLog",

  // 📦 Order
  "items",
  "order_date",
  "notes",
  "priority",
  "status",

  // 🧾 Billing
  "invoice",
  "billableItem",

  // 🕓 Lifecycle
  "cancelled_at",
  "cancelledBy",
  "voided_at",
  "voidedBy",

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
   👥 ROLE DEFAULTS
============================================================ */
export const FIELD_DEFAULTS_ORDER = {
  superadmin: FIELD_ORDER_ORDER,

  admin: [
    "organization",
    "facility",
    "patient",
    "provider",
    "department",
    "consultation",
    "registrationLog",
    "items",
    "order_date",
    "notes",
    "priority",
    "status",
    "invoice",
    "billableItem",
    "cancelled_at",
    "cancelledBy",
    "voided_at",
    "voidedBy",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  facility_head: [
    "facility",
    "patient",
    "provider",
    "department",
    "consultation",
    "items",
    "order_date",
    "notes",
    "priority",
    "status",
    "cancelled_at",
    "cancelledBy",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  manager: [
    "facility",
    "patient",
    "provider",
    "department",
    "consultation",
    "items",
    "order_date",
    "notes",
    "priority",
    "status",
    "cancelled_at",
    "cancelledBy",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "facility",
    "patient",
    "provider",
    "items",
    "order_date",
    "notes",
    "priority",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS
============================================================ */
export const FIELD_GROUPS_ORDER = {
  org_scope: ["organization", "facility"],
  patient_info: ["patient", "consultation", "registrationLog"],
  clinical: [
    "provider",
    "department",
    "items",
    "order_date",
    "notes",
    "priority",
  ],
  billing: ["invoice", "billableItem"],
  lifecycle: ["cancelled_at", "cancelledBy", "voided_at", "voidedBy"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ MODULE META
============================================================ */
export const MODULE_KEY_ORDER = "orders";
export const MODULE_LABEL_ORDER = "Order";

/* ============================================================
   📦 EXPORT
============================================================ */
export default {
  FIELD_LABELS_ORDER,
  FIELD_ORDER_ORDER,
  FIELD_DEFAULTS_ORDER,
  FIELD_GROUPS_ORDER,
  MODULE_KEY_ORDER,
  MODULE_LABEL_ORDER,
};