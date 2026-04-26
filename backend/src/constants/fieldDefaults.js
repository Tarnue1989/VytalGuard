import {
  FIELD_ORDER_ORGANIZATION, FIELD_ORDER_FACILITY, FIELD_ORDER_ROLE, FIELD_ORDER_USER,
  FIELD_ORDER_USER_FACILITY, FIELD_ORDER_DEPARTMENT, FIELD_ORDER_EMPLOYEE, FIELD_ORDER_FEATURE_MODULE,
  FIELD_ORDER_FEATURE_ACCESS, FIELD_ORDER_PATIENT, FIELD_ORDER_VITAL, FIELD_ORDER_CONSULTATION_STAFF,
  FIELD_ORDER_BILLABLE_ITEM_PRICE_HISTORY, FIELD_ORDER_FACILITY_BRANDING, FIELD_ORDER_ORGANIZATION_BRANDING,
  FIELD_ORDER_LETTERHEAD_TEMPLATE, FIELD_ORDER_PLAN, FIELD_ORDER_ORGANIZATION_PLAN, FIELD_ORDER_STOCK_REQUEST,
  FIELD_ORDER_STOCK_REQUEST_ITEM, FIELD_ORDER_SUPPLIER, FIELD_ORDER_BILLABLE_ITEM, FIELD_ORDER_CONSULTATION,
  FIELD_ORDER_DEPOSIT, FIELD_ORDER_INVOICE_ITEM, FIELD_ORDER_REFUND, FIELD_ORDER_REFUND_DEPOSIT, FIELD_ORDER_REGISTRATION_LOG,
  FIELD_ORDER_PLAN_MODULE, FIELD_ORDER_CENTRAL_STOCK, FIELD_ORDER_MASTER_ITEM, FIELD_ORDER_MASTER_ITEM_CATEGORY,
  FIELD_ORDER_STOCK_ADJUSTMENT, FIELD_ORDER_APPOINTMENT, FIELD_ORDER_LAB_REQUEST, FIELD_ORDER_PRESCRIPTION,
  FIELD_ORDER_LAB_SUPPLY, FIELD_ORDER_PRESCRIPTION_ITEM, FIELD_ORDER_SURGERY, FIELD_ORDER_BED,
  FIELD_ORDER_EMPLOYEE_SHIFT, FIELD_ORDER_ACCESS_VIOLATION_LOG, FIELD_ORDER_DELIVERY_RECORD,
  FIELD_ORDER_MATERNITY_VISIT, FIELD_ORDER_PHARMACY_TRANSACTION, FIELD_ORDER_SYSTEM_AUDIT_LOG,
  FIELD_ORDER_INSURANCE_CLAIM, FIELD_ORDER_NEWBORN_RECORD, FIELD_ORDER_PROCEDURE_RECORD, FIELD_ORDER_ROOM,
  FIELD_ORDER_LOGIN_AUDIT, FIELD_ORDER_MEDICAL_RECORD, FIELD_ORDER_NURSING_NOTE,
  FIELD_ORDER_DISCOUNT, FIELD_ORDER_DISCOUNT_WAIVER, FIELD_ORDER_DISCOUNT_POLICY,   // ✅ ADDED
  FIELD_ORDER_INSURANCE_PREAUTHORIZATION, FIELD_ORDER_LAB_RESULT, FIELD_ORDER_RADIOLOGY_RECORD,
  FIELD_ORDER_ULTRASOUND_RECORD, FIELD_ORDER_INVOICE, FIELD_ORDER_INSURANCE_PROVIDER, FIELD_ORDER_RECOMMENDATION,
  FIELD_ORDER_PAYMENT, FIELD_ORDER_WARD, FIELD_ORDER_ADMISSION, FIELD_ORDER_CURRENCY_RATE,
  FIELD_ORDER_AUTO_BILLING_RULE, FIELD_ORDER_MESSAGE, FIELD_ORDER_MESSAGE_ATTACHMENT, FIELD_ORDER_CONVERSATION,
  FIELD_ORDER_TRIAGE_RECORD, FIELD_ORDER_ORDER, FIELD_ORDER_ORDER_ITEM,
  FIELD_ORDER_PERMISSION, FIELD_ORDER_ROLE_PERMISSION, FIELD_ORDER_FINANCIAL_LEDGER,
  FIELD_ORDER_REFUND_TRANSACTION, FIELD_ORDER_LAB_REQUEST_ITEM, FIELD_ORDER_BILLING_TRIGGER, FIELD_ORDER_BILLABLE_ITEM_PRICE,  
  FIELD_ORDER_ACCOUNT,
  FIELD_ORDER_CASH_LEDGER,
  FIELD_ORDER_EXPENSE,
  FIELD_ORDER_CASH_CLOSING,
  FIELD_ORDER_PAYROLL
} from "./fieldOrder.js";


/* -------------------- Account -------------------- */
export const FIELD_DEFAULTS_ACCOUNT = {
  admin: FIELD_ORDER_ACCOUNT,
  manager: [
    "account_number","name","type","currency","balance","is_active",
    "organization_id","facility_id"
  ],
  staff: ["account_number","name","type","currency","balance"]
};

/* -------------------- Cash Ledger -------------------- */
export const FIELD_DEFAULTS_CASH_LEDGER = {
  admin: FIELD_ORDER_CASH_LEDGER,
  manager: [
    "date","type","direction","account_id",
    "amount","currency",
    "reference_type","reference_id",
    "description"
  ],
  staff: [
    "date","type","direction",
    "amount","currency"
  ]
};
/* -------------------- Expense -------------------- */
export const FIELD_DEFAULTS_EXPENSE = {
  admin: FIELD_ORDER_EXPENSE,

  manager: [
    "date","amount","currency","category",
    "payment_method","account_id","description",

    // 🔥 lifecycle
    "status",

    // 🔥 audit (important)
    "approved_by_id","approved_at",
    "posted_by_id","posted_at",
    "reversed_by_id","reversed_at",
    "voided_by_id","voided_at"
  ],

  staff: [
    "date","amount","category","description"
  ]
};

/* -------------------- Payroll -------------------- */
export const FIELD_DEFAULTS_PAYROLL = {
  admin: FIELD_ORDER_PAYROLL,

  manager: [
    "employee_id","period","currency",
    "basic_salary","allowances","deductions",
    "net_salary",

    /* 🔥 PAYMENT CONFIG */
    "account_id","category","payment_method",

    /* 🔥 STATUS */
    "status",

    /* 🔥 AUDIT */
    "approved_by_id","approved_at",
    "paid_by_id","paid_at"
  ],

  staff: [
    "employee_id","period","net_salary",

    /* 🔥 BASIC VISIBILITY */
    "status",
    "paid_at"
  ]
};
/* -------------------- Cash Closing -------------------- */
export const FIELD_DEFAULTS_CASH_CLOSING = {
  admin: FIELD_ORDER_CASH_CLOSING,
  manager: [
    "date","account_id",
    "opening_balance","closing_balance",
    "total_in","total_out",
    "is_locked"
  ],
  staff: [
    "date","closing_balance","is_locked"
  ]
};

