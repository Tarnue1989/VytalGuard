// ============================================================
// 🔹 User & Roles
// ============================================================
export const USER_STATUS = ['active', 'inactive', 'suspended'];
export const ROLE_TYPE = ['system', 'custom'];
export const ROLE_STATUS = ['active', 'inactive'];

// ============================================================
// 🔹 Facility & Organization
// ============================================================
export const FACILITY_STATUS = ['active', 'inactive'];
export const ORG_STATUS = ['active', 'inactive'];

// ============================================================
// 🔹 Employee & Departments
// ============================================================
export const EMPLOYEE_STATUS = ['active', 'inactive', 'on_leave', 'terminated'];
export const DEPARTMENT_STATUS = ['active', 'inactive'];
export const GENDER_TYPES = ['male', 'female'];

// ============================================================
// 🔹 Patient Demographics
// ============================================================
export const MARITAL_STATUS = ['single', 'married', 'divorced', 'widowed', 'other'];

export const RELIGIONS = [
  'christianity',
  'islam',
  'hinduism',
  'buddhism',
  'traditional',
  'none',
  'other',
];

export const DOB_PRECISION = ['exact', 'approximate', 'year_only'];


// ============================================================
// 🔹 Feature Modules & Access
// ============================================================
export const FEATURE_MODULE_STATUS = ['active', 'inactive'];
export const FEATURE_ACCESS_STATUS = ['active', 'inactive'];
export const USER_FACILITY_STATUS = ['active', 'inactive'];

// ============================================================
// 🔹 Administrative Lifecycles
// ============================================================
export const REGISTRATION_LOG_STATUS = ['draft', 'pending', 'active', 'completed', 'cancelled', 'voided'];
export const REGISTRATION_METHODS = ['walk_in', 'appointment', 'referral', 'transfer'];
export const REGISTRATION_CATEGORIES = ['general', 'insured', 'vip', 'staff', 'charity'];
// 🔹 Patient Lifecycle (USED BY Patient MODEL)
export const PATIENT_STATUS = ['active', 'cancelled'];

// ============================================================
// 🔹 Encounter Lifecycles
// ============================================================
export const CONSULTATION_STATUS = ['open', 'in_progress', 'completed', 'verified', 'cancelled', 'voided'];
export const TRIAGE_STATUS = ['open', 'in_progress', 'completed', 'verified', 'cancelled', 'voided'];
export const VITAL_STATUS = ['open', 'in_progress', 'completed', 'verified', 'cancelled', 'voided'];
export const RECOMMENDATION_STATUS = ['pending', 'confirmed', 'declined',"voided",];

// ============================================================
// 🔹 Document Lifecycles
// ============================================================
export const MEDICAL_RECORD_STATUS = ['draft', 'reviewed', 'finalized', 'verified', 'voided'];

// ============================================================
// 🔹 Staff Roles
// ============================================================
export const CONSULTATION_STAFF_ROLES = ['nurse', 'midwife', 'assistant', 'pharmacist', 'labtech', 'panelist'];

// ============================================================
// 🔹 Plans & Subscriptions
// ============================================================
export const PLAN_STATUS = ['active', 'inactive'];
export const ORG_PLAN_STATUS = ['active', 'inactive', 'expired', 'cancelled'];
export const PLAN_MODULE_STATUS = ['active', 'inactive'];

// ============================================================
// 🔹 Billing & Finance
// ============================================================
export const INVOICE_STATUS = ['draft', 'issued', 'unpaid', 'partial', 'paid', 'cancelled', 'voided'];
export const PAYMENT_STATUS = ['pending', 'completed', 'failed', 'cancelled', 'reversed', 'voided', 'verified'];
export const REFUND_STATUS = ['pending', 'approved', 'rejected', 
  'processed', 'cancelled', "reversed", 'voided',];
