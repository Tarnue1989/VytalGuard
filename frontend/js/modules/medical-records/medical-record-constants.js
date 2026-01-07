// 📁 medicalRecord-constants.js (Upgraded Enterprise-Aligned)
// ============================================================
// 🧭 Master Pattern: Consultation (Central Stock + Clinical Standard)
// Purpose: Define labels, order, and role-based visibility for Medical Records
// ============================================================

export const FIELD_LABELS_MEDICAL_RECORD = {
  /* =========================
     📋 Core Metadata
  ========================= */
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  doctor: "Doctor",
  consultation: "Consultation",
  registrationLog: "Registration Log",
  invoice: "Invoice",

  /* =========================
     🧠 Clinical History
  ========================= */
  cc: "Chief Complaint",
  hpi: "History of Present Illness",
  pmh: "Past Medical History",
  fh_sh: "Family/Social History",
  nut_hx: "Nutritional History",
  imm_hx: "Immunization History",
  obs_hx: "Obstetric History",
  gyn_hx: "Gynecological History",

  /* =========================
     🩺 Physical Examination
  ========================= */
  pe: "General Exam",
  resp_ex: "Respiratory Exam",
  cv_ex: "Cardiovascular Exam",
  abd_ex: "Abdominal Exam",
  pel_ex: "Pelvic Exam",
  ext: "Extremities",
  neuro_ex: "Neurological Exam",

  /* =========================
     🧾 Diagnosis & Plan
  ========================= */
  ddx: "Differential Diagnosis",
  dx: "Final Diagnosis",
  lab_inv: "Lab Investigations",
  img_inv: "Imaging Investigations",
  tx_mx: "Treatment / Management",
  summary_pg: "Summary / Progress",

  /* =========================
     🧩 Attachments & Flags
  ========================= */
  report_path: "Report File",
  is_emergency: "Emergency?",
  status: "Status",

  /* =========================
     🔐 Audit & Lifecycle
  ========================= */
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  reviewedBy: "Reviewed By",
  finalizedBy: "Finalized By",
  verifiedBy: "Verified By",
  voidedBy: "Voided By",

  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  reviewed_at: "Reviewed At",
  finalized_at: "Finalized At",
  verified_at: "Verified At",
  voided_at: "Voided At",

  void_reason: "Void Reason",
  actions: "Actions",
};

// ============================================================
// 📋 Field Order (for consistent column & form rendering)
// ============================================================
export const FIELD_ORDER_MEDICAL_RECORD = [
  // Core
  "organization",
  "facility",
  "patient",
  "doctor",
  "consultation",
  "registrationLog",
  "invoice",

  // Clinical History
  "cc",
  "hpi",
  "pmh",
  "fh_sh",
  "nut_hx",
  "imm_hx",
  "obs_hx",
  "gyn_hx",

  // Physical Exam
  "pe",
  "resp_ex",
  "cv_ex",
  "abd_ex",
  "pel_ex",
  "ext",
  "neuro_ex",

  // Diagnosis & Plan
  "ddx",
  "dx",
  "lab_inv",
  "img_inv",
  "tx_mx",
  "summary_pg",

  // Attachments / Flags
  "report_path",
  "is_emergency",
  "status",

  // Audit
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "reviewedBy",
  "reviewed_at",
  "finalizedBy",
  "finalized_at",
  "verifiedBy",
  "verified_at",
  "voidedBy",
  "voided_at",
  "void_reason",
  "actions",
];

// ============================================================
// 👥 Field Defaults (role-based visibility)
// ============================================================
export const FIELD_DEFAULTS_MEDICAL_RECORD = {
  admin: [
    "organization",
    "facility",
    "patient",
    "doctor",
    "consultation",
    "registrationLog",
    "invoice",
    "cc",
    "hpi",
    "pmh",
    "fh_sh",
    "nut_hx",
    "imm_hx",
    "obs_hx",
    "gyn_hx",
    "pe",
    "resp_ex",
    "cv_ex",
    "abd_ex",
    "pel_ex",
    "ext",
    "neuro_ex",
    "ddx",
    "dx",
    "lab_inv",
    "img_inv",
    "tx_mx",
    "summary_pg",
    "report_path",
    "is_emergency",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "reviewedBy",
    "reviewed_at",
    "finalizedBy",
    "finalized_at",
    "verifiedBy",
    "verified_at",
    "voidedBy",
    "voided_at",
    "void_reason",
    "actions",
  ],

  manager: [
    "facility",
    "patient",
    "doctor",
    "consultation",
    "registrationLog",
    "invoice",
    "cc",
    "hpi",
    "pmh",
    "fh_sh",
    "nut_hx",
    "imm_hx",
    "obs_hx",
    "gyn_hx",
    "pe",
    "resp_ex",
    "cv_ex",
    "abd_ex",
    "pel_ex",
    "ext",
    "neuro_ex",
    "ddx",
    "dx",
    "lab_inv",
    "img_inv",
    "tx_mx",
    "summary_pg",
    "report_path",
    "is_emergency",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "reviewedBy",
    "reviewed_at",
    "finalizedBy",
    "finalized_at",
    "verifiedBy",
    "verified_at",
    "voidedBy",
    "voided_at",
    "void_reason",
    "actions",
  ],

  staff: [
    "facility",
    "patient",
    "doctor",
    "consultation",
    "cc",
    "hpi",
    "pmh",
    "fh_sh",
    "pe",
    "dx",
    "tx_mx",
    "is_emergency",
    "status",
    "actions",
  ],
};