/* -------------------- Organization -------------------- */
export const FIELD_DEFAULTS_ORGANIZATION = {
  admin: FIELD_ORDER_ORGANIZATION,
  manager: ["name", "code", "status"],
  staff: ["name", "status"]
};

/* -------------------- Facility -------------------- */
export const FIELD_DEFAULTS_FACILITY = {
  admin: FIELD_ORDER_FACILITY,
  manager: ["organization_id", "name", "code", "status"],
  staff: ["name", "status"]
};

/* -------------------- Role -------------------- */
export const FIELD_DEFAULTS_ROLE = {
  admin: FIELD_ORDER_ROLE,
  manager: ["name", "description", "status"],
  staff: ["name", "status"]
};

/* -------------------- User -------------------- */
export const FIELD_DEFAULTS_USER = {
  admin: FIELD_ORDER_USER,
  manager: ["username", "email", "status", "last_login_at", "login_attempts", "locked_until"],
  staff: ["username", "email", "status"]
};

/* -------------------- Permission -------------------- */
export const FIELD_DEFAULTS_PERMISSION = {
  superadmin: FIELD_ORDER_PERMISSION, // 🔹 full access
  admin: FIELD_ORDER_PERMISSION,
  manager: ["key", "name", "description", "module", "category", "created_at", "updated_at"],
  staff: ["key", "name", "description"]
};

/* -------------------- Role Permission -------------------- */
export const FIELD_DEFAULTS_ROLE_PERMISSION = {
  superadmin: FIELD_ORDER_ROLE_PERMISSION, // 🔹 full access
  admin: FIELD_ORDER_ROLE_PERMISSION,
  manager: ["role_id", "permission_id", "organization_id", "facility_id", "created_at"],
  staff: ["role_id", "permission_id"]
};


/* -------------------- User Facility -------------------- */
export const FIELD_DEFAULTS_USER_FACILITY = {
  admin: FIELD_ORDER_USER_FACILITY,
  manager: ["user_id", "organization_id", "facility_id", "role_id"],
  staff: ["user_id", "organization_id", "facility_id"]
};


/* -------------------- Department -------------------- */
export const FIELD_DEFAULTS_DEPARTMENT = {
  admin: FIELD_ORDER_DEPARTMENT,
  manager: ["organization_id", "facility_id", "name", "code", "status"], // ✅ added organization_id
  staff: ["name", "status"]
};

/* -------------------- Employee -------------------- */
export const FIELD_DEFAULTS_EMPLOYEE = {
  admin: FIELD_ORDER_EMPLOYEE, // ✅ full list including user_id
  manager: [
    "organization_id", "facility_id", "department_id",
    "first_name", "middle_name", "last_name", // ✅ added middle_name
    "gender", "dob", "phone", "email", "address",     "emergency_contact_name",
    "emergency_contact_phone",
    "employee_no", "position", "status",
    "photo_path", "resume_url", "document_url",
    "user_id" // ✅ added if managers should see linked user
  ],
  staff: [
    "first_name", "middle_name", "last_name", "gender", "dob", "phone", "email"] // ✅ added middle_name
};

/* -------------------- Feature Module -------------------- */
export const FIELD_DEFAULTS_FEATURE_MODULE = {
  admin: FIELD_ORDER_FEATURE_MODULE,
  manager: [
    "name","key","icon","category","description","tags",
    "visibility","tenant_scope","enabled","status",
    "order_index","route","parent_id",
    "show_on_dashboard","dashboard_type","dashboard_order"
  ],
  staff: ["name","status"]
};


/* -------------------- Feature Access -------------------- */
export const FIELD_DEFAULTS_FEATURE_ACCESS = {
  admin: FIELD_ORDER_FEATURE_ACCESS,
  manager: ["organization_id", "facility_id", "module_id", "role_id", "status"],
  staff: ["facility_id", "module_id", "status"]
};

/* -------------------- Stock Request -------------------- */
export const FIELD_DEFAULTS_STOCK_REQUEST = {
  admin: FIELD_ORDER_STOCK_REQUEST,
  manager: [
    "organization_id", "facility_id", "department_id",
    "reference_number", "status", "notes",
    "rejection_reason", "issue_notes", "fulfillment_notes",
    "approved_by_id", "approved_at",
    "rejected_by_id", "rejected_at",
    "issued_by_id", "issued_at",
    "fulfilled_by_id", "fulfilled_at"
  ],
  staff: [
    "reference_number", "status", "notes",
    "rejection_reason", "issue_notes", "fulfillment_notes"
  ]
};

/* -------------------- Stock Request Item -------------------- */
export const FIELD_DEFAULTS_STOCK_REQUEST_ITEM = {
  admin: FIELD_ORDER_STOCK_REQUEST_ITEM,
  manager: [
    "stock_request_id", "master_item_id",
    "organization_id", "facility_id",
    "central_stock_id",
    "quantity", "issued_quantity", "fulfilled_quantity",
    "status", "remarks", "fulfillment_notes", "rejection_reason"
  ],
  staff: [
    "master_item_id", "quantity",
    "issued_quantity", "fulfilled_quantity",
    "status", "remarks"
  ]
};

/* -------------------- Vital -------------------- */
export const FIELD_DEFAULTS_VITAL = {
  admin: FIELD_ORDER_VITAL,
  manager: [
    "patient_id", "registration_log_id", "admission_id", "consultation_id", "nurse_id", "triage_record_id",
    "organization_id", "facility_id", "status",
    "bp", "pulse", "rr", "temp", "oxygen", "weight", "height", "rbg",
    "pain_score", "position", "recorded_at"
  ],
  staff: [
    "patient_id", "registration_log_id", "consultation_id",
    "bp", "pulse", "rr", "temp", "oxygen", "weight", "height", "rbg",
    "pain_score", "position", "recorded_at"
  ]
};


/* -------------------- Consultation Staff -------------------- */
export const FIELD_DEFAULTS_CONSULTATION_STAFF = {
  admin: FIELD_ORDER_CONSULTATION_STAFF,
  manager: [
    "consultation_id", "employee_id",
    "organization_id", "facility_id",
    "role"
  ],
  staff: ["employee_id", "role"]
};

