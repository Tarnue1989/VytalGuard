// 📦 surgery-constants.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors centralstock-constants.js for unified enterprise behavior
// 🔹 Preserves all field keys for linked HTML/JS modules
// 🔹 Supports role-based defaults and dynamic visibility logic
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS
============================================================ */
export const FIELD_LABELS_SURGERY = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  consultation: "Consultation",
  department: "Department",
  billableItem: "Billable Item",
  invoice: "Invoice",
  surgeon: "Surgeon",

  scheduled_date: "Scheduled Date",
  surgery_type: "Surgery Type",
  duration_minutes: "Duration (Minutes)",
  anesthesia_type: "Anesthesia Type",
  complications: "Complications",
  notes: "Notes",
  document_url: "Document URL",

  is_emergency: "Emergency?",
  status: "Status",

  verified_at: "Verified At",
  verifiedBy: "Verified By",
  finalized_at: "Finalized At",
  finalizedBy: "Finalized By",
  voided_at: "Voided At",
  voidedBy: "Voided By",

  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER
============================================================ */
export const FIELD_ORDER_SURGERY = [
  "organization",
  "facility",
  "patient",
  "consultation",
  "department",
  "billableItem",
  "invoice",
  "surgeon",
  "scheduled_date",
  "surgery_type",
  "duration_minutes",
  "anesthesia_type",
  "complications",
  "notes",
  "document_url",
  "is_emergency",
  "status",
  "verified_at",
  "verifiedBy",
  "finalized_at",
  "finalizedBy",
  "voided_at",
  "voidedBy",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

/* ============================================================
   👥 FIELD DEFAULTS BY ROLE
============================================================ */
export const FIELD_DEFAULTS_SURGERY = {
  admin: [
    "organization",
    "facility",
    "patient",
    "consultation",
    "department",
    "billableItem",
    "invoice",
    "surgeon",
    "scheduled_date",
    "surgery_type",
    "duration_minutes",
    "anesthesia_type",
    "is_emergency",
    "status",
    "created_at",
    "actions",
  ],
  manager: [
    "facility",
    "patient",
    "consultation",
    "department",
    "billableItem",
    "invoice",
    "surgeon",
    "scheduled_date",
    "surgery_type",
    "duration_minutes",
    "anesthesia_type",
    "complications",
    "notes",
    "is_emergency",
    "status",
    "verified_at",
    "verifiedBy",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],
  staff: [
    "facility",
    "patient",
    "surgeon",
    "scheduled_date",
    "surgery_type",
    "status",
    "actions",
  ],
};
