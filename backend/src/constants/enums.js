// ============================================================
// 🔹 User & Roles
// ============================================================
export const USER_STATUS = { ACTIVE:'active', INACTIVE:'inactive', SUSPENDED:'suspended' };
export const ROLE_TYPE = { SYSTEM:'system', CUSTOM:'custom' };
export const ROLE_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

// ============================================================
// 🔹 Facility & Organization
// ============================================================
export const FACILITY_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };
export const ORG_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

// ============================================================
// 🔹 Employee & Departments
// ============================================================
export const EMPLOYEE_STATUS = {
  ACTIVE:'active',
  INACTIVE:'inactive',
  ON_LEAVE:'on_leave',
  TERMINATED:'terminated'
};

export const DEPARTMENT_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };
export const GENDER_TYPES = { MALE:'male', FEMALE:'female' };

// ============================================================
// 🔹 Patient Demographics
// ============================================================
export const MARITAL_STATUS = {
  SINGLE:'single',
  MARRIED:'married',
  DIVORCED:'divorced',
  WIDOWED:'widowed',
  OTHER:'other'
};

export const RELIGIONS = {
  CHRISTIANITY:'christianity',
  ISLAM:'islam',
  HINDUISM:'hinduism',
  BUDDHISM:'buddhism',
  TRADITIONAL:'traditional',
  NONE:'none',
  OTHER:'other'
};

export const DOB_PRECISION = {
  EXACT:'exact',
  APPROXIMATE:'approximate',
  YEAR_ONLY:'year_only'
};

// ============================================================
// 🔹 Feature Modules & Access
// ============================================================
export const FEATURE_MODULE_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };
export const FEATURE_ACCESS_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };
export const USER_FACILITY_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

// ============================================================
// 🔹 Administrative Lifecycles
// ============================================================
export const REGISTRATION_LOG_STATUS = {
  DRAFT:'draft',
  PENDING:'pending',
  ACTIVE:'active',
  COMPLETED:'completed',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const REGISTRATION_METHODS = {
  WALK_IN:'walk_in',
  APPOINTMENT:'appointment',
  REFERRAL:'referral',
  TRANSFER:'transfer'
};

export const REGISTRATION_CATEGORIES = {
  GENERAL:'general',
  INSURED:'insured',
  VIP:'vip',
  STAFF:'staff',
  CHARITY:'charity'
};

export const PATIENT_STATUS = {
  ACTIVE:'active',
  CANCELLED:'cancelled'
};

// ============================================================
// 🔹 Encounter Lifecycles
// ============================================================
export const CONSULTATION_STATUS = {
  OPEN:'open',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const TRIAGE_STATUS = {
  OPEN:'open',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const VITAL_STATUS = {
  OPEN:'open',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const RECOMMENDATION_STATUS = {
  PENDING:'pending',
  CONFIRMED:'confirmed',
  DECLINED:'declined',
  VOIDED:'voided'
};

// ============================================================
// 🔹 Document Lifecycles
// ============================================================
export const MEDICAL_RECORD_STATUS = {
  DRAFT:'draft',
  REVIEWED:'reviewed',
  FINALIZED:'finalized',
  VERIFIED:'verified',
  VOIDED:'voided'
};

// ============================================================
// 🔹 Staff Roles
// ============================================================
export const CONSULTATION_STAFF_ROLES = {
  NURSE:'nurse',
  MIDWIFE:'midwife',
  ASSISTANT:'assistant',
  PHARMACIST:'pharmacist',
  LABTECH:'labtech',
  PANELIST:'panelist'
};

// ============================================================
// 🔹 Plans & Subscriptions
// ============================================================
export const PLAN_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

export const ORG_PLAN_STATUS = {
  ACTIVE:'active',
  INACTIVE:'inactive',
  EXPIRED:'expired',
  CANCELLED:'cancelled'
};

export const PLAN_MODULE_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REVERSED: 'reversed',
  VOIDED: 'voided',
  VERIFIED: 'verified',
};
export const REFUND_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSED: 'processed',
  CANCELLED: 'cancelled',
  REVERSED: 'reversed',
  VOIDED: 'voided',
};
// ============================================================
// 🔹 Deposit Refund Lifecycle (Enterprise-Grade)
// ============================================================
export const DEPOSIT_REFUND_STATUS = {
  PENDING: "pending",
  REVIEW: "review",
  APPROVED: "approved",
  PROCESSED: "processed",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  VOIDED: "voided",
  REVERSED: "reversed",
  RESTORED: "restored",
};


/* -------------------- Refund Transaction Status -------------------- */
export const REFUND_TRANSACTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PROCESSED: 'processed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  REVERSED: 'reversed',
};

export const DEPOSIT_STATUS = {
  PENDING: 'pending',
  CLEARED: 'cleared',
  APPLIED: 'applied',
  CANCELLED: 'cancelled',
  REVERSED: 'reversed',
  VOIDED: 'voided',
  VERIFIED: 'verified',
};

// 🔹 Billing & Finance
// ============================================================
export const AUTO_BILLING_RULE_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };
export const BILLABLE_ITEM_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

