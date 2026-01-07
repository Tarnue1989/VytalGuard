// 📁 prescription-constants.js
// ============================================================
// 💊 Enterprise-Aligned Master Pattern (Based on Lab Request)
// ============================================================

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

// ============================================================
// 🔐 Role-Based Field Defaults (Permission-Driven Visibility)
// ============================================================

export const FIELD_DEFAULTS_PRESCRIPTION = {
  // 👑 SuperAdmin — full field access
  superadmin: FIELD_ORDER_PRESCRIPTION,

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

  // 🏥 Manager — facility-scoped operational visibility
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

  // 👨‍⚕️ Staff — simplified prescription visibility
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
