// 📁 ultrasoundRecord-constants.js
// ============================================================
// 🧭 Enterprise-Aligned Master Pattern (Consultation-style)
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
  scan_type: "Scan Type",
  scan_date: "Scan Date",
  scan_location: "Scan Location",
  ultra_findings: "Findings",
  note: "Note",

  // 🧬 Measurements
  number_of_fetus: "No. of Fetuses",
  biparietal_diameter: "Biparietal Diameter (cm)",
  presentation: "Presentation",
  lie: "Lie",
  position: "Position",
  amniotic_volume: "Amniotic Volume",
  fetal_heart_rate: "Fetal Heart Rate",
  gender: "Gender",

  // 🧠 Clinical Info
  ultrasound_done: "Ultrasound Done",
  previous_cesarean: "Previous Cesarean",
  prev_ces_date: "Prev Cesarean Date",
  prev_ces_location: "Prev Cesarean Location",
  cesarean_date: "Cesarean Date",
  indication: "Indication",
  next_of_kin: "Next of Kin",

  // ⚙️ Meta
  is_emergency: "Emergency",
  source: "Source",
  file_path: "File Path",
  void_reason: "Void Reason",
  status: "Status",

  // 🕓 Lifecycle Audit
  verified_at: "Verified At",
  verifiedBy: "Verified By",
  finalized_at: "Finalized At",
  finalizedBy: "Finalized By",
  voided_at: "Voided At",
  voidedBy: "Voided By",

  // 🧾 System Audit
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  actions: "Actions",
};

// ============================================================
// 🧱 Field Order (used for table rendering & default exports)
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

  "scan_type",
  "scan_date",
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
  "ultrasound_done",

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

// ============================================================
// 🔐 Role-Based Field Defaults (Permission-Driven Visibility)
// ============================================================

export const FIELD_DEFAULTS_ULTRASOUND_RECORD = {
  superadmin: FIELD_ORDER_ULTRASOUND_RECORD,

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

    "scan_type",
    "scan_date",
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
    "ultrasound_done",

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

    "scan_type",
    "scan_date",
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
    "consultation",
    "technician",
    "scan_type",
    "scan_date",
    "ultra_findings",
    "fetal_heart_rate",
    "status",
    "actions",
  ],
};
