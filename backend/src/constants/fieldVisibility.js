import {
  FIELD_ORDER_ORGANIZATION, FIELD_ORDER_FACILITY, FIELD_ORDER_ROLE, FIELD_ORDER_USER,
  FIELD_ORDER_USER_FACILITY, FIELD_ORDER_DEPARTMENT, FIELD_ORDER_EMPLOYEE, FIELD_ORDER_FEATURE_MODULE,
  FIELD_ORDER_FEATURE_ACCESS, FIELD_ORDER_PATIENT, FIELD_ORDER_VITAL, FIELD_ORDER_CONSULTATION_STAFF,
  FIELD_ORDER_BILLABLE_ITEM_PRICE_HISTORY,  FIELD_ORDER_FACILITY_BRANDING, FIELD_ORDER_ORGANIZATION_BRANDING,
  FIELD_ORDER_LETTERHEAD_TEMPLATE, FIELD_ORDER_PLAN, FIELD_ORDER_ORGANIZATION_PLAN, FIELD_ORDER_STOCK_REQUEST,
  FIELD_ORDER_STOCK_REQUEST_ITEM, FIELD_ORDER_SUPPLIER, FIELD_ORDER_BILLABLE_ITEM, FIELD_ORDER_CONSULTATION,
  FIELD_ORDER_DEPOSIT, FIELD_ORDER_INVOICE_ITEM, FIELD_ORDER_REFUND_DEPOSIT, FIELD_ORDER_REFUND, FIELD_ORDER_REGISTRATION_LOG,
  FIELD_ORDER_PLAN_MODULE, FIELD_ORDER_CENTRAL_STOCK, FIELD_ORDER_MASTER_ITEM, FIELD_ORDER_MASTER_ITEM_CATEGORY,
  FIELD_ORDER_STOCK_ADJUSTMENT, FIELD_ORDER_APPOINTMENT, FIELD_ORDER_LAB_REQUEST,FIELD_ORDER_LAB_REQUEST_ITEM, FIELD_ORDER_PRESCRIPTION,
  FIELD_ORDER_LAB_SUPPLY, FIELD_ORDER_PRESCRIPTION_ITEM, FIELD_ORDER_SURGERY, FIELD_ORDER_BED,
  FIELD_ORDER_EMPLOYEE_SHIFT, FIELD_ORDER_ACCESS_VIOLATION_LOG, FIELD_ORDER_DELIVERY_RECORD,
  FIELD_ORDER_MATERNITY_VISIT, FIELD_ORDER_PHARMACY_TRANSACTION, FIELD_ORDER_SYSTEM_AUDIT_LOG,
  FIELD_ORDER_INSURANCE_CLAIM, FIELD_ORDER_NEWBORN_RECORD, FIELD_ORDER_PROCEDURE_RECORD, FIELD_ORDER_ROOM,
  FIELD_ORDER_LOGIN_AUDIT, FIELD_ORDER_MEDICAL_RECORD, FIELD_ORDER_NURSING_NOTE,  FIELD_ORDER_DISCOUNT, FIELD_ORDER_DISCOUNT_WAIVER,
  FIELD_ORDER_DISCOUNT_POLICY, FIELD_ORDER_INSURANCE_PREAUTHORIZATION, FIELD_ORDER_LAB_RESULT, FIELD_ORDER_RADIOLOGY_RECORD,
  FIELD_ORDER_ULTRASOUND_RECORD, FIELD_ORDER_INVOICE, FIELD_ORDER_INSURANCE_PROVIDER, FIELD_ORDER_RECOMMENDATION,
  FIELD_ORDER_PAYMENT, FIELD_ORDER_WARD, FIELD_ORDER_ADMISSION, FIELD_ORDER_CURRENCY_RATE,
  FIELD_ORDER_AUTO_BILLING_RULE, FIELD_ORDER_MESSAGE, FIELD_ORDER_MESSAGE_ATTACHMENT, FIELD_ORDER_CONVERSATION,
  FIELD_ORDER_TRIAGE_RECORD,  FIELD_ORDER_EKG_RECORD, FIELD_ORDER_DEPARTMENT_STOCK, 
  FIELD_ORDER_FINANCIAL_LEDGER, FIELD_ORDER_REFUND_TRANSACTION, FIELD_ORDER_PERMISSION, FIELD_ORDER_ROLE_PERMISSION,
  FIELD_ORDER_PATIENT_CHART_CACHE,  FIELD_ORDER_PATIENT_CHART_NOTE,  FIELD_ORDER_PATIENT_CHART_VIEW_LOG, FIELD_ORDER_BILLING_TRIGGER,
  FIELD_ORDER_ORDER, FIELD_ORDER_ORDER_ITEM,  FIELD_ORDER_BILLABLE_ITEM_PRICE, FIELD_ORDER_PATIENT_INSURANCE,
  FIELD_ORDER_ACCOUNT,  FIELD_ORDER_CASH_LEDGER,  FIELD_ORDER_EXPENSE,  FIELD_ORDER_CASH_CLOSING,  FIELD_ORDER_PAYROLL

} from "./fieldOrder.js";

/* -------------------- Account -------------------- */
export const FIELD_VISIBILITY_ACCOUNT = {
  superadmin: FIELD_ORDER_ACCOUNT,
  organization_admin: FIELD_ORDER_ACCOUNT,
  manager: [
    "id","account_number","name","type","currency","balance","is_active"
  ],
  staff: [
    "id","account_number","name","type","currency","balance"
  ]
};

/* -------------------- Cash Ledger -------------------- */
export const FIELD_VISIBILITY_CASH_LEDGER = {
  superadmin: FIELD_ORDER_CASH_LEDGER,
  organization_admin: FIELD_ORDER_CASH_LEDGER,
  manager: [
    "id","date","type","direction",
    "account_id",
    "amount","currency",
    "reference_type","reference_id",
    "description"
  ],
  staff: [
    "id","date","type","direction",
    "amount","currency"
  ]
};

/* -------------------- Expense -------------------- */
export const FIELD_VISIBILITY_EXPENSE = {
  superadmin: FIELD_ORDER_EXPENSE,
  organization_admin: FIELD_ORDER_EXPENSE,
  manager: [
    "id","expense_number","date","amount","currency","category",
    "payment_method","account_id","description","status"
  ],
  staff: [
    "id","date","amount","category","description"
  ]
};

/* -------------------- Payroll -------------------- */
export const FIELD_VISIBILITY_PAYROLL = {
  superadmin: FIELD_ORDER_PAYROLL,
  organization_admin: FIELD_ORDER_PAYROLL,
  manager: [
    "id","payroll_number","employee_id","period","currency",
    "basic_salary","allowances","deductions","net_salary","status"
  ],
  staff: [
    "id","employee_id","period","net_salary"
  ]
};

/* -------------------- Cash Closing -------------------- */
export const FIELD_VISIBILITY_CASH_CLOSING = {
  superadmin: FIELD_ORDER_CASH_CLOSING,
  organization_admin: FIELD_ORDER_CASH_CLOSING,
  manager: [
    "id","date","account_id",
    "opening_balance","closing_balance",
    "total_in","total_out",
    "is_locked"
  ],
  staff: [
    "id","date","closing_balance","is_locked"
  ]
};

