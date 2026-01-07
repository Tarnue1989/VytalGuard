// 📦 pharmacy-transaction-constants.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors payment-constants.js / deposit-constants.js for consistency
// 🔹 Keeps all original backend-safe keys and UI IDs intact
// 🔹 Supports dynamic summary rendering, exports, role-based visibility,
//    and grouped field organization for enterprise analytics
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (UI-friendly names)
============================================================ */
export const FIELD_LABELS_PHARMACY_TRANSACTION = {
  organization_id: "Organization",
  facility_id: "Facility",
  patient_id: "Patient",
  doctor_id: "Doctor",
  fulfilled_by_id: "Pharmacist",
  department_id: "Department",
  consultation_id: "Consultation",
  registration_log_id: "Registration Log",
  prescription_id: "Prescription",
  prescription_item_id: "Prescription Item",
  department_stock_id: "Department Stock / Batch",
  quantity_dispensed: "Quantity Dispensed",
  type: "Type",
  notes: "Notes",
  is_emergency: "Emergency?",
  status: "Status",
  fulfillment_date: "Fulfilled At",
  void_reason: "Void Reason",
  voided_by_id: "Voided By",
  voided_at: "Voided At",
  created_by_id: "Created By",
  updated_by_id: "Updated By",
  deleted_by_id: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  actions: "Actions",
};

/* ============================================================
   🧩 FIELD ORDER (maintains backend-safe order)
============================================================ */
export const FIELD_ORDER_PHARMACY_TRANSACTION = [
  "organization_id",
  "facility_id",
  "patient_id",
  "doctor_id",
  "fulfilled_by_id",
  "department_id",
  "consultation_id",
  "registration_log_id",
  "prescription_id",
  "prescription_item_id",
  "department_stock_id",
  "quantity_dispensed",
  "type",
  "notes",
  "is_emergency",
  "status",
  "fulfillment_date",
  "void_reason",
  "voided_by_id",
  "voided_at",
  "created_by_id",
  "created_at",
  "updated_by_id",
  "updated_at",
  "deleted_by_id",
  "deleted_at",
  "actions",
];

/* ============================================================
   👥 ROLE-BASED FIELD DEFAULTS
============================================================ */
export const FIELD_DEFAULTS_PHARMACY_TRANSACTION = {
  superadmin: [
    "organization_id",
    "facility_id",
    "patient_id",
    "doctor_id",
    "fulfilled_by_id",
    "department_id",
    "prescription_id",
    "prescription_item_id",
    "department_stock_id",
    "quantity_dispensed",
    "type",
    "notes",
    "is_emergency",
    "status",
    "fulfillment_date",
    "created_at",
    "actions",
  ],
  admin: [
    "organization_id",
    "facility_id",
    "patient_id",
    "doctor_id",
    "fulfilled_by_id",
    "department_id",
    "prescription_id",
    "prescription_item_id",
    "department_stock_id",
    "quantity_dispensed",
    "type",
    "is_emergency",
    "status",
    "fulfillment_date",
    "created_at",
    "actions",
  ],
  manager: [
    "facility_id",
    "patient_id",
    "doctor_id",
    "fulfilled_by_id",
    "department_id",
    "prescription_id",
    "department_stock_id",
    "quantity_dispensed",
    "notes",
    "is_emergency",
    "status",
    "fulfillment_date",
    "actions",
  ],
  staff: [
    "patient_id",
    "doctor_id",
    "fulfilled_by_id",
    "department_stock_id",
    "quantity_dispensed",
    "notes",
    "is_emergency",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (for summaries, exports & analytics)
============================================================ */
export const FIELD_GROUPS_PHARMACY_TRANSACTION = {
  org_scope: ["organization_id", "facility_id"],
  clinical: [
    "patient_id",
    "doctor_id",
    "fulfilled_by_id",
    "department_id",
    "consultation_id",
    "registration_log_id",
  ],
  prescription: [
    "prescription_id",
    "prescription_item_id",
    "department_stock_id",
    "quantity_dispensed",
    "type",
  ],
  operational: [
    "notes",
    "is_emergency",
    "status",
    "fulfillment_date",
    "void_reason",
  ],
  meta: [
    "created_by_id",
    "created_at",
    "updated_by_id",
    "updated_at",
    "deleted_by_id",
    "deleted_at",
  ],
  system: ["actions"],
};

/* ============================================================
   📊 SUMMARY KEYS (for #moduleSummary renderer)
============================================================ */
export const SUMMARY_KEYS_PHARMACY_TRANSACTION = [
  "pending",
  "dispensed",
  "partially_dispensed",
  "verified",
  "voided",
  "cancelled",
];
/* ============================================================
   💊 SUMMARY FIELD CONFIG (Dynamic Summary Table)
============================================================ */
// These define what fields can appear in the medication summary table

export const FIELD_LABELS_PHARMACY_SUMMARY = {
  medication_name: "Medication",
  total_requested: "Total Requested",
  total_dispensed: "Total Dispensed",
  pending_count: "Pending",
  partial_count: "Partial",
  dispensed_count: "Dispensed",
  verified_count: "Verified",
  returned_count: "Returned",
  voided_count: "Voided",
  total_value: "Total Value ($)",
  transaction_count: "# of Transactions",
};

export const FIELD_ORDER_PHARMACY_SUMMARY = [
  "medication_name",
  "total_requested",
  "total_dispensed",
  "pending_count",
  "partial_count",
  "dispensed_count",
  "verified_count",
  "returned_count",
  "voided_count",
  "total_value",
  "transaction_count",
];

export const FIELD_DEFAULTS_PHARMACY_SUMMARY = [
  "medication_name",
  "total_dispensed",
  "verified_count",
  "total_value",
  "transaction_count",
];

/* ============================================================
   ⚙️ EXPORT (for external import)
============================================================ */
export default {
  FIELD_LABELS_PHARMACY_TRANSACTION,
  FIELD_ORDER_PHARMACY_TRANSACTION,
  FIELD_DEFAULTS_PHARMACY_TRANSACTION,
  FIELD_GROUPS_PHARMACY_TRANSACTION,
  SUMMARY_KEYS_PHARMACY_TRANSACTION,
  FIELD_LABELS_PHARMACY_SUMMARY,        // ✅ added
  FIELD_ORDER_PHARMACY_SUMMARY,         // ✅ added
  FIELD_DEFAULTS_PHARMACY_SUMMARY,      // ✅ added
};
