// 📦 insurance-claim-constants.js – Enterprise MASTER–ALIGNED (Insurance Claim Parity)
// ============================================================================
// 🔹 Pattern Source: payment-constants.js / deposit-constants.js
// 🔹 Structural Consistency: labels, order, RBAC visibility, metadata
// 🔹 100% ID retention (safe for existing HTML + JS modules)
// 🔹 Supports dynamic tables, cards, field selector, exports, summaries
// ============================================================================

/* ============================================================
   🏷️ FIELD LABELS (Enterprise Standard)
============================================================ */
export const FIELD_LABELS_INSURANCE_CLAIM = {
  claim_number: "Claim #",
  organization: "Organization",
  facility: "Facility",
  patient: "Patient",
  provider: "Insurance Provider",
  invoice: "Invoice",
  amount_claimed: "Amount Claimed",
  amount_approved: "Amount Approved",
  amount_paid: "Amount Paid",
  currency: "Currency",
  payment_reference: "Payment Ref",
  claim_date: "Claim Date",
  response_date: "Response Date",
  rejection_reason: "Rejection Reason",
  notes: "Notes",
  status: "Status",
  createdBy: "Created By",
  created_at: "Created At",
  updatedBy: "Updated By",
  updated_at: "Updated At",
  deletedBy: "Deleted By",
  deleted_at: "Deleted At",
  actions: "Actions",
};

/* ============================================================
   📋 FIELD ORDER (Enterprise-Consistent)
============================================================ */
export const FIELD_ORDER_INSURANCE_CLAIM = [
  "claim_number",
  "organization",
  "facility",
  "patient",
  "provider",
  "invoice",
  "amount_claimed",
  "amount_approved",
  "amount_paid",
  "currency",
  "payment_reference",
  "claim_date",
  "response_date",
  "rejection_reason",
  "notes",
  "status",
  "createdBy",
  "created_at",
  "updatedBy",
  "updated_at",
  "deletedBy",
  "deleted_at",
  "actions",
];

/* ============================================================
   👥 ROLE-BASED FIELD DEFAULTS (MASTER RBAC)
============================================================ */
export const FIELD_DEFAULTS_INSURANCE_CLAIM = {
  superadmin: [
    "claim_number",
    "organization",
    "facility",
    "patient",
    "provider",
    "invoice",
    "amount_claimed",
    "amount_approved",
    "amount_paid",
    "currency",
    "payment_reference",
    "claim_date",
    "response_date",
    "rejection_reason",
    "notes",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  admin: [
    "claim_number",
    "organization",
    "facility",
    "patient",
    "provider",
    "invoice",
    "amount_claimed",
    "amount_approved",
    "amount_paid",
    "currency",
    "payment_reference",
    "claim_date",
    "response_date",
    "rejection_reason",
    "notes",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "deletedBy",
    "deleted_at",
    "actions",
  ],

  manager: [
    "claim_number",
    "facility",
    "patient",
    "provider",
    "invoice",
    "amount_claimed",
    "amount_approved",
    "amount_paid",
    "currency",
    "payment_reference",
    "claim_date",
    "response_date",
    "status",
    "createdBy",
    "created_at",
    "updatedBy",
    "updated_at",
    "actions",
  ],

  staff: [
    "claim_number",
    "facility",
    "patient",
    "provider",
    "invoice",
    "amount_claimed",
    "amount_approved",
    "amount_paid",
    "currency",
    "status",
    "actions",
  ],
};

/* ============================================================
   🧠 FIELD GROUPS (Enterprise Optional Extension)
============================================================ */
export const FIELD_GROUPS_INSURANCE_CLAIM = {
  org_scope: ["organization", "facility"],
  patient_info: ["patient", "provider", "invoice"],
  financials: [
    "amount_claimed",
    "amount_approved",
    "amount_paid",
    "currency",
    "payment_reference",
  ],
  dates: ["claim_date", "response_date"],
  notes: ["rejection_reason", "notes"],
  meta: ["createdBy", "created_at", "updatedBy", "updated_at"],
  system: ["deletedBy", "deleted_at", "actions"],
};

/* ============================================================
   ⚙️ MODULE METADATA (Enterprise UI Context)
============================================================ */
export const MODULE_KEY_INSURANCE_CLAIM = "insurance_claims";
export const MODULE_LABEL_INSURANCE_CLAIM = "Insurance Claim";

/* ============================================================
   📦 EXPORT (Unified)
============================================================ */
export default {
  FIELD_LABELS_INSURANCE_CLAIM,
  FIELD_ORDER_INSURANCE_CLAIM,
  FIELD_DEFAULTS_INSURANCE_CLAIM,
  FIELD_GROUPS_INSURANCE_CLAIM,
  MODULE_KEY_INSURANCE_CLAIM,
  MODULE_LABEL_INSURANCE_CLAIM,
};