/* -------------------- Organization -------------------- */
export const FIELD_VISIBILITY_ORGANIZATION = {
    superadmin: FIELD_ORDER_ORGANIZATION, 
  organization_admin: FIELD_ORDER_ORGANIZATION,
  manager: ["id", "name", "code", "status"], 
  staff: ["id", "name", "status"],
};

/* -------------------- Facility -------------------- */
export const FIELD_VISIBILITY_FACILITY = {
    superadmin: FIELD_ORDER_FACILITY,
  organization_admin: FIELD_ORDER_FACILITY,
  manager: ["id", "organization_id", "name", "code", "status"],
  staff: ["id", "name", "status"]
};

/* -------------------- Role -------------------- */
export const FIELD_VISIBILITY_ROLE = {
    superadmin: FIELD_ORDER_ROLE,
  organization_admin: FIELD_ORDER_ROLE,
  manager: ["id", "name", "description", "role_type", "status"],
  staff: ["id", "name", "status"]
};

/* -------------------- User -------------------- */
export const FIELD_VISIBILITY_USER = {
  superadmin: FIELD_ORDER_USER,
  organization_admin: FIELD_ORDER_USER,
  manager: FIELD_ORDER_USER,
  staff: FIELD_ORDER_USER
};
/* -------------------- Permission -------------------- */
export const FIELD_VISIBILITY_PERMISSION = {
    superadmin: FIELD_ORDER_PERMISSION,
  organization_admin: FIELD_ORDER_PERMISSION,
  manager: [
    "id", "key", "name", "description", "module", "category", "is_global",
    "created_at", "updated_at"
  ],
  staff: [
    "id", "key", "name", "description"
  ]
};

/* -------------------- Role Permission -------------------- */
export const FIELD_VISIBILITY_ROLE_PERMISSION = {
    superadmin: FIELD_ORDER_ROLE_PERMISSION,
  organization_admin: FIELD_ORDER_ROLE_PERMISSION,
  manager: [
    "id", "role_id", "permission_id", "organization_id", "facility_id", "created_at"
  ],
  staff: [
    "id", "role_id", "permission_id"
  ]
};


/* -------------------- User Facility -------------------- */
export const FIELD_VISIBILITY_USER_FACILITY = {
    superadmin: FIELD_ORDER_USER_FACILITY,
  organization_admin: FIELD_ORDER_USER_FACILITY,
  manager: ["id", "user_id", "organization_id", "facility_id", "role_id"],
  staff: ["id", "user_id", "organization_id", "facility_id"]
};


/* -------------------- Department -------------------- */
export const FIELD_VISIBILITY_DEPARTMENT = {
    superadmin: FIELD_ORDER_DEPARTMENT,
  organization_admin: FIELD_ORDER_DEPARTMENT,
  manager: ["id", "organization_id", "facility_id", "name", "code", "status"], // ✅ added id + organization_id
  staff: ["id", "facility_id", "name", "status"]
};

/* -------------------- Employee -------------------- */
export const FIELD_VISIBILITY_EMPLOYEE = {
    superadmin: FIELD_ORDER_EMPLOYEE,
  organization_admin: FIELD_ORDER_EMPLOYEE,
  manager: [
    "id", "organization_id", "facility_id", "department_id",
    "first_name", "middle_name", "last_name",
    "gender", "dob", "phone", "email", "address",
    "employee_no", "position", "status",
    "license_no", "specialty", "certifications",     "emergency_contact_name",
    "emergency_contact_phone",
    "hire_date", "termination_date",
    "emergency_contacts",
    "photo_path", "resume_url", "document_url",
    "user_id"
  ],
  staff: [
    "id", "organization_id", "facility_id", "department_id",
    "first_name", "middle_name", "last_name",
    "gender", "dob", "phone", "email", "address",
    "employee_no", "position", "status",
    "license_no", "specialty", "certifications",     "emergency_contact_name",
    "emergency_contact_phone",
    "hire_date", "termination_date",
    "emergency_contacts",
    "photo_path", "resume_url", "document_url"
  ]
};

/* -------------------- Feature Module -------------------- */
export const FIELD_VISIBILITY_FEATURE_MODULE = {
  superadmin: FIELD_ORDER_FEATURE_MODULE,
  organization_admin: FIELD_ORDER_FEATURE_MODULE,
  manager: [
    "id","name","key","icon","category","description","tags",
    "visibility","tenant_scope","enabled","status",
    "order_index","route","parent_id",
    "show_on_dashboard","dashboard_type","dashboard_order"
  ],
  staff: ["id","name","status"]
};


/* -------------------- Feature Access -------------------- */
export const FIELD_VISIBILITY_FEATURE_ACCESS = {
    superadmin: FIELD_ORDER_FEATURE_ACCESS,
  organization_admin: FIELD_ORDER_FEATURE_ACCESS,
  manager: ["id", "organization_id", "facility_id", "module_id", "role_id", "status"],
  staff: ["id", "facility_id", "module_id", "status"]
};


/* -------------------- Vital -------------------- */
export const FIELD_VISIBILITY_VITAL = {
    superadmin: FIELD_ORDER_VITAL,
  organization_admin: FIELD_ORDER_VITAL,
  manager: [
    "id", "patient_id", "registration_log_id", "admission_id", "consultation_id", "nurse_id", "triage_record_id",
    "bp", "pulse", "rr", "temp", "oxygen", "weight", "height",
    "rbg", "pain_score", "position", "status", "recorded_at"
  ],
  staff: [
    "id", "patient_id", "registration_log_id", "consultation_id",
    "bp", "pulse", "rr", "temp", "oxygen",
    "weight", "height", "rbg", "pain_score", "position", "recorded_at"
  ]
};


/* -------------------- Consultation Staff -------------------- */
export const FIELD_VISIBILITY_CONSULTATION_STAFF = {
    superadmin: FIELD_ORDER_CONSULTATION_STAFF,
  organization_admin: FIELD_ORDER_CONSULTATION_STAFF,
  manager: ["id", "consultation_id", "employee_id", "role", "status"],
  staff: ["id", "consultation_id", "employee_id", "role"]
};

/* -------------------- Patient -------------------- */
export const FIELD_VISIBILITY_PATIENT = {
  superadmin: FIELD_ORDER_PATIENT,
  organization_admin: FIELD_ORDER_PATIENT,

  manager: [
    "id","pat_no","first_name","middle_name","last_name",
    "date_of_birth","date_of_birth_precision","gender",
    "phone_number","email_address","home_address",
    "marital_status","religion","profession",
    "national_id","insurance_number","passport_number",
    "emergency_contacts",
    "registration_status","source_of_registration",
    "notes","qr_code_path","photo_path"
  ],

  staff: [
    "id","pat_no","first_name","middle_name","last_name",
    "date_of_birth","date_of_birth_precision","gender",
    "phone_number","email_address","home_address",
    "marital_status","religion","profession",
    "national_id","insurance_number","passport_number",
    "emergency_contacts",
    "registration_status","source_of_registration",
    "notes","qr_code_path","photo_path"
  ]
};


/* -------------------- Facility Branding -------------------- */
export const FIELD_VISIBILITY_FACILITY_BRANDING = {
    superadmin: FIELD_ORDER_FACILITY_BRANDING,
  organization_admin: FIELD_ORDER_FACILITY_BRANDING,
  manager: ["id", "facility_id", "theme", "logo_url", "logo_print_url", "favicon_url", "default_letterhead_id", "status"],
  staff: ["id", "facility_id", "theme", "logo_url", "status"]
};