// ============================================================
// 🔹 Deposit Refund Lifecycle (Enterprise-Grade)
// ============================================================
export const DEPOSIT_REFUND_STATUS = {
  PENDING: "pending",
  REVIEW: "review",
  APPROVED: "approved",
  PROCESSED: "processed",

  // ❗ Reason-required lifecycle branches
  REJECTED: "rejected",
  CANCELLED: "cancelled",

  // ❗ Full lifecycle support
  VOIDED: "voided",
  REVERSED: "reversed",
  RESTORED: "restored",
};

/* -------------------- Refund Transaction Status -------------------- */
export const REFUND_TRANSACTION_STATUS = [
  "pending",  "approved",  "processed",  "rejected",  "cancelled", 
  "reversed"  
];

export const DEPOSIT_STATUS = ['pending', 'cleared', 'applied', 'cancelled', "reversed", 'voided', 'verified'];

export const AUTO_BILLING_RULE_STATUS = ['active', 'inactive'];
export const BILLABLE_ITEM_STATUS = ['active', 'inactive'];

// 🔹 Waivers (separate model with workflow)
export const DISCOUNT_WAIVER_STATUS = ['pending', 'approved', 'applied', 'rejected', 'voided', 'finalized',];

// 🔹 Direct discounts (math only)
export const DISCOUNT_TYPE = ['percentage', 'fixed'];
// Discount lifecycle
export const DISCOUNT_STATUS = [ 'draft',  'active', 'inactive', 'finalized', 'voided' ];
export const POLICY_APPLIES_TO = ['all', 'billable_item', 'category', 'department', 'patient_class'];
export const POLICY_STATUS = ['active', 'inactive', 'expired'];

export const INVOICE_LINE_EXTENSION_STATUS = ['applied', 'voided'];
export const INSURANCE_CLAIM_STATUS = ['submitted', 'in_review', 'approved', 'rejected', 'paid'];
export const INSURANCE_PREAUTH_STATUS = ['pending', 'approved', 'rejected', 'expired'];

export const PAYER_TYPES = ['cash', 'insurance', 'corporate', 'government', 'charity', 'other'];
export const AUTO_BILLING_CHARGE_MODE = ['fixed', 'percentage', 'per_unit', 'tiered'];
export const PAYMENT_METHODS = ['cash', 'card', 'mobile_money', 'bank_transfer', 'cheque', 'insurance', 'other'];

export const TAX_TYPE = ['percentage', 'fixed'];
export const TAX_STATUS = ['active', 'inactive'];

// Ledger
export const LEDGER_TRANSACTION_TYPE = ['credit', 'debit'];
export const LEDGER_STATUS = ['pending', 'completed', 'voided', 'failed', 'reversed'];


// ============================================================
// 🔹 Stock & Pharmacy (Compact Object Enums)
// ============================================================
export const CENTRAL_STOCK_STATUS = { ACTIVE: "active", INACTIVE: "inactive", EXPIRED: "expired", QUARANTINED: "quarantined" };
export const STOCK_ADJUSTMENT_STATUS = { DRAFT: "draft", PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" };
export const MASTER_ITEM_STATUS = { ACTIVE: "active", INACTIVE: "inactive" };
export const MASTER_ITEM_TYPES = { DRUG: "drug", CONSUMABLE: "consumable", EQUIPMENT: "equipment", SERVICE: "service", PROCEDURE: "procedure", PACKAGE: "package" };
export const MASTER_ITEM_CATEGORY_STATUS = { ACTIVE: "active", INACTIVE: "inactive" };
export const PHARMACY_TRANSACTION_STATUS = { PENDING: "pending", DISPENSED: "dispensed", PARTIALLY_DISPENSED: "partially_dispensed", RETURNED: "returned", CANCELLED: "cancelled", VOIDED: "voided", VERIFIED: "verified" };
export const SUPPLIER_STATUS = { ACTIVE: "active", INACTIVE: "inactive" };
export const PHARMACY_TRANSACTION_TYPE = { DISPENSE: "dispense", RETURN: "return", ADJUSTMENT: "adjustment" };


// ============================================================
// 🔹 Clinical Extensions
// ============================================================
export const NEWBORN_STATUS = ['alive', 'deceased', 'transferred', 'voided'];
export const PROCEDURE_STATUS = ['scheduled', 'in_progress', 'completed', 'cancelled', 'voided'];
export const RADIOLOGY_STATUS = ['pending', 'in_progress', 'completed', 'verified', 'cancelled'];
export const MATERNITY_VISIT_STATUS = ['scheduled', 'in_progress', 'completed', 'verified', 'cancelled', 'voided'];
export const SURGERY_STATUS = ['scheduled', 'in_progress', 'completed', 'verified', 'finalized','cancelled', 'voided'];
export const DELIVERY_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  VERIFIED: 'verified',
  CANCELLED: 'cancelled',
  VOIDED: 'voided',
};
export const NURSING_NOTE_STATUS = ['draft', 'finalized', 'voided'];

