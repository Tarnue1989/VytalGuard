// 📁 prescription-constants.js – Enterprise MASTER–ALIGNED (Lab Request Parity)
// ============================================================================
// 🔹 Pattern Source: lab-request-constants.js (Enterprise MASTER)
// 🔹 Structural Consistency: labels, order, RBAC visibility, metadata
// 🔹 100% ID retention (safe for existing HTML + JS modules)
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_PRESCRIPTION = {
  // 🏢 Core Relations
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  doctor: "Doctor",
  department: "Department",
  consultation: "Consultation",
  registrationLog: "Registration Log",

  // 💊 Prescription Details
  items: "Prescription Items",
  prescription_date: "Prescription Date",
  notes: "Notes",
  is_emergency: "Emergency",
  status: "Status",

  // 🧾 Billing / Invoice Context
  invoice: "Invoice",
  billableItem: "Billable Item",

  // 🕓 Lifecycle / Audit Trail
  cancelled_at: "Cancelled At",
  cancelledBy: "Cancelled By",
  voided_at: "Voided At",
  voidedBy: "Voided By",

  // 🧠 System Audit
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  // ⚙️ System Actions
  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER (Enterprise-Consistent)
============================================================ */
export const FIELD_ORDER_PRESCRIPTION = [
  // 🏢 Core Relations
  "organization",
  "facility",
  "patient",
  "doctor",
  "department",
  "consultation",
  "registrationLog",

  // 💊 Prescription Details
  "items",
  "prescription_date",
  "notes",
  "is_emergency",
  "status",

  // 🧾 Billing Context
  "invoice",
  "billableItem",

  // 🕓 Lifecycle / Audit Trail
  "cancelled_at",
  "cancelledBy",
  "voided_at",
  "voidedBy",

  // 🧠 System Audit
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  // ⚙️ Actions (Always Last)
  "actions",
];

/* ============================================================
   👥 ROLE-BASED FIELD DEFAULTS (MASTER RBAC)
============================================================ */
export const FIELD_DEFAULTS_PRESCRIPTION = {
  superadmin: FIELD_ORDER_PRESCRIPTION,

  admin: [
    "organization",
    "facility",
    "patient",
    "doctor",
    "department",
    "consultation",
    "registrationLog",
    "items",
    "prescription_date",
    "notes",
    "is_emergency",
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
    "doctor",
    "department",
    "consultation",
    "items",
    "prescription_date",
    "notes",
    "is_emergency",
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
    "doctor",
    "department",
    "consultation",
    "items",
    "prescription_date",
    "notes",
    "is_emergency",
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
    "doctor",
    "items",
    "prescription_date",
    "notes",
    "is_emergency",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_PRESCRIPTION = {
  org_scope: ["organization", "facility"],
  patient_info: ["patient", "consultation", "registrationLog"],
  clinical: [
    "doctor",
    "department",
    "items",
    "prescription_date",
    "notes",
    "is_emergency",
  ],
  billing: ["invoice", "billableItem"],
  lifecycle: ["cancelled_at", "cancelledBy", "voided_at", "voidedBy"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_PRESCRIPTION = "prescriptions";
export const MODULE_LABEL_PRESCRIPTION = "Prescription";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_PRESCRIPTION,
  FIELD_ORDER_PRESCRIPTION,
  FIELD_DEFAULTS_PRESCRIPTION,
  FIELD_GROUPS_PRESCRIPTION,
  MODULE_KEY_PRESCRIPTION,
  MODULE_LABEL_PRESCRIPTION,
};