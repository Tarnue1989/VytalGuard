// 📁 insurance-provider-constants.js – Enterprise Constants (MASTER PARITY)

/* ============================================================
   🧾 FIELD ORDER
============================================================ */
export const FIELD_ORDER_INSURANCE_PROVIDER = [
  "organization",
  "facility",
  "name",
  "email",
  "phone",
  "contact_info",
  "address",
  "status",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "deleted_by",
  "actions",
];

/* ============================================================
   🧾 DEFAULT FIELDS (ROLE BASED)
============================================================ */
export const FIELD_DEFAULTS_INSURANCE_PROVIDER = {
  superadmin: [
    "organization",
    "facility",
    "name",
    "email",
    "phone",
    "status",
    "created_by",
    "updated_by",
    "actions",
  ],
  admin: [
    "facility",
    "name",
    "email",
    "phone",
    "status",
    "created_by",
    "actions",
  ],
  staff: [
    "name",
    "email",
    "phone",
    "status",
    "actions",
  ],
};

/* ============================================================
   🏷 FIELD LABELS
============================================================ */
export const FIELD_LABELS_INSURANCE_PROVIDER = {
  organization: "Organization",
  facility: "Facility",
  name: "Provider Name",
  email: "Email",
  phone: "Phone",
  contact_info: "Contact Info",
  address: "Address",
  status: "Status",
  created_at: "Created At",
  updated_at: "Updated At",
  created_by: "Created By",
  updated_by: "Updated By",
  deleted_by: "Deleted By",
  actions: "Actions",
};

/* ============================================================
   🎨 STATUS STYLES (MASTER REQUIRED)
============================================================ */
export const STATUS_STYLES_INSURANCE_PROVIDER = {
  active: "success",
  inactive: "secondary",
};

/* ============================================================
   🔐 PERMISSIONS (ENTERPRISE CONSISTENT STANDARD)
============================================================ */
export const PERMISSIONS_INSURANCE_PROVIDER = {
  view: "insurance_providers:view",
  create: "insurance_providers:create",
  update: "insurance_providers:update",
  delete: "insurance_providers:delete",
  toggle: "insurance_providers:toggle_status",
};

/* ============================================================
   🔍 FILTER CONFIG (MASTER PARITY)
============================================================ */
export const FILTER_FIELDS_INSURANCE_PROVIDER = [
  "organization_id",
  "facility_id",
  "status",
];

/* ============================================================
   📦 EXPORT (FOR EASY IMPORT GROUPING)
============================================================ */
export default {
  FIELD_ORDER_INSURANCE_PROVIDER,
  FIELD_DEFAULTS_INSURANCE_PROVIDER,
  FIELD_LABELS_INSURANCE_PROVIDER,
  STATUS_STYLES_INSURANCE_PROVIDER,
  PERMISSIONS_INSURANCE_PROVIDER,
  FILTER_FIELDS_INSURANCE_PROVIDER,
};