/* -------------------- Letterhead Template -------------------- */
export const FIELD_VISIBILITY_LETTERHEAD_TEMPLATE = {
    superadmin: FIELD_ORDER_LETTERHEAD_TEMPLATE,
  organization_admin: FIELD_ORDER_LETTERHEAD_TEMPLATE,
  manager: ["id", "name", "status", "header_html", "footer_html", "logo_url", "watermark_url", "version", "effective_from", "effective_to"],
  staff: ["id", "name", "status", "logo_url"]
};

/* -------------------- Organization Branding -------------------- */
export const FIELD_VISIBILITY_ORGANIZATION_BRANDING = {
  superadmin: FIELD_ORDER_ORGANIZATION_BRANDING,
  organization_admin: FIELD_ORDER_ORGANIZATION_BRANDING,

  manager: [
    "id",
    "organization_id",

    "company_name",
    "theme",

    "logo_url",
    "logo_print_url",
    "favicon_url",

    "currency",
    "timezone",

    "status",
  ],

  staff: [
    "id",
    "company_name",
    "logo_url",
    "status",
  ],
};
/* -------------------- Plan -------------------- */
export const FIELD_VISIBILITY_PLAN = {
    superadmin: FIELD_ORDER_PLAN,
  organization_admin: FIELD_ORDER_PLAN,
  manager: ["id", "name", "description", "price", "status"],
  staff: ["id", "name", "description", "status"]
};

/* -------------------- Stock Request -------------------- */
export const FIELD_VISIBILITY_STOCK_REQUEST = {
    superadmin: FIELD_ORDER_STOCK_REQUEST,
  organization_admin: FIELD_ORDER_STOCK_REQUEST,
  manager: [
    "id", "reference_number", "department_id", "status", "notes", "rejection_reason", "issue_notes", "fulfillment_notes",
    "approved_by_id", "approved_at", "rejected_by_id", "rejected_at", "issued_by_id", "issued_at", "fulfilled_by_id", "fulfilled_at"
  ],
  staff: ["id", "reference_number", "department_id", "status", "notes"]
};

/* -------------------- Stock Request Item -------------------- */
export const FIELD_VISIBILITY_STOCK_REQUEST_ITEM = {
    superadmin: FIELD_ORDER_STOCK_REQUEST_ITEM,
  organization_admin: FIELD_ORDER_STOCK_REQUEST_ITEM,
  manager: [
    "id", "stock_request_id", "master_item_id", "quantity", "issued_quantity", "fulfilled_quantity",
    "status", "remarks", "fulfillment_notes", "rejection_reason"
  ],
  staff: ["id", "master_item_id", "quantity", "issued_quantity", "status"]
};

/* -------------------- Master Item -------------------- */
export const FIELD_VISIBILITY_MASTER_ITEM = {
    superadmin: FIELD_ORDER_MASTER_ITEM,
  organization_admin: FIELD_ORDER_MASTER_ITEM,
  manager: [
    "id", "organization_id", "facility_id", "feature_module_id",
    "name", "code", "description", "item_type", "category_id", "department_id",
    "generic_group", "strength", "dosage_form", "unit", "reorder_level",
    "is_controlled", "sample_required", "test_method", "reference_price",
    "currency", "status"
  ],
  staff: [
    "id", "name", "code", "item_type", "category_id", "department_id",
    "unit", "reference_price", "currency", "status"
  ]
};


/* -------------------- Supplier -------------------- */
export const FIELD_VISIBILITY_SUPPLIER = {
    superadmin: FIELD_ORDER_SUPPLIER,
  organization_admin: FIELD_ORDER_SUPPLIER,
  manager: [
    "id", "name", "contact_name", "contact_email", "contact_phone",
    "address", "notes", "status"
  ],
  staff: ["id", "name", "contact_phone", "status"]
};

/* -------------------- Billable Item -------------------- */
export const FIELD_VISIBILITY_BILLABLE_ITEM = {
  superadmin: FIELD_ORDER_BILLABLE_ITEM,
  organization_admin: FIELD_ORDER_BILLABLE_ITEM,
  manager: [
    "id", "master_item_id", "department_id", "name", "category_id", "description",

    "item_type", "billing_mode",

    "price", "currency", "taxable", "discountable", "override_allowed",

    "is_active",

    "status"
  ],
  staff: [
    "id", "name",

    "item_type",

    "price", "currency", "status"
  ]
};

/* -------------------- Billable Item Price -------------------- */
export const FIELD_VISIBILITY_BILLABLE_ITEM_PRICE = {
  superadmin: FIELD_ORDER_BILLABLE_ITEM_PRICE,
  organization_admin: FIELD_ORDER_BILLABLE_ITEM_PRICE,
  manager: [
    "id", "billable_item_id",

    "payer_type", "currency",
    "price",

    "is_default",

    "effective_from", "effective_to"
  ],
  staff: [
    "id", "billable_item_id",

    "currency",
    "price",

    "effective_from"
  ]
};
/* -------------------- Billable Item Price History -------------------- */
export const FIELD_VISIBILITY_BILLABLE_ITEM_PRICE_HISTORY = {
  superadmin: FIELD_ORDER_BILLABLE_ITEM_PRICE_HISTORY,
  organization_admin: FIELD_ORDER_BILLABLE_ITEM_PRICE_HISTORY,
  manager: [
    "id", "billable_item_id",

    "payer_type", "currency",

    "old_price", "new_price",

    "change_type",

    "effective_date"
  ],
  staff: [
    "id", "billable_item_id",

    "currency",

    "new_price",

    "effective_date"
  ]
};
/* -------------------- Consultation -------------------- */
export const FIELD_VISIBILITY_CONSULTATION = {
    superadmin: FIELD_ORDER_CONSULTATION,
  organization_admin: FIELD_ORDER_CONSULTATION,
  manager: [
    "id", "appointment_id", "registration_log_id", "recommendation_id", "parent_consultation_id", "triage_id",
    "patient_id", "doctor_id", "department_id", "invoice_id", "consultation_type_id",
    "consultation_date", "diagnosis", "consultation_notes", "status"
  ],
  staff: [
    "id", "patient_id", "doctor_id", "department_id",
    "consultation_date", "diagnosis", "consultation_notes", "status"
  ]
};


/* -------------------- Deposit -------------------- */
export const FIELD_VISIBILITY_DEPOSIT = {
    superadmin: FIELD_ORDER_DEPOSIT,
  organization_admin: FIELD_ORDER_DEPOSIT,
  manager: ["deposit_number", 
    "id", "patient_id", "organization_id", "facility_id", "applied_invoice_id",
    "amount", "applied_amount", "remaining_balance", "unapplied_amount",
    "method", "transaction_ref", "status", "notes", "reason"
  ],
  staff: ["deposit_number", 
    "id", "patient_id", "amount", "remaining_balance", "unapplied_amount",
    "method", "status"
  ]
};