/* -------------------- Patient -------------------- */
export const FIELD_DEFAULTS_PATIENT = {
  admin: FIELD_ORDER_PATIENT,
  manager: [
    "pat_no", "first_name", "middle_name", "last_name",
    "date_of_birth", "gender",
    "phone_number", "email_address", "home_address",
    "marital_status", "religion", "profession",
    "emergency_contacts",
    "registration_status", "source_of_registration", "notes",
    "qr_code_path", "photo_path",
    "organization_id", "facility_id", "employee_id"
  ],
  staff: ["pat_no", "first_name", "middle_name", 
    "last_name", "date_of_birth", "gender", "phone_number", "email_address"]
};

/* -------------------- Billable Item -------------------- */
export const FIELD_DEFAULTS_BILLABLE_ITEM = {
  admin: FIELD_ORDER_BILLABLE_ITEM,
  manager: [
    "organization_id", "facility_id",
    "master_item_id", "department_id",
    "name", "category_id", "description",

    // 🔥 NEW
    "item_type",
    "billing_mode",

    "price", "currency",
    "taxable", "discountable", "override_allowed",

    // 🔥 NEW
    "is_active",

    "status"
  ],
  staff: [
    "name",

    // 🔥 NEW
    "item_type",

    "price", "currency",
    "status"
  ]
};

/* -------------------- Billable Item Price -------------------- */
export const FIELD_DEFAULTS_BILLABLE_ITEM_PRICE = {
  admin: FIELD_ORDER_BILLABLE_ITEM_PRICE,
  manager: [
    "organization_id", "facility_id",
    "billable_item_id",

    "payer_type", "currency",
    "price",

    "is_default",

    "effective_from", "effective_to"
  ],
  staff: [
    "billable_item_id",

    "currency",
    "price",

    "effective_from"
  ]
};

/* -------------------- Billable Item Price History -------------------- */
export const FIELD_DEFAULTS_BILLABLE_ITEM_PRICE_HISTORY = {
  admin: FIELD_ORDER_BILLABLE_ITEM_PRICE_HISTORY,
  manager: [
    "organization_id", "facility_id",
    "billable_item_id",

    // 🔥 CONTEXT
    "payer_type",
    "currency",

    "old_price", "new_price",

    // 🔥 NEW (BETTER VISIBILITY)
    "change_type",

    "effective_date"
  ],
  staff: [
    "billable_item_id",

    // 🔥 CONTEXT
    "currency",

    "new_price",
    "effective_date"
  ]
};
/* -------------------- Facility Branding -------------------- */
export const FIELD_DEFAULTS_FACILITY_BRANDING = {
  admin: FIELD_ORDER_FACILITY_BRANDING,
  manager: [
    "organization_id", "facility_id", "status",
    "theme", "logo_url", "logo_print_url", "favicon_url",
    "default_letterhead_id", "contact", "meta"
  ],
  staff: ["status", "logo_url", "logo_print_url", "favicon_url"]
};

/* -------------------- Letterhead Template -------------------- */
export const FIELD_DEFAULTS_LETTERHEAD_TEMPLATE = {
  admin: FIELD_ORDER_LETTERHEAD_TEMPLATE,
  manager: [
    "organization_id", "facility_id", "name", "status",
    "header_html", "footer_html",
    "logo_url", "watermark_url",
    "pdf_options", "version", "effective_from", "effective_to", "meta"
  ],
  staff: ["name", "status", "logo_url", "watermark_url"]
};

/* -------------------- Organization Branding -------------------- */
export const FIELD_DEFAULTS_ORGANIZATION_BRANDING = {
  admin: FIELD_ORDER_ORGANIZATION_BRANDING,

  manager: [
    "organization_id",
    "status",

    "company_name",
    "theme",

    "logo_url",
    "logo_print_url",
    "favicon_url",

    "currency",
    "timezone",
  ],

  staff: [
    "status",
    "logo_url",
  ],
};

/* -------------------- Plan -------------------- */
export const FIELD_DEFAULTS_PLAN = {
  admin: FIELD_ORDER_PLAN,
  manager: ["name", "description", "price", "status"],
  staff: ["name", "price", "status"]
};

/* -------------------- Consultation -------------------- */
export const FIELD_DEFAULTS_CONSULTATION = {
  admin: FIELD_ORDER_CONSULTATION,
  manager: [
    "appointment_id", "registration_log_id", "recommendation_id",
    "parent_consultation_id", "triage_id",
    "patient_id", "doctor_id", "department_id",
    "invoice_id", "consultation_type_id",
    "organization_id", "facility_id",
    "consultation_date", "diagnosis", "consultation_notes", "prescribed_medications",
    "status", "finalized_by_id", "verified_by_id"
  ],
  staff: [
    "patient_id", "doctor_id", "consultation_date",
    "diagnosis", "consultation_notes", "status"
  ]
};

/* -------------------- Deposit -------------------- */
export const FIELD_DEFAULTS_DEPOSIT = {
  admin: FIELD_ORDER_DEPOSIT,
  manager: [
    "deposit_number",

    "patient_id", "organization_id", "facility_id",
    "applied_invoice_id",

    "account_id",
    "amount", "currency",

    "applied_amount",
    "unapplied_amount",
    "refund_amount",
    "balance",
    "remaining_balance",

    "is_refundable",

    "method",
    "transaction_ref",
    "status",
    "notes",
    "reason"
  ],
  staff: [
    "deposit_number",
    "amount", "currency",
    "method",
    "transaction_ref",
    "status",
    "reason"
  ]
};

/* -------------------- Financial Ledger -------------------- */
export const FIELD_DEFAULTS_FINANCIAL_LEDGER = {
  admin: FIELD_ORDER_FINANCIAL_LEDGER,
  manager: [
    "organization_id", "facility_id",
    "invoice_id", "patient_id",
    "payment_id", "refund_id", "deposit_id", "discount_waiver_id",
    "transaction_type", "amount", "method", "status", "note"
  ],
  staff: [
    "invoice_id", "patient_id", "transaction_type", "amount", "status"
  ]
};

/* -------------------- Invoice Item -------------------- */
export const FIELD_DEFAULTS_INVOICE_ITEM = {
  admin: FIELD_ORDER_INVOICE_ITEM,
  manager: [
    "invoice_id", "billable_item_id", "organization_id", "facility_id",
    "description", "unit_price", "quantity", "discount", 
    "tax", "total_price", "total",  "note"
  ],
  staff: ["billable_item_id", "description", "unit_price", "quantity", "total_price", "total"]
};

/* -------------------- Refund -------------------- */
export const FIELD_DEFAULTS_REFUND = {
  admin: FIELD_ORDER_REFUND,
  manager: ["refund_number",
    "payment_id", "invoice_id", "organization_id", "facility_id",
    "amount", "method", "reason", "status",
    "approved_by_id", "approved_at",
    "rejected_by_id", "rejected_at",
    "processed_by_id", "processed_at",
    "cancelled_by_id", "cancelled_at"
  ],
  staff: ["refund_number","amount", "method", "reason", "status"]
};