export const DISCOUNT_WAIVER_STATUS = {
  PENDING:'pending',
  APPROVED:'approved',
  APPLIED:'applied',
  REJECTED:'rejected',
  VOIDED:'voided',
  FINALIZED:'finalized'
};

// ============================================================
// 🔹 Billing Pricing (NEW)
// ============================================================
export const BILLING_MODE = {
  FIXED: "fixed",
  VARIABLE: "variable",
  TIERED: "tiered",
};

// ============================================================
// 🔹 Price Change Type (NEW)
// ============================================================
export const PRICE_CHANGE_TYPE = {
  PRICE_UPDATE: "price_update",
  CURRENCY_UPDATE: "currency_update",
  BOTH: "both",
};
export const POLICY_APPLIES_TO = {
  ALL:'all',
  BILLABLE_ITEM:'billable_item',
  CATEGORY:'category',
  DEPARTMENT:'department',
  PATIENT_CLASS:'patient_class'
};

export const POLICY_STATUS = {
  ACTIVE:'active',
  INACTIVE:'inactive',
  EXPIRED:'expired'
};

export const INVOICE_LINE_EXTENSION_STATUS = {
  APPLIED:'applied',
  VOIDED:'voided'
};


export const INSURANCE_CLAIM_STATUS = {
  DRAFT: 'draft', // ✅ ADD THIS

  SUBMITTED: 'submitted',
  IN_REVIEW: 'in_review',

  APPROVED: 'approved',
  PARTIALLY_APPROVED: 'partially_approved',

  REJECTED: 'rejected',

  PROCESSING_PAYMENT: 'processing_payment',
  PAID: 'paid',

  CANCELLED: 'cancelled',
  VOIDED: 'voided',
  REVERSED: 'reversed',
};
// ============================================================
// 🔹 Insurance Claim Transitions (OBJECT STYLE)
// ============================================================
export const INSURANCE_CLAIM_TRANSITIONS = {
  [INSURANCE_CLAIM_STATUS.DRAFT]: {
    [INSURANCE_CLAIM_STATUS.SUBMITTED]: true,
    [INSURANCE_CLAIM_STATUS.CANCELLED]: true,
  },

  [INSURANCE_CLAIM_STATUS.SUBMITTED]: {
    [INSURANCE_CLAIM_STATUS.IN_REVIEW]: true,
    [INSURANCE_CLAIM_STATUS.CANCELLED]: true,
  },

  [INSURANCE_CLAIM_STATUS.IN_REVIEW]: {
    [INSURANCE_CLAIM_STATUS.APPROVED]: true,
    [INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED]: true,
    [INSURANCE_CLAIM_STATUS.REJECTED]: true,
  },

  [INSURANCE_CLAIM_STATUS.APPROVED]: {
    [INSURANCE_CLAIM_STATUS.PROCESSING_PAYMENT]: true,
    [INSURANCE_CLAIM_STATUS.CANCELLED]: true,
  },

  [INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED]: {
    [INSURANCE_CLAIM_STATUS.PROCESSING_PAYMENT]: true,
  },

  [INSURANCE_CLAIM_STATUS.PROCESSING_PAYMENT]: {
    [INSURANCE_CLAIM_STATUS.PAID]: true,
  },

  [INSURANCE_CLAIM_STATUS.PAID]: {
    [INSURANCE_CLAIM_STATUS.REVERSED]: true,
  },

  [INSURANCE_CLAIM_STATUS.REJECTED]: {},
  [INSURANCE_CLAIM_STATUS.CANCELLED]: {},
  [INSURANCE_CLAIM_STATUS.VOIDED]: {},
  [INSURANCE_CLAIM_STATUS.REVERSED]: {},
};