/* -------------------- Financial Ledger -------------------- */
export const FIELD_VISIBILITY_FINANCIAL_LEDGER = {
    superadmin: FIELD_ORDER_FINANCIAL_LEDGER,
  organization_admin: FIELD_ORDER_FINANCIAL_LEDGER,
  manager: [
    "id", "organization_id", "facility_id",
    "invoice_id", "patient_id",
    "transaction_type", "amount", "method", "status", "note"
  ],
  staff: [
    "id", "invoice_id", "patient_id",
    "transaction_type", "amount", "status"
  ]
};

/* -------------------- Invoice Item -------------------- */
export const FIELD_VISIBILITY_INVOICE_ITEM = {
    superadmin: FIELD_ORDER_INVOICE_ITEM,
  organization_admin: FIELD_ORDER_INVOICE_ITEM,
  manager: [
    "id", "invoice_id", "billable_item_id", "description",
    "unit_price", "quantity", "discount", "tax",
    "total_price", "net_amount", "total", "note"
  ],
  staff: [
    "id", "billable_item_id", "description",
    "unit_price", "quantity", "total_price", "total"
  ]
};

/* -------------------- Refund -------------------- */
export const FIELD_VISIBILITY_REFUND = {
    superadmin: FIELD_ORDER_REFUND,
  organization_admin: FIELD_ORDER_REFUND,
  manager: ["refund_number", 
    "id", "payment_id", "invoice_id", "amount", "method", "reason", "status",
    "approved_by_id", "approved_at",
    "rejected_by_id", "rejected_at",
    "processed_by_id", "processed_at",
    "cancelled_by_id", "cancelled_at"
  ],
  staff: ["refund_number", "id", "invoice_id", "amount", "method", "status"]
};

/* -------------------- Refund Deposit -------------------- */
export const FIELD_VISIBILITY_REFUND_DEPOSIT = {
    superadmin: FIELD_ORDER_REFUND_DEPOSIT,
  organization_admin: FIELD_ORDER_REFUND_DEPOSIT,
  manager: ["refund_deposit_number",
    "id", "deposit_id", "patient_id",
    "refund_amount", "method", "reason", "status",
    "reviewed_by_id", "reviewed_at",
    "approved_by_id", "approved_at",
    "processed_by_id", "processed_at",
    "voided_by_id", "voided_at",
    "restored_by_id", "restored_at",
    "created_by_id", "created_at"
  ],
  staff: ["refund_deposit_number",
    "id", "refund_amount", "method", "reason", "status"
  ]
};

/* -------------------- Refund Transaction -------------------- */
export const FIELD_VISIBILITY_REFUND_TRANSACTION = {
    superadmin: FIELD_ORDER_REFUND_TRANSACTION,
  organization_admin: FIELD_ORDER_REFUND_TRANSACTION,
  manager: [
    "id", "refund_id", "invoice_id", "patient_id", "amount", "reason", "status",
    "approved_by_id", "approved_at",
    "rejected_by_id", "rejected_at", "reject_reason",
    "processed_by_id", "processed_at",
    "cancelled_by_id", "cancelled_at",
    "reversed_by_id", "reversed_at"
  ],
  staff: ["id", "refund_id", "invoice_id", "amount", "status"]
};


/* -------------------- Registration Log -------------------- */
export const FIELD_VISIBILITY_REGISTRATION_LOG = {
  superadmin: FIELD_ORDER_REGISTRATION_LOG,
  organization_admin: FIELD_ORDER_REGISTRATION_LOG,

  manager: [
    "id", "patient_id", "registrar_id", "invoice_id", "registration_type_id",

    // 🔥 NEW
    "payer_type",
    "patient_insurance_id",

    "registration_method", "registration_source", "patient_category",
    "visit_reason", "is_emergency", "registration_time", "log_status", "notes"
  ],

  staff: [
    "id", "patient_id",

    // 🔥 NEW (only this one)
    "payer_type",

    "registration_method", "patient_category",
    "visit_reason", "is_emergency", "registration_time", "log_status"
  ]
};

/* -------------------- Plan Module -------------------- */
export const FIELD_VISIBILITY_PLAN_MODULE = {
    superadmin: FIELD_ORDER_PLAN_MODULE,
  organization_admin: FIELD_ORDER_PLAN_MODULE,
  manager: ["id", "plan_id", "module_id", "enabled"],
  staff: ["id", "plan_id", "module_id", "enabled"]
};

/* -------------------- Central Stock -------------------- */
export const FIELD_VISIBILITY_CENTRAL_STOCK = {
    superadmin: FIELD_ORDER_CENTRAL_STOCK,
  organization_admin: FIELD_ORDER_CENTRAL_STOCK,
  manager: [
    "id", "master_item_id", "supplier_id", "batch_number", "received_date", "expiry_date",
    "quantity", "unit_cost", "is_locked", "status"
  ],
  staff: [
    "id", "master_item_id", "supplier_id", "batch_number", "received_date",
    "expiry_date", "quantity", "status"
  ]
};

/* -------------------- Stock Adjustment -------------------- */
export const FIELD_VISIBILITY_STOCK_ADJUSTMENT = {
    superadmin: FIELD_ORDER_STOCK_ADJUSTMENT,
  organization_admin: FIELD_ORDER_STOCK_ADJUSTMENT,
  manager: [
    "id", "central_stock_id", "adjustment_type", "quantity", "reason",
    "status", "approved_by_id", "approved_at"
  ],
  staff: ["id", "central_stock_id", "adjustment_type", "quantity", "reason", "status"]
};

/* -------------------- Appointment -------------------- */
export const FIELD_VISIBILITY_APPOINTMENT = {
    superadmin: FIELD_ORDER_APPOINTMENT,
  organization_admin: FIELD_ORDER_APPOINTMENT,
  manager: [
    "id", "appointment_code", "patient_id", "doctor_id", "department_id", "invoice_id",
    "date_time", "status", "notes"
  ],
  staff: [
    "id", "appointment_code", "patient_id", "doctor_id", "date_time", "status"
  ]
};

/* -------------------- Lab Request -------------------- */
export const FIELD_VISIBILITY_LAB_REQUEST = {
    superadmin: FIELD_ORDER_LAB_REQUEST,
  organization_admin: FIELD_ORDER_LAB_REQUEST,
  manager: [
    "id", "patient_id", "doctor_id", "department_id", "consultation_id",
    "lab_test_id", "registration_log_id", "invoice_id", "request_date", "status",
    "notes", "is_emergency", "billed"
  ],
  staff: ["id", "patient_id", "doctor_id", "lab_test_id", "registration_log_id", "request_date", "status"]
};

/* -------------------- Lab Request Item -------------------- */
export const FIELD_VISIBILITY_LAB_REQUEST_ITEM = {
    superadmin: FIELD_ORDER_LAB_REQUEST_ITEM,
  organization_admin: FIELD_ORDER_LAB_REQUEST_ITEM,
  manager: [
    "id", "lab_request_id", "lab_test_id", "invoice_item_id",
    "status", "notes", "billed", "created_at", "updated_at"
  ],
  staff: [
    "id", "lab_test_id", "status", "notes"
  ]
};