/* -------------------- Refund Deposit -------------------- */
export const FIELD_DEFAULTS_REFUND_DEPOSIT = {
  superadmin: FIELD_ORDER_REFUND_DEPOSIT,
  admin: FIELD_ORDER_REFUND_DEPOSIT,
  manager: ["refund_deposit_number", 
    "id","deposit_id","patient_id","organization_id","facility_id",
    "refund_amount","method","reason","status",
    "created_by_id","created_at"
  ],
  staff: ["refund_deposit_number", "refund_amount","method","reason"]
};

/* -------------------- Refund Transaction -------------------- */
export const FIELD_DEFAULTS_REFUND_TRANSACTION = {
  admin: FIELD_ORDER_REFUND_TRANSACTION,
  manager: [
    "refund_id", "invoice_id", "patient_id", "organization_id", "facility_id",
    "amount", "reason", "status",
    "approved_by_id", "approved_at",
    "rejected_by_id", "rejected_at", "reject_reason",
    "processed_by_id", "processed_at",
    "cancelled_by_id", "cancelled_at",
    "reversed_by_id", "reversed_at"
  ],
  staff: ["refund_id", "invoice_id", "amount", "status"]
};


/* -------------------- Registration Log -------------------- */
export const FIELD_DEFAULTS_REGISTRATION_LOG = {
  admin: FIELD_ORDER_REGISTRATION_LOG,
  manager: [
    "patient_id", "registrar_id", "organization_id", "facility_id",
    "invoice_id", "registration_type_id",

    // 🔥 NEW
    "payer_type",
    "patient_insurance_id",

    "registration_method", "registration_source", "patient_category",
    "visit_reason", "is_emergency",
    "registration_time", "notes", "log_status"
  ],
  staff: [
    "patient_id",
    "registration_method",
    "patient_category",

    // 🔥 OPTIONAL (recommended)
    "payer_type",

    "visit_reason", "is_emergency", "log_status"
  ]
};
/* -------------------- Plan Module -------------------- */
export const FIELD_DEFAULTS_PLAN_MODULE = {
  admin: FIELD_ORDER_PLAN_MODULE,
  manager: ["plan_id", "module_id", "enabled"],
  staff: ["plan_id", "module_id"]
};

/* -------------------- Central Stock -------------------- */
export const FIELD_DEFAULTS_CENTRAL_STOCK = {
  admin: FIELD_ORDER_CENTRAL_STOCK,
  manager: [
    "organization_id", "facility_id",
    "master_item_id", "supplier_id",
    "batch_number", "received_date", "expiry_date",
    "quantity", "unit_cost", "is_locked", "status"
  ],
  staff: ["master_item_id", "supplier_id", "batch_number", "received_date", "expiry_date", "quantity", "status"]
};
/* -------------------- Master Item -------------------- */
export const FIELD_DEFAULTS_MASTER_ITEM = {
  admin: FIELD_ORDER_MASTER_ITEM, // 
  manager: [
    "organization_id", "facility_id", "feature_module_id",
    "name", "code", "description",
    "item_type", "category_id", "department_id",
    "generic_group", "strength", "dosage_form", "unit",
    "reorder_level", "is_controlled", "sample_required", "test_method",
    "reference_price", "currency", "status"
  ],
  staff: ["name", "code", "item_type", "unit", "status"]
};


/* -------------------- Supplier -------------------- */
export const FIELD_DEFAULTS_SUPPLIER = {
  admin: FIELD_ORDER_SUPPLIER,
  manager: [
    "organization_id", "facility_id", "name",
    "contact_name", "contact_email", "contact_phone",
    "address", "status", "notes"
  ],
  staff: ["name", "status", "contact_phone"]
};



/* -------------------- Appointment -------------------- */
export const FIELD_DEFAULTS_APPOINTMENT = {
  admin: FIELD_ORDER_APPOINTMENT,
  manager: [
    "organization_id", "facility_id",
    "appointment_code", "patient_id", "doctor_id", "department_id", "invoice_id",
    "date_time", "status", "notes"
  ],
  staff: [
    "appointment_code", "patient_id", "doctor_id", "date_time", "status"
  ]
};

/* -------------------- Prescription -------------------- */
export const FIELD_DEFAULTS_PRESCRIPTION = {
  admin: FIELD_ORDER_PRESCRIPTION,
  manager: [
    "organization_id", "facility_id",
    "consultation_id", "registration_log_id",
    "patient_id", "doctor_id", "department_id",
    "invoice_id", "prescription_date",
    "is_emergency", "notes", "status",
    "issued_at", "dispensed_at", "completed_at",
    "fulfilled_by_id", "fulfilled_at", // ✅ updated (was fulfilled_by)
    "billed"
  ],
  staff: [
    "patient_id", "doctor_id",
    "prescription_date",
    "is_emergency", "status", "notes"
  ]
};


/* -------------------- Prescription Item -------------------- */
export const FIELD_DEFAULTS_PRESCRIPTION_ITEM = {
  admin: FIELD_ORDER_PRESCRIPTION_ITEM,
  manager: [
    "organization_id", "facility_id",
    "prescription_id", "medication_id", "billable_item_id", "invoice_item_id",
    "patient_id",
    "dosage", "route", "duration", "quantity", "instructions",
    "refill_allowed", "refill_count",
    "status",
    "dispensed_qty", // ✅ new
    "dispensed_at", "cancelled_at",
    "billed"
  ],
  staff: [
    "prescription_id", "medication_id",
    "dosage", "quantity", "instructions", "status"
  ]
};


/* -------------------- Lab Supply -------------------- */
export const FIELD_DEFAULTS_LAB_SUPPLY = {
  admin: FIELD_ORDER_LAB_SUPPLY,
  manager: [
    "organization_id", "facility_id",
    "name", "unit", "quantity", "reorder_level", "status"
  ],
  staff: ["name", "unit", "quantity", "status"]
};

/* -------------------- Surgery -------------------- */
export const FIELD_DEFAULTS_SURGERY = {
  admin: FIELD_ORDER_SURGERY,
  manager: [
    "organization_id", "facility_id",
    "patient_id", "consultation_id", "surgeon_id", "department_id",
    "billable_item_id", "invoice_id",
    "scheduled_date", "surgery_type", "duration_minutes", "anesthesia_type",
    "complications", "notes", "cost_override", "document_url",
    "is_emergency", "status",
    "finalized_at", "finalized_by_id", "verified_by_id", "verified_at", "voided_by_id", "voided_at"
  ],
  staff: ["patient_id", "surgeon_id", "scheduled_date", "surgery_type", "status"]
};

