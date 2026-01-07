// 📁 patientchart-constants.js
// 🩺 Master pattern adapted from consultation module for Patient Chart

/* ============================================================
   🏥 PATIENT CHART CACHE
============================================================ */
export const FIELD_LABELS_PATIENT_CHART_CACHE = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  status: "Cache Status",
  chart_snapshot: "Chart Snapshot",
  generated_at: "Generated At",
  revalidated_by: "Revalidated By",
  revalidated_at: "Revalidated At",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",
  actions: "Actions",
};

export const FIELD_ORDER_PATIENT_CHART_CACHE = [
  "organization",
  "facility",
  "patient",
  "status",
  "chart_snapshot",
  "generated_at",
  "revalidated_by",
  "revalidated_at",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

export const FIELD_DEFAULTS_PATIENT_CHART_CACHE = {
  admin: [
    "organization",
    "facility",
    "patient",
    "status",
    "generated_at",
    "revalidated_by",
    "revalidated_at",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],
  manager: [
    "facility",
    "patient",
    "status",
    "generated_at",
    "revalidated_by",
    "revalidated_at",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],
  staff: [
    "patient",
    "status",
    "generated_at",
    "revalidated_by",
    "actions",
  ],
};

/* ============================================================
   🗒️ PATIENT CHART NOTE
============================================================ */
export const FIELD_LABELS_PATIENT_CHART_NOTE = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  author: "Author",
  note_type: "Note Type",
  status: "Status",
  content: "Content",
  reviewed_by: "Reviewed By",
  reviewed_at: "Reviewed At",
  verified_by: "Verified By",
  verified_at: "Verified At",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",
  actions: "Actions",
};

export const FIELD_ORDER_PATIENT_CHART_NOTE = [
  "organization",
  "facility",
  "patient",
  "author",
  "note_type",
  "status",
  "content",
  "reviewed_by",
  "reviewed_at",
  "verified_by",
  "verified_at",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

export const FIELD_DEFAULTS_PATIENT_CHART_NOTE = {
  admin: [
    "organization",
    "facility",
    "patient",
    "author",
    "note_type",
    "status",
    "content",
    "reviewed_by",
    "reviewed_at",
    "verified_by",
    "verified_at",
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
    "author",
    "note_type",
    "status",
    "content",
    "reviewed_by",
    "reviewed_at",
    "verified_by",
    "verified_at",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],
  staff: [
    "patient",
    "author",
    "note_type",
    "content",
    "status",
    "created_at",
    "actions",
  ],
};

/* ============================================================
   👁️ PATIENT CHART VIEW LOG
============================================================ */
export const FIELD_LABELS_PATIENT_CHART_VIEW_LOG = {
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  user: "Viewer",
  action: "Action",
  viewed_at: "Viewed At",
  ip_address: "IP Address",
  user_agent: "User Agent",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",
  reviewed_by: "Reviewed By",
  reviewed_at: "Reviewed At",
  verified_by: "Verified By",
  verified_at: "Verified At",
  actions: "Actions",
};

export const FIELD_ORDER_PATIENT_CHART_VIEW_LOG = [
  "organization",
  "facility",
  "patient",
  "user",
  "action",
  "viewed_at",
  "ip_address",
  "user_agent",
  "reviewed_by",
  "reviewed_at",
  "verified_by",
  "verified_at",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

export const FIELD_DEFAULTS_PATIENT_CHART_VIEW_LOG = {
  admin: [
    "organization",
    "facility",
    "patient",
    "user",
    "action",
    "viewed_at",
    "ip_address",
    "user_agent",
    "created_at",
    "createdBy",
    "actions",
  ],
  manager: [
    "facility",
    "patient",
    "user",
    "action",
    "viewed_at",
    "ip_address",
    "user_agent",
    "actions",
  ],
  staff: [
    "patient",
    "user",
    "action",
    "viewed_at",
    "actions",
  ],
};

/* ============================================================
   🔒 ROLE-BASED FIELD VISIBILITY (for UI auto-control)
============================================================ */

export const FIELD_VISIBILITY_PATIENT_CHART_CACHE = {
  superadmin: FIELD_ORDER_PATIENT_CHART_CACHE,
  admin: FIELD_DEFAULTS_PATIENT_CHART_CACHE.admin,
  manager: FIELD_DEFAULTS_PATIENT_CHART_CACHE.manager,
  staff: FIELD_DEFAULTS_PATIENT_CHART_CACHE.staff,
};

export const FIELD_VISIBILITY_PATIENT_CHART_NOTE = {
  superadmin: FIELD_ORDER_PATIENT_CHART_NOTE,
  admin: FIELD_DEFAULTS_PATIENT_CHART_NOTE.admin,
  manager: FIELD_DEFAULTS_PATIENT_CHART_NOTE.manager,
  staff: FIELD_DEFAULTS_PATIENT_CHART_NOTE.staff,
};

export const FIELD_VISIBILITY_PATIENT_CHART_VIEW_LOG = {
  superadmin: FIELD_ORDER_PATIENT_CHART_VIEW_LOG,
  admin: FIELD_DEFAULTS_PATIENT_CHART_VIEW_LOG.admin,
  manager: FIELD_DEFAULTS_PATIENT_CHART_VIEW_LOG.manager,
  staff: FIELD_DEFAULTS_PATIENT_CHART_VIEW_LOG.staff,
};