/* -------------------- Prescription -------------------- */
export const FIELD_VISIBILITY_PRESCRIPTION = {
    superadmin: FIELD_ORDER_PRESCRIPTION,
  organization_admin: FIELD_ORDER_PRESCRIPTION,
  manager: [
    "id", "consultation_id", "registration_log_id",
    "patient_id", "doctor_id", "department_id", "invoice_id",
    "prescription_date",
    "is_emergency", "notes",
    "status", "issued_at", "dispensed_at", "completed_at",
    "fulfilled_by_id", "fulfilled_at",   // ✅ updated (was fulfilled_by)
    "billed"
  ],
  staff: [
    "id", "patient_id", "doctor_id",
    "prescription_date",
    "is_emergency", "notes", "status"
  ]
};


/* -------------------- Prescription Item -------------------- */
export const FIELD_VISIBILITY_PRESCRIPTION_ITEM = {
    superadmin: FIELD_ORDER_PRESCRIPTION_ITEM,
  organization_admin: FIELD_ORDER_PRESCRIPTION_ITEM,
  manager: [
    "id", "prescription_id", "medication_id",
    "billable_item_id", "invoice_item_id",
    "patient_id",
    "dosage", "route", "duration", "quantity", "instructions",
    "refill_allowed", "refill_count",
    "status", "dispensed_qty",          // ✅ added
    "dispensed_at", "cancelled_at",
    "billed"
  ],
  staff: [
    "id", "medication_id",
    "dosage", "route", "duration", "quantity", "instructions",
    "status"
  ]
};



/* -------------------- Lab Supply -------------------- */
export const FIELD_VISIBILITY_LAB_SUPPLY = {
    superadmin: FIELD_ORDER_LAB_SUPPLY,
  organization_admin: FIELD_ORDER_LAB_SUPPLY,
  manager: ["id", "name", "unit", "quantity", "reorder_level", "status"],
  staff: ["id", "name", "unit", "quantity", "status"]
};


/* -------------------- Surgery -------------------- */
export const FIELD_VISIBILITY_SURGERY = {
    superadmin: FIELD_ORDER_SURGERY,
  organization_admin: FIELD_ORDER_SURGERY,
  manager: [
    "id", "patient_id", "consultation_id", "surgeon_id", "department_id",
    "billable_item_id", "invoice_id", "scheduled_date", "surgery_type",
    "duration_minutes", "anesthesia_type", "complications", "notes",
    "cost_override", "document_url", "is_emergency", "status"
  ],
  staff: [
    "id", "patient_id", "surgeon_id", "department_id", "scheduled_date",
    "surgery_type", "duration_minutes", "anesthesia_type", "status"
  ]
};

/* -------------------- Bed -------------------- */
export const FIELD_VISIBILITY_BED = {
    superadmin: FIELD_ORDER_BED,
  organization_admin: FIELD_ORDER_BED,
  manager: ["id", "room_number", "bed_number", "department_id", "status"],
  staff: ["id", "room_number", "bed_number", "status"]
};

/* -------------------- Employee Shift -------------------- */
export const FIELD_VISIBILITY_EMPLOYEE_SHIFT = {
    superadmin: FIELD_ORDER_EMPLOYEE_SHIFT,
  organization_admin: FIELD_ORDER_EMPLOYEE_SHIFT,
  manager: ["id", "employee_id", "day_of_week", "shift_start_time", "shift_end_time", "status"],
  staff: ["id", "employee_id", "day_of_week", "shift_start_time", "shift_end_time", "status"]
};

/* -------------------- Master Item Category -------------------- */
export const FIELD_VISIBILITY_MASTER_ITEM_CATEGORY = {
    superadmin: FIELD_ORDER_MASTER_ITEM_CATEGORY,
  organization_admin: FIELD_ORDER_MASTER_ITEM_CATEGORY,
  manager: ["id", "organization_id", "facility_id", "name", "code", "description", "status"],
  staff: ["id", "name", "code", "status"]
};

/* -------------------- Access Violation Log -------------------- */
export const FIELD_VISIBILITY_ACCESS_VIOLATION_LOG = {
    superadmin: FIELD_ORDER_ACCESS_VIOLATION_LOG,
  organization_admin: FIELD_ORDER_ACCESS_VIOLATION_LOG,
  manager: ["id", "user_id", "action", "reason", "status"],
  staff: ["id", "user_id", "action", "status"]
};

/* -------------------- Delivery Record -------------------- */
export const FIELD_VISIBILITY_DELIVERY_RECORD = {
    superadmin: FIELD_ORDER_DELIVERY_RECORD,
  organization_admin: FIELD_ORDER_DELIVERY_RECORD,
  manager: [
    "id", "patient_id", "consultation_id", "doctor_id", "midwife_id", "department_id",
    "billable_item_id", "invoice_id", "delivery_date", "delivery_type", "baby_count",
    "delivery_mode", "birth_weight", "birth_length", "newborn_weight", "newborn_gender",
    "apgar_score", "complications", "notes", "is_emergency", "status"
  ],
  staff: [
    "id", "patient_id", "doctor_id", "midwife_id", "delivery_date",
    "delivery_type", "baby_count", "delivery_mode", "status"
  ]
};
/* -------------------- Maternity Visit -------------------- */
export const FIELD_VISIBILITY_MATERNITY_VISIT = {
    superadmin: FIELD_ORDER_MATERNITY_VISIT,
  organization_admin: FIELD_ORDER_MATERNITY_VISIT,
  manager: [
    "id", "patient_id", "doctor_id", "midwife_id", "department_id", "consultation_id",
    "registration_log_id",
    "billable_item_id", "invoice_id", "visit_date", "visit_type", "lnmp", "expected_due_date",
    "estimated_gestational_age", "fundus_height", "fetal_heart_rate", "presentation",
    "position", "complaint", "gravida", "para", "abortion", "living", "visit_notes",
    "blood_pressure", "weight", "height", "temperature", "pulse_rate",
    "is_emergency", "status",
    "finalized_at", "finalized_by_id",
    "verified_at", "verified_by_id",
    "cancel_reason", "cancelled_by_id"   // ✅ added
  ],
  staff: [
    "id", "patient_id", "doctor_id", "midwife_id", "visit_date", "visit_type",
    "fundus_height", "fetal_heart_rate", "complaint", "gravida", "para",
    "blood_pressure", "weight", "height", "temperature", "pulse_rate", "status"
  ]
};

/* -------------------- Pharmacy Transaction -------------------- */
export const FIELD_VISIBILITY_PHARMACY_TRANSACTION = {
    superadmin: FIELD_ORDER_PHARMACY_TRANSACTION,
  organization_admin: FIELD_ORDER_PHARMACY_TRANSACTION,
  manager: [
    "id", "patient_id", "prescription_id", "prescription_item_id", "registration_log_id",
    "consultation_id", "department_id", "doctor_id", "invoice_item_id", "department_stock_id",
    "quantity_dispensed", "type", "status", "is_emergency", "notes",
    "fulfilled_by_id", "fulfillment_date", "void_reason", "voided_by_id", "voided_at"
  ],
  staff: [
    "id", "patient_id", "prescription_id", "department_stock_id",
    "quantity_dispensed", "type", "status"
  ]
};