/* -------------------- Employee Shift -------------------- */
export const FIELD_DEFAULTS_EMPLOYEE_SHIFT = {
  admin: FIELD_ORDER_EMPLOYEE_SHIFT,
  manager: [
    "organization_id", "facility_id", "employee_id",
    "day_of_week", "shift_start_time", "shift_end_time", "status"
  ],
  staff: ["employee_id", "day_of_week", "shift_start_time", "shift_end_time", "status"]
};

/* -------------------- Master Item Category -------------------- */
export const FIELD_DEFAULTS_MASTER_ITEM_CATEGORY = {
  superadmin: FIELD_ORDER_MASTER_ITEM_CATEGORY,
  admin: FIELD_ORDER_MASTER_ITEM_CATEGORY,
  manager: [
    "organization_id", "facility_id", "name", "code", "description", "status"
  ],
  staff: ["name", "code", "status"]
};

/* -------------------- Stock Adjustment -------------------- */
export const FIELD_DEFAULTS_STOCK_ADJUSTMENT = {
  admin: FIELD_ORDER_STOCK_ADJUSTMENT,
  manager: [
    "central_stock_id", "organization_id", "facility_id",
    "adjustment_type", "quantity", "reason",
    "status", "approved_by_id", "approved_at"
  ],
  staff: ["central_stock_id", "adjustment_type", "quantity", "status"]
};
/* -------------------- Access Violation Log -------------------- */
export const FIELD_DEFAULTS_ACCESS_VIOLATION_LOG = {
  admin: FIELD_ORDER_ACCESS_VIOLATION_LOG,
  manager: [
    "organization_id", "facility_id",
    "user_id", "action", "reason", "status"
  ],
  staff: ["user_id", "action", "reason", "status"]
};

/* -------------------- Delivery Record -------------------- */
export const FIELD_DEFAULTS_DELIVERY_RECORD = {
  admin: FIELD_ORDER_DELIVERY_RECORD,
  manager: [
    "organization_id", "facility_id",
    "patient_id", "consultation_id", "doctor_id", "midwife_id",
    "department_id", "billable_item_id", "invoice_id",
    "delivery_date", "delivery_type", "baby_count", "delivery_mode",
    "birth_weight", "birth_length", "newborn_weight", "newborn_gender",
    "apgar_score", "complications", "notes",
    "is_emergency", "status",
    "finalized_at", "finalized_by_id", "verified_by_id", "verified_at", "voided_by_id", "voided_at"
  ],
  staff: ["patient_id", "doctor_id", "midwife_id", "delivery_date", "delivery_type", "status"]
};

/* -------------------- Maternity Visit -------------------- */
export const FIELD_DEFAULTS_MATERNITY_VISIT = {
  admin: FIELD_ORDER_MATERNITY_VISIT,
  manager: [
    "organization_id", "facility_id",
    "patient_id", "doctor_id", "midwife_id", "department_id",
    "consultation_id", "registration_log_id",
    "billable_item_id", "invoice_id",
    "visit_date", "visit_type",
    "lnmp", "expected_due_date", "estimated_gestational_age",
    "fundus_height", "fetal_heart_rate", "presentation", "position",
    "complaint", "gravida", "para", "abortion", "living", "visit_notes",
    "blood_pressure", "weight", "height", "temperature", "pulse_rate",
    "is_emergency", "status",
    "finalized_at", "finalized_by_id",
    "verified_at", "verified_by_id",
    "cancel_reason", "cancelled_by_id"   // ✅ managers see cancel info
  ],
  staff: [
    "patient_id", "doctor_id", "visit_date", "visit_type", "status"
  ]
};

/* -------------------- Pharmacy Transaction -------------------- */
export const FIELD_DEFAULTS_PHARMACY_TRANSACTION = {
  admin: FIELD_ORDER_PHARMACY_TRANSACTION,
  manager: [
    "organization", "facility",
    "patient", "prescription", "prescriptionItem",
    "registrationLog", "consultation", "department", 
    "doctor", "invoiceItem", "departmentStock",   // ✅ replaced centralStock
    "quantity_dispensed", "type", "status",
    "is_emergency", "notes",
    "fulfilledBy", "fulfillment_date",
    "void_reason", "voidedBy", "voided_at"
  ],
  staff: [
    "patient", "prescription", "prescriptionItem",
    "departmentStock", "quantity_dispensed", "type", "status"   // ✅ replaced medication + centralStock
  ]
};


/* -------------------- System Audit Log -------------------- */
export const FIELD_DEFAULTS_SYSTEM_AUDIT_LOG = {
  admin: FIELD_ORDER_SYSTEM_AUDIT_LOG,
  manager: [
    "organization_id", "facility_id",
    "user_id", "action", "target_table", "target_id",
    "changes", "ip_address", "user_agent", "status"
  ],
  staff: ["user_id", "action", "target_table", "status"]
};
/* -------------------- Patient Insurance -------------------- */
export const FIELD_DEFAULTS_PATIENT_INSURANCE = {
  admin: [
    "organization_id", "facility_id",
    "patient_id", "provider_id",
    "policy_number", "plan_name",
    "coverage_limit", "currency",
    "valid_from", "valid_to",
    "is_primary", "notes",
    "status",
    "created_at", "updated_at",
    "created_by_id", "updated_by_id"
  ],

  manager: [
    "patient_id", "provider_id",
    "policy_number", "plan_name",
    "coverage_limit", "currency",
    "valid_from", "valid_to",
    "is_primary",
    "status"
  ],

  staff: [
    "patient_id", "provider_id",
    "policy_number",
    "status"
  ]
};
/* -------------------- Insurance Claim -------------------- */
export const FIELD_DEFAULTS_INSURANCE_CLAIM = {
  admin: FIELD_ORDER_INSURANCE_CLAIM,
  manager: [
    "organization_id","facility_id",
    "invoice_id","patient_id","provider_id","patient_insurance_id",
    "claim_number","currency",
    "invoice_total","insurance_amount","patient_amount",
    "amount_claimed","amount_approved","amount_paid","payment_reference",
    "coverage_amount_at_claim","coverage_currency","submission_channel",
    "claim_date","response_date","submitted_at","reviewed_at","approved_at","paid_at",
    "created_by_id","updated_by_id","submitted_by_id","parent_claim_id",
    "rejection_reason","notes","status"
  ],
  staff: [
    "invoice_id","patient_id","provider_id",
    "claim_number","currency",
    "amount_claimed","status"
  ]
};
/* -------------------- Newborn Record -------------------- */
export const FIELD_DEFAULTS_NEWBORN_RECORD = {
  admin: FIELD_ORDER_NEWBORN_RECORD,
  manager: [
    "organization_id", "facility_id",
    "mother_id", "delivery_record_id",
    "gender", "birth_weight", "birth_length", "head_circumference",
    "apgar_score_1min", "apgar_score_5min",
    "measurement_notes",
    "complications", "notes",
    "status",
    "death_reason", "death_time",
    "transfer_reason", "transfer_facility_id", "transfer_time"
  ],
  staff: [
    "mother_id", "delivery_record_id",
    "gender", "birth_weight", "birth_length",
    "status"
  ]
};

