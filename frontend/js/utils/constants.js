// 📁 utils/constants.js

// 🎨 Defaults & Fallback Values
export const VYTALGUARD_DEFAULTS = {
  hospital_name: "VytalGuard Hospital",
  address: "1234 Wellness Avenue, Healthy City",
  contact_email: "info@vytalguard.com",
  contact_phone: "+1 (555) 123-4567"
};

/**
 * Returns value or fallback default.
 */
export function getWithDefault(value, key) {
  return value || VYTALGUARD_DEFAULTS[key] || "";
}

// 🌐 Core Global Labels (used across multiple modules)
export const FIELD_LABELS_GLOBAL = {
  status: "Status",
  remarks: "Remarks",
  requester: "Requested By",
  approver: "Approved By",
  issuer: "Issued By",
  rejectedByUser: "Rejected By",
  createdByUser: "Created By",
  updatedByUser: "Updated By",
  deletedByUser: "Deleted By",
  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
};



// 📁 public/js/utils/constants.js

export const PAYMENT_METHODS = [
  "cash",
  "card",
  "mobile_money",
  "bank_transfer",
  "cheque",
  "insurance",
  "other"
];

export const DISCOUNT_TYPE = [
  "percentage",
  "fixed",
  "waiver"
];

export const REVERSE_TYPES = [
  "payment",
  "refund",
  "deposit",
  "waiver"
];
