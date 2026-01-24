// 📁 ultrasoundRecord-constants.js – MASTER-ALIGNED (Delivery Record Pattern)
// ============================================================
// 🧭 Enterprise Master Pattern (DeliveryRecord-style)
// ============================================================

export const FIELD_LABELS_ULTRASOUND_RECORD = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  consultation: "Consultation",
  maternityVisit: "Maternity Visit",
  registrationLog: "Registration Log",
  department: "Department",
  billableItem: "Billable Item",
  invoice: "Invoice",
  technician: "Technician",

  // 🔍 Scan Info
  scan_date: "Scan Date",
  scan_type: "Scan Type",
  scan_location: "Scan Location",
  ultra_findings: "Findings",
  note: "Notes",

  // 🧬 Measurements
  number_of_fetus: "No. of Fetuses",
  biparietal_diameter: "Biparietal Diameter",
  presentation: "Presentation",
  lie: "Lie",
  position: "Position",
  amniotic_volume: "Amniotic Volume",
  fetal_heart_rate: "Fetal Heart Rate",
  gender: "Gender",

  // 🧠 Clinical / History
  previous_cesarean: "Previous Cesarean",
  prev_ces_date: "Prev Cesarean Date",
  prev_ces_location: "Prev Cesarean Location",
  cesarean_date: "Cesarean Date",
  indication: "Indication",
  next_of_kin: "Next of Kin",

  // ⚙️ Status & Flags
  is_emergency: "Emergency?",
  source: "Source",
  file_path: "File Path",
  void_reason: "Void / Cancel Reason",
  status: "Status",

  // 🧾 Lifecycle / Audit
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",

  cancelledBy: "Cancelled By",
  cancelled_at: "Cancelled At",
  verifiedBy: "Verified By",
  verified_at: "Verified At",
  finalizedBy: "Finalized By",
  finalized_at: "Finalized At",
  voidedBy: "Voided By",
  voided_at: "Voided At",

  // ⚙️ System
  actions: "Actions",
};

// ============================================================
// 🧱 Field Order (Canonical – Table / Card / Export)
// ============================================================

export const FIELD_ORDER_ULTRASOUND_RECORD = [
  "organization",
  "facility",
  "patient",
  "consultation",
  "maternityVisit",
  "registrationLog",
  "department",
  "billableItem",
  "invoice",
  "technician",

  "scan_date",
  "scan_type",
  "scan_location",
  "ultra_findings",
  "note",

  "number_of_fetus",
  "biparietal_diameter",
  "presentation",
  "lie",
  "position",
  "amniotic_volume",
  "fetal_heart_rate",
  "gender",

  "previous_cesarean",
  "prev_ces_date",
  "prev_ces_location",
  "cesarean_date",
  "indication",
  "next_of_kin",

  "is_emergency",
  "source",
  "file_path",
  "void_reason",
  "status",

  "cancelledBy",
  "cancelled_at",
  "verifiedBy",
  "verified_at",
  "finalizedBy",
  "finalized_at",
  "voidedBy",
  "voided_at",

  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  "actions",
];

// ============================================================
// 🔐 Role-Based Field Defaults (Delivery MASTER Pattern)
// ============================================================

export const FIELD_DEFAULTS_ULTRASOUND_RECORD = {
  admin: [
    "organization",
    "facility",
    "patient",
    "consultation",
    "maternityVisit",
    "registrationLog",
    "department",
    "billableItem",
    "invoice",
    "technician",

    "scan_date",
    "scan_type",
    "scan_location",
    "ultra_findings",
    "note",

    "number_of_fetus",
    "biparietal_diameter",
    "presentation",
    "lie",
    "position",
    "amniotic_volume",
    "fetal_heart_rate",
    "gender",

    "previous_cesarean",
    "prev_ces_date",
    "prev_ces_location",
    "cesarean_date",
    "indication",
    "next_of_kin",

    "is_emergency",
    "source",
    "file_path",
    "void_reason",
    "status",

    "cancelledBy",
    "cancelled_at",
    "verifiedBy",
    "verified_at",
    "finalizedBy",
    "finalized_at",
    "voidedBy",
    "voided_at",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",

    "actions",
  ],

  manager: [
    "facility",
    "patient",
    "consultation",
    "maternityVisit",
    "registrationLog",
    "department",
    "billableItem",
    "invoice",
    "technician",

    "scan_date",
    "scan_type",
    "scan_location",
    "ultra_findings",
    "note",

    "number_of_fetus",
    "presentation",
    "position",
    "amniotic_volume",
    "fetal_heart_rate",
    "gender",

    "previous_cesarean",
    "indication",
    "is_emergency",
    "status",

    "verifiedBy",
    "verified_at",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",

    "actions",
  ],

  staff: [
    "facility",
    "patient",
    "consultation",
    "technician",

    "scan_date",
    "scan_type",
    "ultra_findings",
    "fetal_heart_rate",

    "status",
    "actions",
  ],
};

// ============================================================
// 🎭 Field Masks (Compact – Delivery MASTER Pattern)
// ============================================================

export const FIELD_MASKS_ULTRASOUND_RECORD = {
  scan_date: "date",
  prev_ces_date: "date",
  cesarean_date: "date",

  created_at: "datetime",
  updated_at: "datetime",
  deleted_at: "datetime",
  cancelled_at: "datetime",
  verified_at: "datetime",
  finalized_at: "datetime",
  voided_at: "datetime",

  is_emergency: "boolean",
  previous_cesarean: "boolean",

  number_of_fetus: "number",
  biparietal_diameter: "decimal",
  amniotic_volume: "decimal",
  fetal_heart_rate: "number",
};