/* -------------------- Lab Request -------------------- */
export const FIELD_DEFAULTS_LAB_REQUEST = {
  admin: FIELD_ORDER_LAB_REQUEST,
  manager: [
    "patient_id", "doctor_id", "department_id",
    "registration_log_id", "consultation_id", "lab_test_id",
    "request_date", "status", "notes"
  ],
  staff: [
    "patient_id", "registration_log_id", "consultation_id",
    "lab_test_id", "status"
  ]
};

/* -------------------- Lab Request Item -------------------- */
export const FIELD_DEFAULTS_LAB_REQUEST_ITEM = {
  admin: FIELD_ORDER_LAB_REQUEST_ITEM,
  manager: [
    "lab_request_id", "lab_test_id",
    "status", "notes", "billed"
  ],
  staff: [
    "lab_test_id", "status", "notes"
  ]
};


/* -------------------- Invoice -------------------- */
export const FIELD_DEFAULTS_INVOICE = {
  admin: FIELD_ORDER_INVOICE,   // full field order reference
  manager: [
    "patient_id", "organization_id", "facility_id",
    "invoice_number", "status", "currency", "due_date", "is_locked",
    "subtotal",            // ✅ NEW: show pre-tax subtotal
    "total_tax",           // ✅ tax amount
    "total", "total_paid", "balance", "refunded_amount",
    "total_discount",
    "payer_type", "insurance_provider_id", "coverage_amount", "notes"
  ],
  staff: [
    "patient_id", "invoice_number", "status", "currency",
    "subtotal", "total_tax",       // ✅ staff can view summary numbers
    "total", "balance"
  ]
};

/* -------------------- Procedure Record -------------------- */
export const FIELD_DEFAULTS_PROCEDURE_RECORD = {
  admin: FIELD_ORDER_PROCEDURE_RECORD,
  manager: [
    "organization_id", "facility_id",
    "patient_id", "consultation_id", "performer_id", "department_id",
    "billable_item_id", "invoice_id",
    "procedure_date", "procedure_type", "description", "duration_minutes",
    "notes", "cost_override", "is_emergency", "status"
  ],
  staff: ["patient_id", "performer_id", "procedure_date", "procedure_type", "status"]
};

/* -------------------- Room -------------------- */
export const FIELD_DEFAULTS_ROOM = {
  admin: FIELD_ORDER_ROOM,
  manager: [
    "organization_id", "facility_id", "ward_id",
    "room_number", "description", "status"
  ],
  staff: ["ward_id", "room_number", "status"]
};

/* -------------------- Login Audit -------------------- */
export const FIELD_DEFAULTS_LOGIN_AUDIT = {
  admin: FIELD_ORDER_LOGIN_AUDIT,
  manager: [
    "organization_id", "facility_id",
    "user_id", "login_time", "logout_time",
    "ip_address", "device_info", "user_agent", "status"
  ],
  staff: ["user_id", "login_time", "logout_time", "status"]
};

/* -------------------- Nursing Note -------------------- */
export const FIELD_DEFAULTS_NURSING_NOTE = {
  admin: FIELD_ORDER_NURSING_NOTE,
  manager: [
    "organization_id", "facility_id",
    "patient_id", "admission_id", "nurse_id", "consultation_id", "department_id",
    "note_date", "shift",
    "subjective", "objective", "assessment", "plan", "handover_notes",
    "status"
  ],
  staff: ["patient_id", "nurse_id", "note_date", "shift", "status"]
};
/* -------------------- Discount -------------------- */
export const FIELD_DEFAULTS_DISCOUNT = {
  admin: FIELD_ORDER_DISCOUNT,  // 🔹 full order from your field ordering map
  manager: [
    "name", "code", "reason",
    "type", "value", "status",
    "discount_policy_id",   // 🔗 link to discount policy
    "void_reason", "voided_by_id", "voided_at",
    "finalized_by_id", "finalized_at"
  ],
  staff: [
    "name", "type", "value", "status"
  ]
};

/* -------------------- Discount Waiver -------------------- */
export const FIELD_DEFAULTS_DISCOUNT_WAIVER = {
  admin: FIELD_ORDER_DISCOUNT_WAIVER,
  manager: [
    "organization_id", "facility_id",
    "invoice_id", "patient_id",
    "type", "reason", "percentage", "amount", "applied_total",
    "status",
    "approved_by_employee_id", "approved_by_id", "approved_at",
    "rejected_by_id", "rejected_at",
    "voided_by_id", "voided_at", "void_reason",
    "finalized_by_id", "finalized_at"
  ],
  staff: ["invoice_id", "patient_id", "type", "reason", "status"]
};

/* -------------------- Discount Policy -------------------- */
export const FIELD_DEFAULTS_DISCOUNT_POLICY = {
  admin: FIELD_ORDER_DISCOUNT_POLICY,
  manager: [
    "code", "name", "description",
    "discount_type", "discount_value", "applies_to",
    "effective_from", "effective_to", "status",
    "activated_by_id", "activated_at",
    "deactivated_by_id", "deactivated_at",
    "expired_by_id", "expired_at"
  ],
  staff: ["code", "name", "discount_type", "discount_value", "status"]
};

/* -------------------- Insurance PreAuthorization -------------------- */
export const FIELD_DEFAULTS_INSURANCE_PREAUTHORIZATION = {
  admin: FIELD_ORDER_INSURANCE_PREAUTHORIZATION,
  manager: [
    "organization_id", "facility_id",
    "patient_id", "provider_id", "billable_item_id", "invoice_id", "consultation_id",
    "preauth_number", "request_date", "response_date",
    "amount_requested", "amount_approved", "validity_date",
    "notes", "rejection_reason", "status"
  ],
  staff: ["patient_id", "provider_id", "billable_item_id", "preauth_number", "amount_requested", "status"]
};

/* -------------------- Lab Result -------------------- */
export const FIELD_DEFAULTS_LAB_RESULT = {
  admin: FIELD_ORDER_LAB_RESULT,
  manager: [
    "organization_id", "facility_id", "patient_id",
    "lab_request_id", "lab_request_item_id", "registration_log_id", // ✅ added item + reg log
    "department_id", "billable_item_id",
    "doctor_id", "consultation_id",
    "result", "notes", "doctor_notes", "result_date", "attachment_url",
    "status", "reviewed_at", "verified_at"
  ],
  staff: [
    "patient_id",
    "lab_request_id", "lab_request_item_id", "registration_log_id", // ✅ added item + reg log
    "doctor_id", "consultation_id",
    "result", "result_date", "status"
  ]
};


