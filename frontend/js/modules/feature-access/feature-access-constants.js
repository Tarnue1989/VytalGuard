// 🧩 Feature Access Field Labels
export const FIELD_LABELS_FEATURE_ACCESS = {
  organization_id: "Organization",
  module_id: "Module",
  role_id: "Role",
  facility_id: "Facility",
  status: "Status",

  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",

  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  actions: "Actions"
};

export const FIELD_ORDER_FEATURE_ACCESS = [
  "organization_id",
  "module_id",
  "role_id",
  "facility_id",
  "status",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions"
];

export const FIELD_DEFAULTS_FEATURE_ACCESS = {
  superadmin: [
    "organization_id",
    "module_id",
    "role_id",
    "facility_id",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions"
  ],
  admin: [
    "organization_id",
    "module_id",
    "role_id",
    "facility_id",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions"
  ],
  manager: [
    "organization_id",
    "module_id",
    "role_id",
    "facility_id",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions"
  ],
  staff: [
    "organization_id",
    "module_id",
    "status",
    "actions"
  ]
};