// ============================================================
// 🔹 Bed / Ward Hierarchy
// ============================================================
export const BED_STATUS = ['available', 'occupied', 'reserved', 'maintenance'];
export const WARD_STATUS = ['active', 'inactive'];
export const ROOM_STATUS = ['active', 'inactive'];

// ============================================================
// 🔹 Security & Audit
// ============================================================
export const PASSWORD_HISTORY_STATUS = ['active', 'archived'];
export const ACCESS_VIOLATION_STATUS = ['logged', 'investigating', 'resolved', 'dismissed'];
export const SYSTEM_AUDIT_STATUS = ['logged', 'reviewed', 'archived'];
export const LOGIN_AUDIT_STATUS = ['success', 'failure', 'timeout'];

// ============================================================
// 🔹 Insurance
// ============================================================
export const INSURANCE_PROVIDER_STATUS = ['active', 'inactive'];

// ============================================================
// 🔹 Appointments
// ============================================================
export const APPOINTMENT_STATUS = ['scheduled', 'in_progress', 'completed', "verified",'cancelled', 'no_show', 'voided'];

// ============================================================
// 🔹 Admissions
// ============================================================
export const ADMISSION_STATUS = ['admitted', 'in_progress', 'discharged', 'transferred', 'cancelled', 'voided'];
export const ADMISSION_TYPE = ['emergency', 'routine', 'maternity', 'surgery', 'other'];

// ============================================================
// 🔹 Currency Rates
// ============================================================
export const CURRENCY_RATE_STATUS = ['active', 'inactive', 'expired'];

// ============================================================
// 🔹 Lab
// ============================================================
export const LAB_REQUEST_STATUS = ['draft', 'pending', 'in_progress', 'completed', 'verified', 'cancelled', 'voided'];
export const LAB_RESULT_STATUS = ['draft', 'pending', 'in_progress',  'completed', 'reviewed', 'verified', 'cancelled', 'voided'];
export const LAB_SUPPLY_STATUS = ['active', 'inactive', 'out_of_stock'];
export const LAB_REQUEST_ITEM_STATUS = [ 'draft', 'pending', 'in_progress', 'completed', 'verified',  'cancelled',  'voided'];

// ============================================================
// 🔹 Prescriptions
// ============================================================

// Parent lifecycle (aligned with lab + billing pattern)
export const PRESCRIPTION_STATUS = [
  'draft',        // 0
  'issued',       // 1
  'dispensed',    // 2
  'completed',    // 3
  'cancelled',    // 4
  'voided',       // 5
  'verified'      // 6 ✅ must be last
];

// Child item lifecycle
export const PRESCRIPTION_ITEM_STATUS = [
  'draft',
  'issued',
  'dispensed',
  'partially_dispensed',
  'cancelled',
  'voided'
];

// ============================================================
// 🔹 Employee Shifts
// ============================================================
export const EMPLOYEE_SHIFT_STATUS = ['active', 'inactive', 'cancelled'];