/* -------------------- Radiology Record -------------------- */
export const FIELD_DEFAULTS_RADIOLOGY_RECORD = {
  admin: FIELD_ORDER_RADIOLOGY_RECORD,
  manager: [
    "organization_id", "facility_id",
    "patient_id", "consultation_id", "department_id",
    "billable_item_id", "invoice_id", "radiologist_id",
    "study_type", "study_date", "body_part", "modality",
    "findings", "impression", "file_path",
    "status", "verified_by_id", "verified_at"
  ],
  staff: ["patient_id", "radiologist_id", "study_type", "study_date", "status"]
};

/* -------------------- Payment -------------------- */
export const FIELD_DEFAULTS_PAYMENT = {
  admin: FIELD_ORDER_PAYMENT,
  manager: [
    "payment_number",
    "invoice_id", "patient_id", "organization_id", "facility_id",

    "account_id",        // 🔥 added
    "amount", "currency",// 🔥 added

    "method", "status",
    "transaction_ref",
    "is_deposit",
    "reason"
  ],
  staff: [
    "payment_number",
    "invoice_id", "patient_id",

    "amount", "currency", // 🔥 added
    "method", "status",
    "reason"
  ],
};

/* -------------------- Ward -------------------- */
export const FIELD_DEFAULTS_WARD = {
  admin: FIELD_ORDER_WARD,
  manager: [
    "organization_id", "facility_id", "department_id",
    "name", "description", "status"
  ],
  staff: ["department_id", "name", "status"]
};

/* -------------------- Admission -------------------- */
export const FIELD_DEFAULTS_ADMISSION = {
  admin: FIELD_ORDER_ADMISSION,
  manager: [
    "organization_id", "facility_id",
    "patient_id", "admitting_doctor_id", "discharging_doctor_id",
    "department_id", "consultation_id", "billable_item_id", "invoice_id", "insurance_id",
    "admit_date", "discharge_date",
    "status", "admission_type", "is_emergency",
    "admit_reason", "referral_source", "notes", "bed_number", "discharge_summary",
    "cost_override", "document_url",
    "finalized_at", "finalized_by_id", "verified_by_id", "verified_at", "voided_by_id", "voided_at"
  ],
  staff: ["patient_id", "admitting_doctor_id", "admit_date", "status", "admission_type"]
};

/* -------------------- Currency Rate -------------------- */
export const FIELD_DEFAULTS_CURRENCY_RATE = {
  admin: FIELD_ORDER_CURRENCY_RATE,
  manager: [
    "organization_id","facility_id",
    "from_currency","to_currency","rate","effective_date","status"
  ],
  staff: ["from_currency","to_currency","rate","effective_date","status"]
};

/* -------------------- Auto Billing Rule -------------------- */
export const FIELD_DEFAULTS_AUTO_BILLING_RULE = {
  admin: FIELD_ORDER_AUTO_BILLING_RULE,

  manager: [
    "organization_id", "facility_id",
    "trigger_feature_module", "trigger_module",
    "billable_item_id", "auto_generate",
    "charge_mode", "default_price", "status"
  ],

  staff: [
    "trigger_module",
    "billable_item_id",
    "charge_mode",
    "status"
  ]
};

/* -------------------- Billing Trigger -------------------- */
export const FIELD_DEFAULTS_BILLING_TRIGGER = {
  admin: FIELD_ORDER_BILLING_TRIGGER,

  manager: [
    "organization_id",
    "facility_id",
    "trigger_module",
    "trigger_status",
    "enabled"
  ],

  staff: [
    "trigger_module",
    "trigger_status"
  ]
};

/* -------------------- Message -------------------- */
export const FIELD_DEFAULTS_MESSAGE = {
  admin: FIELD_ORDER_MESSAGE,
  manager: [
    "conversation_id", "sender_id", "sender_role",
    "receiver_id", "receiver_role", "content",
    "message_type", "chat_type", "is_read", "read_at",
    "deleted_by_sender", "deleted_by_receiver"
  ],
  staff: ["conversation_id", "sender_id", "receiver_id", "content", "message_type", "is_read"]
};

/* -------------------- Insurance Provider -------------------- */
export const FIELD_DEFAULTS_INSURANCE_PROVIDER = {
  admin: FIELD_ORDER_INSURANCE_PROVIDER,
  manager: [
    "organization_id", "facility_id",
    "name", "contact_info", "status"
  ],
  staff: ["name", "status"]
};

/* -------------------- Recommendation -------------------- */
export const FIELD_DEFAULTS_RECOMMENDATION = {
  admin: FIELD_ORDER_RECOMMENDATION,
  manager: [
    "organization_id", "facility_id",
    "patient_id", "doctor_id", "department_id", "consultation_id",
    "recommendation_date", "reason", "status"
  ],
  staff: ["patient_id", "doctor_id", "recommendation_date", "status"]
};

/* -------------------- Medical Record -------------------- */
export const FIELD_DEFAULTS_MEDICAL_RECORD = {
  admin: FIELD_ORDER_MEDICAL_RECORD,
  manager: [
    "organization_id", "facility_id",
    "consultation_id", "patient_id", "doctor_id", "registration_log_id", "invoice_id",
    "recorded_at", // 🆕 Added
    "status", "is_emergency", "report_path",
    "cc", "hpi", "pmh", "fh_sh", "nut_hx", "imm_hx", "obs_hx", "gyn_hx",
    "pe", "resp_ex", "cv_ex", "abd_ex", "pel_ex", "ext", "neuro_ex",
    "ddx", "dx", "lab_inv", "img_inv", "tx_mx", "summary_pg",
    "reviewed_at", "reviewed_by_id",
    "finalized_at", "finalized_by_id",
    "verified_at", "verified_by_id",
    "voided_at", "voided_by_id", "void_reason"
  ],
  staff: [
    "patient_id", "doctor_id",
    "recorded_at", // 🆕 Added
    "status", "is_emergency"
  ]
};


/* -------------------- Triage Record -------------------- */
export const FIELD_DEFAULTS_TRIAGE_RECORD = {
  admin: FIELD_ORDER_TRIAGE_RECORD,
  manager: [
    "patient_id", "doctor_id", "nurse_id", "registration_log_id", "invoice_id", "triage_type_id",
    "triage_status", "symptoms", "triage_notes",
    "bp", "pulse", "rr", "temp", "oxygen", "weight", "height", "rbg", "pain_score", "position",
    "recorded_at"
  ],
  staff: [
    "patient_id", "doctor_id", "nurse_id",
    "triage_status", "symptoms",
    "bp", "pulse", "rr", "temp", "oxygen", "weight", "height", "rbg", "pain_score", "position",
    "recorded_at"
  ]
};