/* -------------------- System Audit Log -------------------- */
export const FIELD_VISIBILITY_SYSTEM_AUDIT_LOG = {
    superadmin: FIELD_ORDER_SYSTEM_AUDIT_LOG,
  organization_admin: FIELD_ORDER_SYSTEM_AUDIT_LOG,
  manager: ["id", "table_name", "record_id", "action", "changes", "status"],
  staff: ["id", "table_name", "action", "status"]
};
/* -------------------- Patient Insurance -------------------- */
export const FIELD_VISIBILITY_PATIENT_INSURANCE = {
  superadmin: FIELD_ORDER_PATIENT_INSURANCE,
  organization_admin: FIELD_ORDER_PATIENT_INSURANCE,
  manager: [
    "id","patient_id","provider_id",
    "policy_number","plan_name",
    "coverage_limit","currency",
    "valid_from","valid_to",
    "is_primary","status"
  ],
  staff: [
    "id","patient_id","provider_id",
    "policy_number","status"
  ]
};
/* -------------------- Insurance Claim -------------------- */
export const FIELD_VISIBILITY_INSURANCE_CLAIM = {
  superadmin: FIELD_ORDER_INSURANCE_CLAIM,
  organization_admin: FIELD_ORDER_INSURANCE_CLAIM,
  manager: [
    "id","invoice_id","patient_id","provider_id",
    "claim_number","currency",
    "amount_claimed","amount_approved","amount_paid",
    "claim_date","response_date",
    "reviewed_at","approved_at","paid_at",
    "rejection_reason","notes","status"
  ],
  staff: [
    "id","invoice_id","patient_id","provider_id",
    "claim_number","currency",
    "amount_claimed","status"
  ]
};

/* -------------------- Newborn Record -------------------- */
export const FIELD_VISIBILITY_NEWBORN_RECORD = {
    superadmin: FIELD_ORDER_NEWBORN_RECORD,
  organization_admin: FIELD_ORDER_NEWBORN_RECORD,
  manager: [
    "id", "mother_id", "delivery_record_id", "gender",
    "birth_weight", "birth_length", "head_circumference",
    "apgar_score_1min", "apgar_score_5min",
    "measurement_notes",
    "complications", "notes",
    "status",
    "death_reason", "death_time",
    "transfer_reason", "transfer_facility_id", "transfer_time"
  ],
  staff: [
    "id", "mother_id", "delivery_record_id", "gender",
    "birth_weight", "birth_length",
    "status"
  ]
};

/* -------------------- Procedure Record -------------------- */
export const FIELD_VISIBILITY_PROCEDURE_RECORD = {
    superadmin: FIELD_ORDER_PROCEDURE_RECORD,
  organization_admin: FIELD_ORDER_PROCEDURE_RECORD,
  manager: [
    "id", "patient_id", "consultation_id", "performer_id", "department_id",
    "billable_item_id", "invoice_id", "procedure_date", "procedure_type",
    "description", "duration_minutes", "notes", "cost_override", "is_emergency", "status"
  ],
  staff: ["id", "patient_id", "performer_id", "procedure_date", "procedure_type", "description", "status"]
};

/* -------------------- Room -------------------- */
export const FIELD_VISIBILITY_ROOM = {
    superadmin: FIELD_ORDER_ROOM,
  organization_admin: FIELD_ORDER_ROOM,
  manager: ["id", "ward_id", "room_number", "description", "status"],
  staff: ["id", "ward_id", "room_number", "status"]
};

/* -------------------- Login Audit -------------------- */
export const FIELD_VISIBILITY_LOGIN_AUDIT = {
    superadmin: FIELD_ORDER_LOGIN_AUDIT,
  organization_admin: FIELD_ORDER_LOGIN_AUDIT,
  manager: ["id", "user_id", "login_time", "logout_time", "ip_address", "device_info", "user_agent", "status"],
  staff: ["id", "user_id", "login_time", "logout_time", "status"]
};

/* -------------------- Medical Record -------------------- */
export const FIELD_VISIBILITY_MEDICAL_RECORD = {
    superadmin: FIELD_ORDER_MEDICAL_RECORD,
  organization_admin: FIELD_ORDER_MEDICAL_RECORD,
  manager: [
    "id", "consultation_id", "patient_id", "doctor_id", "registration_log_id", "invoice_id",
    "recorded_at","status", "is_emergency", "report_path",
    "cc", "hpi", "pmh", "fh_sh", "nut_hx", "imm_hx", "obs_hx", "gyn_hx",
    "pe", "resp_ex", "cv_ex", "abd_ex", "pel_ex", "ext", "neuro_ex",
    "ddx", "dx", "lab_inv", "img_inv", "tx_mx", "summary_pg",
    "reviewed_at", "reviewed_by_id",
    "finalized_at", "finalized_by_id",
    "verified_at", "verified_by_id",
    "voided_at", "voided_by_id", "void_reason"
  ],
  staff: [
    "id", "patient_id", "doctor_id",
    "recorded_at", "status", "is_emergency",
    "cc", "hpi", "pe", "dx", "tx_mx"
  ]
};


/* -------------------- Nursing Note -------------------- */
export const FIELD_VISIBILITY_NURSING_NOTE = {
    superadmin: FIELD_ORDER_NURSING_NOTE,
  organization_admin: FIELD_ORDER_NURSING_NOTE,
  manager: [
    "id", "patient_id", "admission_id", "nurse_id", "consultation_id", "department_id",
    "note_date", "shift", "subjective", "objective", "assessment", "plan",
    "handover_notes", "status"
  ],
  staff: [
    "id", "patient_id", "nurse_id", "note_date", "shift", "subjective", "objective", "assessment", "plan", "status"
  ]
};
/* -------------------- Discount -------------------- */
export const FIELD_VISIBILITY_DISCOUNT = {
    superadmin: FIELD_ORDER_DISCOUNT,
  organization_admin: FIELD_ORDER_DISCOUNT,
  manager: [
    "id", "name", "code", "reason",
    "type", "value", "status",
    "discount_policy_id",            // 🔗 Added here
    "void_reason", "voided_by_id", "voided_at",
    "finalized_by_id", "finalized_at"
  ],
  staff: ["id", "name", "type", "value", "status"]
};


/* -------------------- Discount Waiver -------------------- */
export const FIELD_VISIBILITY_DISCOUNT_WAIVER = {
    superadmin: FIELD_ORDER_DISCOUNT_WAIVER,
  organization_admin: FIELD_ORDER_DISCOUNT_WAIVER,
  manager: [
    "id", "invoice_id", "patient_id",
    "type", "reason", "percentage", "amount", "applied_total",
    "status",
    "approved_by_employee_id", "approved_by_id", "approved_at",
    "rejected_by_id", "rejected_at",
    "voided_by_id", "voided_at", "void_reason",
    "finalized_by_id", "finalized_at"
  ],
  staff: [
    "id", "invoice_id", "patient_id",
    "type", "reason", "percentage", "amount", "applied_total", "status"
  ]
};

/* -------------------- Discount Policy -------------------- */
export const FIELD_VISIBILITY_DISCOUNT_POLICY = {
    superadmin: FIELD_ORDER_DISCOUNT_POLICY,
  organization_admin: FIELD_ORDER_DISCOUNT_POLICY,
  manager: [
    "id", "code", "name", "description",
    "discount_type", "discount_value", "applies_to",
    "effective_from", "effective_to", "status",
    "activated_by_id", "activated_at",
    "deactivated_by_id", "deactivated_at",
    "expired_by_id", "expired_at"
  ],
  staff: [
    "id", "code", "name",
    "discount_type", "discount_value", "status"
  ]
};