// ============================================================
// 🔹 Ultrasound
// ============================================================
// ============================================================
// 🔹 Ultrasound
// ============================================================
export const ULTRASOUND_STATUS = [
  'pending',       // created but not yet started
  'in_progress',   // scan ongoing
  'completed',     // scan finished
  'verified',      // reviewed/approved
  'finalized',     // ✅ locked, billing/audit complete
  'cancelled',     // stopped mid-process
  'voided'         // invalidated after saving
];

// ============================================================
// 🔹 Letterhead Templates
// ============================================================
export const LETTERHEAD_STATUS = ['active', 'inactive'];
export const LETTERHEAD_TEMPLATE_STATUS = ['active', 'inactive'];

// ============================================================
// 🔹 Branding (Org / Facility)
// ============================================================
export const THEME_STATUS = ['active', 'inactive'];

// ============================================================
// 🔹 Home Content
// ============================================================
export const HOME_CONTENT_STATUS = ['active', 'inactive'];

// ============================================================
// 🔹 Announcements
// ============================================================
export const ANNOUNCEMENT_STATUS = ['draft', 'published', 'archived'];

// ============================================================
// 🔹 Videos
// ============================================================
export const VIDEO_STATUS = ['active', 'inactive'];

// ============================================================
// 🔹 Stock Lifecycle Enums (Ultra Compact)
// ============================================================

export const DEPARTMENT_STOCK_STATUS = { ACTIVE: "active", INACTIVE: "inactive" };

export const STOCK_RETURN_STATUS = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" };

export const STOCK_LEDGER_TYPE = {
  PURCHASE: "purchase", ISSUE_OUT: "issue_out", ISSUE_IN: "issue_in",
  RETURN_OUT: "return_out", RETURN_IN: "return_in",
  ADJUSTMENT: "adjustment", CONSUMPTION: "consumption",
  DISPOSED: "disposed", WRITE_OFF: "write_off",
  STATUS_CHANGE: "status_change", RESTORE: "restore",
  LOCK: "lock", UNLOCK: "unlock",
  VOID_ISSUE: "void_issue"
};

export const STOCK_REQUEST_STATUS = {
  DRAFT: "draft", PENDING: "pending", APPROVED: "approved",
  REJECTED: "rejected", ISSUED: "issued",
  FULFILLED: "fulfilled", CANCELLED: "cancelled"
};

export const STOCK_REQUEST_ITEM_STATUS = {
  PENDING: "pending", ISSUED: "issued", APPROVED: "approved",
  REJECTED: "rejected", FULFILLED: "fulfilled",
  PARTIALLY_FULFILLED: "partially_fulfilled",
  CANCELLED: "cancelled", VOIDED: "voided"
};

export const ADJUSTMENT_TYPES = {
  INCREASE: "increase", DECREASE: "decrease",
  TRANSFER: "transfer", RETURN: "return"
};


// ============================================================
// 🔹 Patient–Employee Eligibility
// ============================================================
export const RELATION_TYPE = ['self', 'spouse', 'child', 'dependent', 'other'];
export const LINK_STATUS = ['active', 'inactive'];

export const EMPLOYEE_POSITIONS = [
  "Doctor",
  "Nurse",
  "Midwife",
  "Pharmacist",
  "Lab Technician",
  "Radiologist",
  "Therapist",
  "Clerk",
  "Assistant",
  "Physician Assistant", 
];
// ============================================================
// 🔹 EKG
// ============================================================
export const EKG_STATUS = [
  'pending',      // order placed, not yet started
  'in_progress',  // technician is recording
  'completed',    // recording finished
  'verified',     // reviewed/approved by physician
  'finalized',    // locked, no further edits
  'cancelled',    // cancelled before completion
  'voided',       // invalidated after saving
];

// 📘 patientChartEnums.js – Enumerations for patient chart subsystem

export const PATIENT_CHART_NOTE_TYPE = ["doctor", "nurse", "admin", "system"];

export const PATIENT_CHART_VIEW_ACTION = ["view", "export", "print"];

export const PATIENT_CHART_CACHE_STATUS = ['active', 'stale', 'invalid'];
