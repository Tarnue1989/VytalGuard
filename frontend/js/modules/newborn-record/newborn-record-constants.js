/* ============================================================
   📌 Newborn Record Module Field Config
   ============================================================ */

export const FIELD_LABELS_NEWBORN_RECORD = {
  id: "ID",
  organization: "Organization",
  facility: "Facility",
  mother: "Mother",
  deliveryRecord: "Delivery Record",
  gender: "Gender",
  birth_weight: "Birth Weight (kg)",
  birth_length: "Birth Length (cm)",
  head_circumference: "Head Circumference (cm)",
  apgar_score_1min: "APGAR Score (1 min)",
  apgar_score_5min: "APGAR Score (5 min)",
  measurement_notes: "Measurement Notes",
  complications: "Complications",
  notes: "Notes",
  status: "Status",
  death_reason: "Death Reason",
  death_time: "Death Time",
  transfer_reason: "Transfer Reason",
  transferFacility: "Transfer Facility",  // ✅ alias
  transfer_time: "Transfer Time",
  void_reason: "Void Reason",
  voidedBy: "Voided By",                  // ✅ alias
  voided_at: "Voided At",
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  actions: "Actions",
};

export const FIELD_ORDER_NEWBORN_RECORD = [
  "id","organization","facility","mother","deliveryRecord","gender",
  "birth_weight","birth_length","head_circumference","apgar_score_1min",
  "apgar_score_5min","measurement_notes","complications","notes","status",
  "death_reason","death_time","transfer_reason","transferFacility","transfer_time",
  "void_reason","voidedBy","voided_at","createdBy","created_at",
  "updatedBy","updated_at","deletedBy","deleted_at","actions",
];

export const FIELD_DEFAULTS_NEWBORN_RECORD = {
  superadmin: [
    "organization","facility","mother","deliveryRecord","gender",
    "birth_weight","birth_length","head_circumference","apgar_score_1min","apgar_score_5min",
    "measurement_notes","complications","notes","status","death_reason","death_time",
    "transfer_reason","transferFacility","transfer_time","void_reason","voidedBy","voided_at","actions",
  ],
  admin: [
    "organization","facility","mother","deliveryRecord","gender",
    "birth_weight","birth_length","head_circumference","apgar_score_1min","apgar_score_5min",
    "measurement_notes","complications","notes","status","death_reason","death_time",
    "transfer_reason","transferFacility","transfer_time","void_reason","voidedBy","voided_at","actions",
  ],
  manager: [
    "facility","mother","deliveryRecord","gender",
    "birth_weight","birth_length","head_circumference","apgar_score_1min","apgar_score_5min",
    "complications","notes","status","actions",
  ],
  staff: [
    "mother","deliveryRecord","gender",
    "birth_weight","apgar_score_1min","apgar_score_5min","status","actions",
  ],
};