/* -------------------- Lab Result -------------------- */
export const FIELD_VISIBILITY_LAB_RESULT = {
    superadmin: FIELD_ORDER_LAB_RESULT,
  organization_admin: FIELD_ORDER_LAB_RESULT,
  manager: [
    "id", "organization_id", "facility_id", "patient_id",
    "lab_request_id", "lab_request_item_id", "registration_log_id",
    "department_id", "billable_item_id", "doctor_id", "consultation_id",
    "result", "notes", "doctor_notes", "result_date", "attachment_url",
    "status", "reviewed_at", "verified_at"
  ],
  staff: [
    "id", "patient_id",
    "lab_request_id", "lab_request_item_id", "registration_log_id",
    "doctor_id", "result", "notes", "result_date", "status"
  ]
};

/* -------------------- EKG Record -------------------- */
export const FIELD_VISIBILITY_EKG_RECORD = {
    superadmin: FIELD_ORDER_EKG_RECORD,
  organization_admin: FIELD_ORDER_EKG_RECORD,
  manager: [
    "id", "patient_id", "consultation_id", "registration_log_id",
    "technician_id", "heart_rate", "pr_interval", "qrs_duration", "qt_interval",
    "axis", "rhythm", "interpretation", "recommendation", "note",
    "recorded_date", "status", "is_emergency",
    "verified_by_id", "verified_at",
    "finalized_by_id", "finalized_at",
    "voided_by_id", "voided_at"
  ],
  staff: [
    "id", "patient_id", "consultation_id", "technician_id",
    "heart_rate", "rhythm", "status", "recorded_date"
  ]
};

/* -------------------- Ultrasound Record -------------------- */
export const FIELD_VISIBILITY_ULTRASOUND_RECORD = {
  superadmin: FIELD_ORDER_ULTRASOUND_RECORD,
  organization_admin: FIELD_ORDER_ULTRASOUND_RECORD,

  manager: [
    "id", "patient_id", "consultation_id", "maternity_visit_id", "technician_id",
    "scan_type", "scan_date", "scan_location", "ultra_findings", "note",
    "number_of_fetus", "presentation", "fetal_heart_rate", "gender",
    "previous_cesarean", "cesarean_date", "indication",
    "status", "is_emergency",
    "verified_by_id", "verified_at",
    "finalized_by_id", "finalized_at",
    "cancelled_by_id", "cancelled_at",
    "voided_by_id", "voided_at", "void_reason"
  ],

  staff: [
    "id", "patient_id", "consultation_id", "technician_id",
    "scan_type", "scan_date", "ultra_findings", "status"
  ]
};


/* -------------------- Department Stock -------------------- */
export const FIELD_VISIBILITY_DEPARTMENT_STOCK = {
    superadmin: FIELD_ORDER_DEPARTMENT_STOCK,
  organization_admin: FIELD_ORDER_DEPARTMENT_STOCK,
  manager: [
    "id", "organization_id", "facility_id", "department_id",
    "master_item_id", "central_stock_id",
    "batch_no", "expiry_date",        // ✅ added here
    "quantity", "min_threshold", "max_threshold", "status",
    "created_at", "updated_at"
  ],
  staff: [
    "id", "department_id", "master_item_id",
    "quantity", "status"
  ]
};


/* -------------------- Invoice -------------------- */
export const FIELD_VISIBILITY_INVOICE = {
    superadmin: FIELD_ORDER_INVOICE,
  organization_admin: FIELD_ORDER_INVOICE,
  manager: [
    "id", "patient_id", "invoice_number", "status", "currency", "due_date", "is_locked",
    "subtotal", "total", "total_paid", "balance", "refunded_amount", "total_discount", "total_tax",
    "payer_type", "insurance_provider_id", "coverage_amount", "notes"
  ],
  staff: [
    "id", "patient_id", "invoice_number", "status", "currency",
    "subtotal", "total", "total_paid", "balance", "total_tax", "payer_type"
  ]
};

/* -------------------- Organization Plan -------------------- */
export const FIELD_VISIBILITY_ORGANIZATION_PLAN = {
    superadmin: FIELD_ORDER_ORGANIZATION_PLAN,
  organization_admin: FIELD_ORDER_ORGANIZATION_PLAN,
  manager: ["id", "organization_id", "plan_id", "start_date", "end_date", "status"],
  staff: ["id", "plan_id", "start_date", "end_date", "status"]
};

/* -------------------- Insurance Provider -------------------- */
export const FIELD_VISIBILITY_INSURANCE_PROVIDER = {
    superadmin: FIELD_ORDER_INSURANCE_PROVIDER,
  organization_admin: FIELD_ORDER_INSURANCE_PROVIDER,
  manager: ["id", "name", "contact_info", "status"],
  staff: ["id", "name", "status"]
};

/* -------------------- Payment -------------------- */
export const FIELD_VISIBILITY_PAYMENT = {
    superadmin: FIELD_ORDER_PAYMENT,
  organization_admin: FIELD_ORDER_PAYMENT,
  manager: ["payment_number", 
    "id", "invoice_id", "patient_id",
    "amount", "method", "status", "transaction_ref", "is_deposit", "reason", 
  ],
  staff: ["payment_number", 
    "id", "invoice_id", "patient_id",
    "amount", "status", "method"
  ],
};


/* -------------------- Ward -------------------- */
export const FIELD_VISIBILITY_WARD = {
    superadmin: FIELD_ORDER_WARD,
  organization_admin: FIELD_ORDER_WARD,
  manager: ["id", "organization_id", "facility_id", "department_id", "name", "description", "status"],
  staff: ["id", "facility_id", "department_id", "name", "status"]
};

/* -------------------- Admission -------------------- */
export const FIELD_VISIBILITY_ADMISSION = {
    superadmin: FIELD_ORDER_ADMISSION,
  organization_admin: FIELD_ORDER_ADMISSION,
  manager: [
    "id", "patient_id", "admitting_doctor_id", "discharging_doctor_id", "department_id",
    "consultation_id", "billable_item_id", "invoice_id", "insurance_id",
    "admit_date", "discharge_date", "status", "admission_type", "is_emergency",
    "admit_reason", "referral_source", "notes", "bed_number",
    "discharge_summary", "cost_override", "document_url"
  ],
  staff: [
    "id", "patient_id", "admitting_doctor_id", "department_id",
    "admit_date", "status", "admission_type", "is_emergency",
    "admit_reason", "notes", "bed_number"
  ]
};

/* -------------------- Currency Rate -------------------- */
export const FIELD_VISIBILITY_CURRENCY_RATE = {
    superadmin: FIELD_ORDER_CURRENCY_RATE,
  organization_admin: FIELD_ORDER_CURRENCY_RATE,
  manager: ["id", "from_currency", "to_currency", "rate", "effective_date", "status"],
  staff: ["id", "from_currency", "to_currency", "rate", "status"]
};
/* -------------------- Auto Billing Rule -------------------- */
export const FIELD_VISIBILITY_AUTO_BILLING_RULE = {
    superadmin: FIELD_ORDER_AUTO_BILLING_RULE,
  organization_admin: FIELD_ORDER_AUTO_BILLING_RULE,
  manager: [
    "id", "trigger_feature_module", "trigger_module",
    "billable_item_id", "auto_generate",
    "charge_mode", "default_price", "status"
  ],
  staff: ["id", "trigger_module", "billable_item_id", "charge_mode", "status"]
};