/* -------------------- Message Attachment -------------------- */
export const FIELD_DEFAULTS_MESSAGE_ATTACHMENT = {
  admin: FIELD_ORDER_MESSAGE_ATTACHMENT,
  manager: [
    "message_id",
    "file_name", "file_type", "file_size", "file_path"
  ],
  staff: ["message_id", "file_name", "file_type", "file_size"]
};

/* -------------------- Conversation -------------------- */
export const FIELD_DEFAULTS_CONVERSATION = {
  admin: FIELD_ORDER_CONVERSATION,
  manager: [
    "organization_id", "facility_id",
    "patient_id", "employee_id",
    "topic", "conversation_type"
  ],
  staff: ["patient_id", "employee_id", "topic", "conversation_type"]
};
/* -------------------- Bed -------------------- */
export const FIELD_DEFAULTS_BED = {
  admin: ["id", "organization_id", "facility_id", "ward_id", "room_id", "bed_number", "status"],
  manager: ["ward_id", "room_id", "bed_number", "status"],
  staff: ["bed_number", "status"]
};

/* -------------------- Organization Plan -------------------- */
export const FIELD_DEFAULTS_ORGANIZATION_PLAN = {
  admin: ["id", "organization_id", "plan_id", "start_date", "end_date", "status"],
  manager: ["plan_id", "start_date", "end_date", "status"],
  staff: ["plan_id", "status"]
};

/* -------------------- Department Stock -------------------- */
export const FIELD_DEFAULTS_DEPARTMENT_STOCK = {
  admin: [
    "id", "organization_id", "facility_id", "department_id",
    "master_item_id", "central_stock_id",
    "batch_no", "expiry_date",   // ✅ newly added
    "quantity", "min_threshold", "max_threshold", "status",
    "created_at", "updated_at", "deleted_at",
    "created_by_id", "updated_by_id", "deleted_by_id"
  ],
  manager: [
    "department_id", "master_item_id", "central_stock_id",
    "batch_no", "expiry_date",   // ✅ newly added
    "quantity", "min_threshold", "max_threshold", "status"
  ],
  staff: [
    "department_id", "master_item_id",
    "batch_no", "expiry_date",   // ✅ newly added
    "quantity", "status"
  ]
};

/* -------------------- EKG Record -------------------- */
export const FIELD_DEFAULTS_EKG_RECORD = {
  superadmin: [
    "id", "organization_id", "facility_id",
    "patient_id", "consultation_id", "registration_log_id",
    "billable_item_id", "invoice_id", "technician_id",
    "heart_rate", "pr_interval", "qrs_duration", "qt_interval",
    "axis", "rhythm", "interpretation", "recommendation", "note",
    "recorded_date", "file_path", "source",
    "is_emergency", "status",
    "verified_by_id", "verified_at",
    "finalized_by_id", "finalized_at",
    "voided_by_id", "voided_at",
    "created_at", "updated_at", "deleted_at",
    "created_by_id", "updated_by_id", "deleted_by_id"
  ],
  admin: [
    "id", "patient_id", "consultation_id", "registration_log_id",
    "technician_id", "heart_rate", "qrs_duration", "qt_interval",
    "axis", "rhythm", "interpretation", "recommendation",
    "recorded_date", "status", "is_emergency",
    "verified_by_id", "verified_at"
  ],
  manager: [
    "id", "patient_id", "consultation_id",
    "technician_id", "heart_rate", "rhythm",
    "recorded_date", "status"
  ],
  staff: [
    "patient_id", "technician_id",
    "heart_rate", "rhythm", "status"
  ]
};
/* -------------------- Ultrasound Record -------------------- */
export const FIELD_DEFAULTS_ULTRASOUND_RECORD = {
  superadmin: [
    "id", "organization_id", "facility_id",
    "patient_id", "consultation_id", "maternity_visit_id", "registration_log_id",
    "department_id", "billable_item_id", "invoice_id", "technician_id",
    "scan_type", "scan_date", "scan_location",
    "ultra_findings", "note", "number_of_fetus", "biparietal_diameter",
    "presentation", "lie", "position", "amniotic_volume", "fetal_heart_rate", "gender",
    "previous_cesarean", "prev_ces_date", "prev_ces_location", "cesarean_date",
    "indication", "next_of_kin", "is_emergency", "status",
    "verified_by_id", "verified_at", "finalized_by_id", "finalized_at",
    "cancelled_by_id", "cancelled_at",
    "voided_by_id", "voided_at", "void_reason",
    "source", "file_path",
    "created_by_id", "updated_by_id", "deleted_by_id",
    "created_at", "updated_at", "deleted_at"
  ],

  admin: [
    "id", "organization_id", "facility_id",
    "patient_id", "consultation_id", "technician_id",
    "scan_type", "scan_date", "scan_location",
    "ultra_findings", "note", "number_of_fetus", "presentation",
    "fetal_heart_rate", "gender", "previous_cesarean",
    "is_emergency", "status",
    "verified_by_id", "verified_at",
    "cancelled_by_id", "cancelled_at"
  ],

  manager: [
    "id", "patient_id", "consultation_id", "technician_id",
    "scan_type", "scan_date", "ultra_findings",
    "status", "verified_at",
    "cancelled_at"
  ],

  staff: [
    "patient_id", "technician_id",
    "scan_type", "scan_date", "status"
  ]
};
/* -------------------- Order -------------------- */
export const FIELD_DEFAULTS_ORDER = {
  admin: FIELD_ORDER_ORDER,
  manager: [
    "patient_id","provider_id","consultation_id",
    "type","priority",
    "order_date",
    "status","billing_status","fulfillment_status",
    "notes"
  ],
  staff: [
    "patient_id","type","order_date","status"
  ]
};

/* -------------------- Order Item -------------------- */
export const FIELD_DEFAULTS_ORDER_ITEM = {
  admin: FIELD_ORDER_ORDER_ITEM,
  manager: [
    "order_id","billable_item_id",
    "quantity","unit_price","total_price",
    "dosage","frequency","duration",
    "status","billing_status"
  ],
  staff: [
    "billable_item_id","quantity","status"
  ]
};

/* -------------------- Patient Chart Cache -------------------- */
export const FIELD_DEFAULTS_PATIENT_CHART_CACHE = {
  status: "active",
};

/* -------------------- Patient Chart Note -------------------- */
export const FIELD_DEFAULTS_PATIENT_CHART_NOTE = {
  note_type: "doctor",
  status: "draft",
};

/* -------------------- Patient Chart View Log -------------------- */
export const FIELD_DEFAULTS_PATIENT_CHART_VIEW_LOG = {
  action: "view",
};

