// 📁 discount-policy-constants.js

export const FIELD_LABELS_DISCOUNT_POLICY = {
  organization: "Organization",
  facility: "Facility",

  code: "Code",
  name: "Name",
  description: "Description",

  discount_type: "Discount Type",      // percentage | fixed | waiver
  discount_value: "Discount Value",    // numeric or %

  applies_to: "Applies To",            // all | billable_item | category | department | patient_class
  condition_json: "Conditions",        // JSON rules

  effective_from: "Effective From",
  effective_to: "Effective To",

  status: "Status",                    // active | inactive | expired

  // 🛡️ Audit fields
  createdBy: "Created By",
  updatedBy: "Updated By",
  deletedBy: "Deleted By",

  activatedBy: "Activated By",
  deactivatedBy: "Deactivated By",
  expiredBy: "Expired By",

  // 🕑 Timestamps
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  activated_at: "Activated At",
  deactivated_at: "Deactivated At",
  expired_at: "Expired At",

  actions: "Actions",
};

export const FIELD_ORDER_DISCOUNT_POLICY = [
  "organization",
  "facility",

  "code",
  "name",
  "description",

  "discount_type",
  "discount_value",
  "applies_to",
  "condition_json",

  "effective_from",
  "effective_to",
  "status",

  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",

  "activatedBy",
  "activated_at",
  "deactivatedBy",
  "deactivated_at",
  "expiredBy",
  "expired_at",

  "actions",
];

export const FIELD_DEFAULTS_DISCOUNT_POLICY = {
  admin: [
    "organization",
    "facility",
    "code",
    "name",
    "description",
    "discount_type",
    "discount_value",
    "applies_to",
    "condition_json",
    "effective_from",
    "effective_to",
    "status",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "activatedBy",
    "activated_at",
    "deactivatedBy",
    "deactivated_at",
    "expiredBy",
    "expired_at",

    "actions",
  ],
  manager: [
    "facility",
    "code",
    "name",
    "description",
    "discount_type",
    "discount_value",
    "applies_to",
    "effective_from",
    "effective_to",
    "status",

    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "activatedBy",
    "activated_at",

    "actions",
  ],
  staff: [
    "facility",
    "code",
    "name",
    "discount_type",
    "discount_value",
    "applies_to",
    "status",
    "actions",
  ],
};