// ============================================================
// 🔹 Patient Insurance (MISSING → CAUSING CRASH)
// ============================================================
export const PATIENT_INSURANCE_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

export const CLAIM_ACTIONS = {
  SUBMITTED: 'submitted',
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  PARTIALLY_APPROVED: 'partially_approved',
  REJECTED: 'rejected',
  PAID: 'paid',
  REVERSED: 'reversed'
};
export const INSURANCE_PREAUTH_STATUS = {
  PENDING:'pending',
  APPROVED:'approved',
  REJECTED:'rejected',
  EXPIRED:'expired',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const PAYER_TYPES = {
  CASH:'cash',
  INSURANCE:'insurance',
  CORPORATE:'corporate',
  GOVERNMENT:'government',
  CHARITY:'charity',
  OTHER:'other'
};

export const AUTO_BILLING_CHARGE_MODE = {
  FIXED:'fixed',
  PERCENTAGE:'percentage',
  PER_UNIT:'per_unit',
  TIERED:'tiered'
};

export const PAYMENT_METHODS = {
  CASH:'cash',
  CARD:'card',
  MOBILE_MONEY:'mobile_money',
  BANK_TRANSFER:'bank_transfer',
  CHEQUE:'cheque',
  INSURANCE:'insurance',
  OTHER:'other'
};

export const TAX_TYPE = { PERCENTAGE:'percentage', FIXED:'fixed' };
export const TAX_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

export const LEDGER_TRANSACTION_TYPE = { CREDIT:'credit', DEBIT:'debit' };

export const LEDGER_STATUS = {
  PENDING:'pending',
  COMPLETED:'completed',
  VOIDED:'voided',
  FAILED:'failed',
  REVERSED:'reversed'
};

// ============================================================
// 🔹 Clinical Extensions
// ============================================================
export const NEWBORN_STATUS = {
  ALIVE:'alive',
  DECEASED:'deceased',
  TRANSFERRED:'transferred',
  VOIDED:'voided'
};

export const PROCEDURE_STATUS = {
  SCHEDULED:'scheduled',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const RADIOLOGY_STATUS = {
  PENDING:'pending',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  CANCELLED:'cancelled'
};

export const MATERNITY_VISIT_STATUS = {
  SCHEDULED:'scheduled',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const SURGERY_STATUS = {
  SCHEDULED:'scheduled',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  FINALIZED:'finalized',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const DELIVERY_STATUS = {
  SCHEDULED:'scheduled',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const NURSING_NOTE_STATUS = {
  DRAFT:'draft',
  FINALIZED:'finalized',
  VOIDED:'voided'
};

// ============================================================
// 🔹 Bed / Ward
// ============================================================
export const BED_STATUS = {
  AVAILABLE:'available',
  OCCUPIED:'occupied',
  RESERVED:'reserved',
  MAINTENANCE:'maintenance'
};

export const WARD_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };
export const ROOM_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

// ============================================================
// 🔹 Security
// ============================================================
export const PASSWORD_HISTORY_STATUS = { ACTIVE:'active', ARCHIVED:'archived' };

export const ACCESS_VIOLATION_STATUS = {
  LOGGED:'logged',
  INVESTIGATING:'investigating',
  RESOLVED:'resolved',
  DISMISSED:'dismissed'
};

export const SYSTEM_AUDIT_STATUS = {
  LOGGED:'logged',
  REVIEWED:'reviewed',
  ARCHIVED:'archived'
};

export const LOGIN_AUDIT_STATUS = {
  SUCCESS:'success',
  FAILURE:'failure',
  TIMEOUT:'timeout'
};

export const CURRENCY = {
  USD: "USD",
  LRD: "LRD",
};
// ============================================================
// 🔹 Insurance
// ============================================================
export const INSURANCE_PROVIDER_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

// ============================================================
// 🔹 Appointments
// ============================================================
export const APPOINTMENT_STATUS = {
  SCHEDULED:'scheduled',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  CANCELLED:'cancelled',
  NO_SHOW:'no_show',
  VOIDED:'voided'
};

// ============================================================
// 🔹 Admissions
// ============================================================
export const ADMISSION_STATUS = {
  ADMITTED:'admitted',
  IN_PROGRESS:'in_progress',
  DISCHARGED:'discharged',
  TRANSFERRED:'transferred',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const ADMISSION_TYPE = {
  EMERGENCY:'emergency',
  ROUTINE:'routine',
  MATERNITY:'maternity',
  SURGERY:'surgery',
  OTHER:'other'
};

// ============================================================
// 🔹 Currency
// ============================================================
export const CURRENCY_RATE_STATUS = {
  ACTIVE:'active',
  INACTIVE:'inactive',
  EXPIRED:'expired'
};

// ============================================================
// 🔹 Lab
// ============================================================
export const LAB_REQUEST_STATUS = {
  DRAFT:'draft',
  PENDING:'pending',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const LAB_RESULT_STATUS = {
  DRAFT:'draft',
  PENDING:'pending',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  REVIEWED:'reviewed',
  VERIFIED:'verified',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

export const LAB_SUPPLY_STATUS = {
  ACTIVE:'active',
  INACTIVE:'inactive',
  OUT_OF_STOCK:'out_of_stock'
};

export const LAB_REQUEST_ITEM_STATUS = {
  DRAFT:'draft',
  PENDING:'pending',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

// ============================================================
// 🔹 Prescriptions
// ============================================================
export const PRESCRIPTION_STATUS = {
  DRAFT:'draft',
  ISSUED:'issued',
  DISPENSED:'dispensed',
  COMPLETED:'completed',
  CANCELLED:'cancelled',
  VOIDED:'voided',
  VERIFIED:'verified'
};

export const PRESCRIPTION_ITEM_STATUS = {
  DRAFT:'draft',
  ISSUED:'issued',
  DISPENSED:'dispensed',
  PARTIALLY_DISPENSED:'partially_dispensed',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

// ============================================================
// 🔹 Employee Shifts
// ============================================================
export const EMPLOYEE_SHIFT_STATUS = {
  ACTIVE:'active',
  INACTIVE:'inactive',
  CANCELLED:'cancelled'
};

// ============================================================
// 🔹 Ultrasound
// ============================================================
export const ULTRASOUND_STATUS = {
  PENDING:'pending',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  FINALIZED:'finalized',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

// ============================================================
// 🔹 Templates / Branding
// ============================================================
export const LETTERHEAD_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

export const LETTERHEAD_TEMPLATE_STATUS = {
  ACTIVE:'active',
  INACTIVE:'inactive',
  ARCHIVED:'archived'
};

export const THEME_STATUS = {
  ACTIVE:'active',
  INACTIVE:'inactive',
  ARCHIVED:'archived'
};

export const HOME_CONTENT_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

export const ANNOUNCEMENT_STATUS = {
  DRAFT:'draft',
  PUBLISHED:'published',
  ARCHIVED:'archived'
};

export const VIDEO_STATUS = { ACTIVE:'active', INACTIVE:'inactive' };

// ============================================================
// 🔹 Patient–Employee Eligibility
// ============================================================
export const RELATION_TYPE = {
  SELF:'self',
  SPOUSE:'spouse',
  CHILD:'child',
  DEPENDENT:'dependent',
  OTHER:'other'
};

export const LINK_STATUS = {
  ACTIVE:'active',
  INACTIVE:'inactive'
};

export const EMPLOYEE_POSITIONS = {
  DOCTOR:'Doctor',
  NURSE:'Nurse',
  MIDWIFE:'Midwife',
  PHARMACIST:'Pharmacist',
  LAB_TECHNICIAN:'Lab Technician',
  RADIOLOGIST:'Radiologist',
  THERAPIST:'Therapist',
  CLERK:'Clerk',
  ASSISTANT:'Assistant',
  PHYSICIAN_ASSISTANT:'Physician Assistant'
};

// ============================================================
// 🔹 EKG
// ============================================================
export const EKG_STATUS = {
  PENDING:'pending',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  FINALIZED:'finalized',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};


/* ============================================================
🔹 Orders (MASTER)
============================================================ */

// -------------------- Order Header --------------------
export const ORDER_STATUS = {
  DRAFT:'draft',
  PENDING:'pending',
  APPROVED:'approved',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  FINALIZED:'finalized',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

// -------------------- Order Item --------------------
export const ORDER_ITEM_STATUS = {
  DRAFT:'draft',
  PENDING:'pending',
  APPROVED:'approved',
  IN_PROGRESS:'in_progress',
  COMPLETED:'completed',
  VERIFIED:'verified',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

// -------------------- Order Type --------------------
export const ORDER_TYPE = {
  MEDICATION:'medication',
  SERVICE:'service',
  LAB:'lab',
  PROCEDURE:'procedure',
  ADMISSION:'admission',
  PACKAGE:'package',
  MIXED:'mixed'
};

// -------------------- Order Priority --------------------
export const ORDER_PRIORITY = {
  ROUTINE:'routine',
  URGENT:'urgent',
  STAT:'stat'
};

// -------------------- Fulfillment --------------------
export const ORDER_FULFILLMENT_STATUS = {
  PENDING:'pending',
  PARTIALLY_FULFILLED:'partially_fulfilled',
  FULFILLED:'fulfilled',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

// -------------------- Billing Status --------------------
export const ORDER_BILLING_STATUS = {
  NOT_BILLED:'not_billed',
  BILLED:'billed',
  PARTIALLY_PAID:'partially_paid',
  PAID:'paid',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

// -------------------- Medication Status --------------------
export const ORDER_MEDICATION_STATUS = {
  PRESCRIBED:'prescribed',
  DISPENSED:'dispensed',
  PARTIALLY_DISPENSED:'partially_dispensed',
  COMPLETED:'completed',
  CANCELLED:'cancelled',
  VOIDED:'voided'
};

// -------------------- Audit --------------------
export const ORDER_AUDIT_ACTIONS = {
  CREATED:'created',
  UPDATED:'updated',
  APPROVED:'approved',
  PROCESSED:'processed',
  VERIFIED:'verified',
  FINALIZED:'finalized',
  CANCELLED:'cancelled',
  VOIDED:'voided',
  REVERSED:'reversed',
  RESTORED:'restored'
};

// ============================================================
// 🔹 Patient Chart
// ============================================================
export const PATIENT_CHART_NOTE_TYPE = {
  DOCTOR:'doctor',
  NURSE:'nurse',
  ADMIN:'admin',
  SYSTEM:'system'
};

export const PATIENT_CHART_VIEW_ACTION = {
  VIEW:'view',
  EXPORT:'export',
  PRINT:'print'
};

export const PATIENT_CHART_CACHE_STATUS = {
  ACTIVE:'active',
  STALE:'stale',
  INVALID:'invalid'
};
// 🔥 ADD THIS (MISSING IN YOUR CURRENT ENUM FILE)
export const MASTER_ITEM_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};
export const MASTER_ITEM_TYPES = {
  SERVICE: "service",
  CONSUMABLE: "consumable",
  DRUG: "drug",
  PROCEDURE: "procedure",
  EQUIPMENT: "equipment",
  PACKAGE: "package",
};
export const MASTER_ITEM_CATEGORY_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

export const DISCOUNT_TYPE = {
  PERCENTAGE: "percentage",
  FIXED: "fixed",
  WAIVER: "waiver",
};

export const DISCOUNT_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive",
  FINALIZED: "finalized",
  VOIDED: "voided",
};

export const INVOICE_STATUS = {
  DRAFT: "draft",
  ISSUED: "issued",
  UNPAID: "unpaid",
  PARTIAL: "partial",
  PAID: "paid",
  CANCELLED: "cancelled",
  VOIDED: "voided",
};
export const CENTRAL_STOCK_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  EXPIRED: "expired",
  QUARANTINED: "quarantined",
};
export const DEPARTMENT_STOCK_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ARCHIVED: "archived",
};
export const STOCK_REQUEST_STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  ISSUED: "issued",
  PARTIALLY_FULFILLED: "partially_fulfilled",
  FULFILLED: "fulfilled",
  CANCELLED: "cancelled",
};

export const STOCK_REQUEST_ITEM_STATUS = {
  PENDING: "pending",
  ISSUED: "issued",
  APPROVED: "approved",
  REJECTED: "rejected",
  FULFILLED: "fulfilled",
  PARTIALLY_FULFILLED: "partially_fulfilled",
  CANCELLED: "cancelled",
  VOIDED: "voided",
};
export const SUPPLIER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};
export const STOCK_LEDGER_TYPE = {
  PURCHASE: "purchase",
  ISSUE_OUT: "issue_out",
  ISSUE_IN: "issue_in",
  RETURN_OUT: "return_out",
  RETURN_IN: "return_in",
  ADJUSTMENT: "adjustment",
  CONSUMPTION: "consumption",
  DISPOSED: "disposed",
  STATUS_CHANGE: "status_change",
  RESTORE: "restore",
  WRITE_OFF: "write_off",
  LOCK: "lock",
  UNLOCK: "unlock",
};
// ============================================================
// 🔹 Feature Module Visibility (NOT IN CURRENT FILE)
// ============================================================
export const FEATURE_MODULE_VISIBILITY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  HIDDEN: 'hidden',
};

// ============================================================
// 🔹 Financial Ledger Method (NOT IN CURRENT FILE)
// ============================================================
export const LEDGER_METHOD = {
  CASH: 'cash',
  CARD: 'card',
  MOBILE_MONEY: 'mobile_money',
  BANK_TRANSFER: 'bank_transfer',
  CHEQUE: 'cheque',
  INSURANCE: 'insurance',
  OTHER: 'other',
};

// ============================================================
// 🔹 Messaging (NOT IN CURRENT FILE)
// ============================================================
export const MESSAGE_TYPE = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
};

export const MESSAGE_ROLE = {
  PATIENT: 'patient',
  EMPLOYEE: 'employee',
};

// ============================================================
// 🔹 Conversations (NOT IN CURRENT FILE)
// ============================================================
export const CONVERSATION_TYPE = {
  INTERNAL: 'internal',
  HELPDESK: 'helpdesk',
  CLINICAL: 'clinical',
};

// ============================================================
// 🔹 Notifications (NOT IN CURRENT FILE)
// ============================================================
export const NOTIFICATION_STATUS = {
  READ: 'read',
  UNREAD: 'unread',
};

// ============================================================
// 🔹 Refund Deposit Transaction (NOT IN CURRENT FILE)
// ============================================================
export const REFUND_DEPOSIT_TRANSACTION_STATUS = {
  CREATED: 'created',
  PROCESSED: 'processed',
  REVERSED: 'reversed',
};

// ============================================================
// 🔹 Subscription (NOT IN CURRENT FILE)
// ============================================================
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
};

export const SUBSCRIPTION_INVOICE_STATUS = {
  PAID: 'paid',
  UNPAID: 'unpaid',
  PAST_DUE: 'past_due',
};

// ============================================================
// 🔹 Stock Adjustment (MISSING → CAUSING CRASH)
// ============================================================
export const STOCK_ADJUSTMENT_STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const ADJUSTMENT_TYPES = {
  INCREASE: "increase",
  DECREASE: "decrease",
  TRANSFER: "transfer",
  RETURN: "return",
};
// ============================================================
// 🔹 Stock Return (MISSING → CAUSING CRASH)
// ============================================================
export const STOCK_RETURN_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};
// ============================================================
// 🔹 Pharmacy Transaction Status (MISSING → CAUSING CRASH)
// ============================================================
export const PHARMACY_TRANSACTION_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  VOIDED: "voided",
  CANCELLED: "cancelled",
  PARTIALLY_DISPENSED: "partially_dispensed",
  RETURNED: "returned",
  DISPENSED: "dispensed",
};
// ============================================================
// 🔹 Pharmacy Transaction Type (MISSING → CAUSING CRASH)
// ============================================================
export const PHARMACY_TRANSACTION_TYPE = {
  DISPENSE: "dispense",
  RETURN: "return",
  ADJUSTMENT: "adjustment",
};


// ============================================================
// 🔹 Finance Transaction (FINAL ENTERPRISE)
// ============================================================

export const ACCOUNT_TYPES = {
  CASH: "cash",
  BANK: "bank",
  MOBILE_MONEY: "mobile_money",
  OTHER: "other",
};

// ------------------------------------------------------------
// 🔹 Ledger Core Types
// ------------------------------------------------------------
export const LEDGER_TYPES = {
  COLLECTION: "collection",   // payments, deposits
  EXPENSE: "expense",         // expenses
  TRANSFER: "transfer",       // account → account
  ADJUSTMENT: "adjustment",   // reversal, correction, void
};

// ------------------------------------------------------------
// 🔹 Ledger Direction
// ------------------------------------------------------------
export const LEDGER_DIRECTIONS = {
  IN: "in",   // money coming in
  OUT: "out", // money going out
};

// ------------------------------------------------------------
// 🔹 Ledger Reference (🔥 REQUIRED FOR ENGINE)
// ------------------------------------------------------------
export const LEDGER_REFERENCE_TYPES = {
  PAYMENT: "payment",
  DEPOSIT: "deposit",
  EXPENSE: "expense",
  REFUND: "refund",
  REFUND_DEPOSIT: "refund_deposit",
  TRANSFER: "transfer",
  ADJUSTMENT: "adjustment",
};

// ------------------------------------------------------------
// 🔹 Ledger Status (🔥 ENTERPRISE CONTROL)
// ------------------------------------------------------------
export const LEDGER_ENTRY_STATUS = {
  PENDING: "pending",
  POSTED: "posted",
  VOIDED: "voided",
  REVERSED: "reversed",
};

// ------------------------------------------------------------
// 🔹 Expense Categories
// ------------------------------------------------------------
export const EXPENSE_CATEGORIES = {
  DRUGS: "drugs",
  SUPPLIES: "supplies",
  FUEL: "fuel",
  UTILITIES: "utilities",
  SALARY: "salary",
  MAINTENANCE: "maintenance",
  RENT: "rent",
  TRANSPORT: "transport",
  OTHER: "other",
};

// ------------------------------------------------------------
// 🔹 Expense Status (OPTIONAL BUT RECOMMENDED)
// ------------------------------------------------------------
export const EXPENSE_STATUS = {
  DRAFT: "draft",
  APPROVED: "approved",
  POSTED: "posted",
  VOIDED: "voided",
};

// ------------------------------------------------------------
// 🔹 Transfer Types (OPTIONAL FUTURE SAFE)
// ------------------------------------------------------------
export const TRANSFER_TYPES = {
  CASH_TO_BANK: "cash_to_bank",
  BANK_TO_CASH: "bank_to_cash",
  ACCOUNT_TO_ACCOUNT: "account_to_account",
};