/* -------------------- Billing Trigger -------------------- */
export const FIELD_VISIBILITY_BILLING_TRIGGER = {
  superadmin: FIELD_ORDER_BILLING_TRIGGER,
  organization_admin: FIELD_ORDER_BILLING_TRIGGER,

  manager: [
    "id", "module_key", "trigger_status",
    "is_active"
  ],

  staff: [
    "id", "module_key", "trigger_status", "is_active"
  ]
};

/* -------------------- Message -------------------- */
export const FIELD_VISIBILITY_MESSAGE = {
    superadmin: FIELD_ORDER_MESSAGE,
  organization_admin: FIELD_ORDER_MESSAGE,
  manager: [
    "id", "conversation_id", "sender_id", "sender_role", "receiver_id", "receiver_role",
    "content", "message_type", "chat_type", "is_read", "read_at",
    "deleted_by_sender", "deleted_by_receiver"
  ],
  staff: [
    "id", "conversation_id", "sender_id", "receiver_id",
    "content", "message_type", "is_read", "read_at"
  ]
};

/* -------------------- Message Attachment -------------------- */
export const FIELD_VISIBILITY_MESSAGE_ATTACHMENT = {
    superadmin: FIELD_ORDER_MESSAGE_ATTACHMENT,
  organization_admin: FIELD_ORDER_MESSAGE_ATTACHMENT,
  manager: ["id", "message_id", "file_name", "file_type", "file_size", "file_path"],
  staff: ["id", "file_name", "file_type", "file_path"]
};

/* -------------------- Conversation -------------------- */
export const FIELD_VISIBILITY_CONVERSATION = {
    superadmin: FIELD_ORDER_CONVERSATION,
  organization_admin: FIELD_ORDER_CONVERSATION,
  manager: ["id", "organization_id", "facility_id", "patient_id", "employee_id", "topic", "conversation_type"],
  staff: ["id", "patient_id", "employee_id", "topic", "conversation_type"]
};

/* -------------------- Triage Record -------------------- */
export const FIELD_VISIBILITY_TRIAGE_RECORD = {
    superadmin: FIELD_ORDER_TRIAGE_RECORD,
  organization_admin: FIELD_ORDER_TRIAGE_RECORD,
  manager: [
    "id", "patient_id", "doctor_id", "nurse_id", "registration_log_id", "invoice_id", "triage_type_id",
    "triage_status", "symptoms", "triage_notes",
    "bp", "pulse", "rr", "temp", "oxygen", "weight", "height", "rbg", "pain_score", "position",
    "recorded_at"
  ],
  staff: [
    "id", "patient_id", "doctor_id", "nurse_id",
    "triage_status", "symptoms",
    "bp", "pulse", "rr", "temp", "oxygen", "weight", "height", "rbg", "pain_score", "position",
    "recorded_at"
  ]
};


/* -------------------- Insurance PreAuthorization -------------------- */
export const FIELD_VISIBILITY_INSURANCE_PREAUTHORIZATION = {
    superadmin: FIELD_ORDER_INSURANCE_PREAUTHORIZATION,
  organization_admin: FIELD_ORDER_INSURANCE_PREAUTHORIZATION,
  manager: [
    "id", "patient_id", "provider_id", "billable_item_id", "invoice_id", "consultation_id",
    "preauth_number", "request_date", "response_date",
    "amount_requested", "amount_approved", "validity_date",
    "notes", "rejection_reason", "status"
  ],
  staff: [
    "id", "patient_id", "provider_id", "billable_item_id",
    "preauth_number", "request_date",
    "amount_requested", "amount_approved", "status"
  ]
};

/* -------------------- Radiology Record -------------------- */
export const FIELD_VISIBILITY_RADIOLOGY_RECORD = {
    superadmin: FIELD_ORDER_RADIOLOGY_RECORD,
  organization_admin: FIELD_ORDER_RADIOLOGY_RECORD,
  manager: [
    "id", "patient_id", "consultation_id", "department_id", "billable_item_id",
    "invoice_id", "radiologist_id", "verified_by_id",
    "study_type", "study_date", "body_part", "modality",
    "findings", "impression", "file_path", "status", "verified_at"
  ],
  staff: [
    "id", "patient_id", "consultation_id", "radiologist_id",
    "study_type", "study_date", "file_path", "status"
  ]
};

/* -------------------- Recommendation -------------------- */
export const FIELD_VISIBILITY_RECOMMENDATION = {
    superadmin: FIELD_ORDER_RECOMMENDATION,
  organization_admin: FIELD_ORDER_RECOMMENDATION,
  manager: [
    "id", "patient_id", "doctor_id", "department_id", "consultation_id",
    "recommendation_date", "reason", "status"
  ],
  staff: [
    "id", "patient_id", "doctor_id",
    "recommendation_date", "reason", "status"
  ]
};


/* -------------------- Patient Chart Cache -------------------- */
export const FIELD_VISIBILITY_PATIENT_CHART_CACHE = {
    superadmin: FIELD_ORDER_PATIENT_CHART_CACHE,
  organization_admin: FIELD_ORDER_PATIENT_CHART_CACHE,
  manager: ["id", "patient_id", "status", "generated_at"],
  staff: ["patient_id", "status", "generated_at"]
};

/* -------------------- Patient Chart Note -------------------- */
export const FIELD_VISIBILITY_PATIENT_CHART_NOTE = {
    superadmin: FIELD_ORDER_PATIENT_CHART_NOTE,
  organization_admin: FIELD_ORDER_PATIENT_CHART_NOTE,
  manager: ["id", "patient_id", "author_id", "note_type", "status", "content"],
  staff: ["id", "patient_id", "note_type", "status", "content"]
};

/* -------------------- Patient Chart View Log -------------------- */
export const FIELD_VISIBILITY_PATIENT_CHART_VIEW_LOG = {
    superadmin: FIELD_ORDER_PATIENT_CHART_VIEW_LOG,
  organization_admin: FIELD_ORDER_PATIENT_CHART_VIEW_LOG,
  manager: ["id", "patient_id", "user_id", "action", "viewed_at"],
  staff: ["id", "patient_id", "action", "viewed_at"]
};

/* -------------------- Order -------------------- */
export const FIELD_VISIBILITY_ORDER = {
  superadmin: FIELD_ORDER_ORDER,
  organization_admin: FIELD_ORDER_ORDER,
  manager: [
    "id","patient_id","provider_id",
    "type","priority",
    "order_date",
    "status","billing_status","fulfillment_status"
  ],
  staff: [
    "id","patient_id",
    "type",
    "order_date","status"
  ]
};

/* -------------------- Order Item -------------------- */
export const FIELD_VISIBILITY_ORDER_ITEM = {
  superadmin: FIELD_ORDER_ORDER_ITEM,
  organization_admin: FIELD_ORDER_ORDER_ITEM,
  manager: [
    "id","order_id","billable_item_id",
    "quantity","unit_price","total_price",
    "status","billing_status"
  ],
  staff: [
    "id","billable_item_id",
    "quantity","status"
  ]
};