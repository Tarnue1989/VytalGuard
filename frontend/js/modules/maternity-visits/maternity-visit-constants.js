// 📁 maternityVisit-constants.js
// ============================================================
// 🧭 Enterprise-Aligned Master Pattern (Ultrasound-Parity)
// ============================================================

export const FIELD_LABELS_MATERNITY_VISIT = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",

  doctor: "Doctor",
  midwife: "Midwife",
  department: "Department",

  consultation: "Consultation",
  registrationLog: "Registration Log",
  billableItem: "Billable Item",
  invoice: "Invoice",

  visit_date: "Visit Date",
  visit_type: "Visit Type",

  lnmp: "LNMP",
  expected_due_date: "Expected Due Date",
  estimated_gestational_age: "Gestational Age",
  fundus_height: "Fundus Height",
  fetal_heart_rate: "Fetal Heart Rate",
  presentation: "Presentation",
  position: "Position",
  complaint: "Complaint",

  gravida: "Gravida",
  para: "Para",
  abortion: "Abortion",
  living: "Living",
  visit_notes: "Visit Notes",

  blood_pressure: "Blood Pressure",
  weight: "Weight",
  height: "Height",
  temperature: "Temperature",
  pulse_rate: "Pulse Rate",

  is_emergency: "Emergency",
  status: "Status",

  // 🔁 Lifecycle (PARITY)
  verified_at: "Verified At",
  verifiedBy: "Verified By",
  cancelledBy: "Cancelled By",
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
// 🧱 Field Order (table + export safe)
// ============================================================

export const FIELD_ORDER_MATERNITY_VISIT = [
  "organization",
  "facility",
  "patient",

  "doctor",
  "midwife",
  "department",

  "consultation",
  "registrationLog",
  "billableItem",
  "invoice",

  "visit_date",
  "visit_type",

  "lnmp",
  "expected_due_date",
  "estimated_gestational_age",
  "fundus_height",
  "fetal_heart_rate",
  "presentation",
  "position",
  "complaint",

  "gravida",
  "para",
  "abortion",
  "living",
  "visit_notes",

  "blood_pressure",
  "weight",
  "height",
  "temperature",
  "pulse_rate",

  "is_emergency",
  "status",

  "verified_at",
  "verifiedBy",
  "cancelledBy",
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
// 🔐 Role-Based Field Defaults (Ultrasound-Style)
// ============================================================

export const FIELD_DEFAULTS_MATERNITY_VISIT = {
  superadmin: FIELD_ORDER_MATERNITY_VISIT,

  admin: FIELD_ORDER_MATERNITY_VISIT,

  manager: [
    "facility",
    "patient",
    "doctor",
    "midwife",
    "consultation",
    "registrationLog",
    "billableItem",
    "invoice",

    "visit_date",
    "visit_type",
    "lnmp",
    "expected_due_date",
    "estimated_gestational_age",
    "fundus_height",
    "fetal_heart_rate",
    "presentation",
    "position",
    "complaint",

    "gravida",
    "para",
    "abortion",
    "living",
    "visit_notes",

    "blood_pressure",
    "weight",
    "height",
    "temperature",
    "pulse_rate",

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
    "doctor",
    "midwife",

    "visit_date",
    "visit_type",
    "fundus_height",
    "fetal_heart_rate",
    "complaint",

    "gravida",
    "para",

    "blood_pressure",
    "weight",
    "height",
    "temperature",
    "pulse_rate",

    "status",
    "actions",
  ],
};
