// 📁 lab-request-constants.js
// ============================================================
// 🧭 Enterprise-Aligned Master Pattern (Central Stock Style)
// ============================================================

export const FIELD_LABELS_LAB_REQUEST = {
  // 🏢 Core Relations
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  doctor: "Doctor",
  department: "Department",
  consultation: "Consultation",
  registrationLog: "Registration Log",

  // 🔬 Request Details
  items: "Lab Tests / Items",
  request_date: "Request Date",
  notes: "Notes",
  is_emergency: "Emergency",
  status: "Status",

  // 🧾 Billing / Invoice Context
  invoice: "Invoice",
  billableItem: "Billable Item",

  // 🕓 Lifecycle / Audit Trail
  voided_at: "Voided At",
  voidedBy: "Voided By",
  cancelled_at: "Cancelled At",
  cancelledBy: "Cancelled By",

  // 🧠 System Audit
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  // ⚙️ System Actions
  actions: "Actions",
};

// ============================================================
// 🧱 Field Order (Dynamic Table + Export Alignment)
// ============================================================

export const FIELD_ORDER_LAB_REQUEST = [
  // 🏢 Core Relations
  "organization",
  "facility",
  "patient",
  "doctor",
  "department",
  "consultation",
  "registrationLog",

  // 🔬 Request Details
  "items",
  "request_date",
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

// ============================================================
// 🔐 Role-Based Field Defaults (Permission-Driven Visibility)
// ============================================================

export const FIELD_DEFAULTS_LAB_REQUEST = {
  // 👑 SuperAdmin — full field access
  superadmin: FIELD_ORDER_LAB_REQUEST,

  // 🧭 Admin — full operational + audit visibility
  admin: [
    "organization",
    "facility",
    "patient",
    "doctor",
    "department",
    "consultation",
    "registrationLog",
    "items",
    "request_date",
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

  // 🏥 Manager — facility-scoped operational visibility
  manager: [
    "facility",
    "patient",
    "doctor",
    "department",
    "consultation",
    "items",
    "request_date",
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

  // 👨‍⚕️ Staff — simplified request visibility
  staff: [
    "facility",
    "patient",
    "doctor",
    "items",
    "request_date",
    "notes",
    "is_emergency",
    "status",
    "actions",
  ],
};
