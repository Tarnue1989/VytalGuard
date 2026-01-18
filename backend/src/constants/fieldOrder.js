/* -------------------- Organization -------------------- */
export const FIELD_ORDER_ORGANIZATION = [
  "id", "name", "code", "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Facility -------------------- */
export const FIELD_ORDER_FACILITY = [
  "id", "organization_id", "name", "code", "address",
  "phone", "email", "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Role -------------------- */
export const FIELD_ORDER_ROLE = [
  "id", "name", "description", "role_type", "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- User -------------------- */
export const FIELD_ORDER_USER = [
  "id", "username", "email", "password", 
  "first_name", "last_name", "full_name",
  "organization_id", "organization", "status",
  "last_login_at", "login_attempts", "locked_until", "must_reset_password", 
  "is_system", "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Permission -------------------- */
export const FIELD_ORDER_PERMISSION = [
  "id", "key", "name", "description", "module", "category", "is_global",
  "created_by_id", "updated_by_id", "deleted_by_id",
  "created_at", "updated_at", "deleted_at"
];

/* -------------------- Role Permission -------------------- */
export const FIELD_ORDER_ROLE_PERMISSION = [
  "role_id", "permission_id", "organization_id", "facility_id",
  "created_by_id", "updated_by_id", "deleted_by_id",
  "created_at", "updated_at", "deleted_at"
];


/* -------------------- User Facility -------------------- */
export const FIELD_ORDER_USER_FACILITY = [
  "id", "user_id", "organization_id", "facility_id", "role_id",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Department -------------------- */
export const FIELD_ORDER_DEPARTMENT = [
  "id", "organization_id", "facility_id", "head_of_department_id",
  "name", "code", "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Employee -------------------- */
export const FIELD_ORDER_EMPLOYEE = [
  "id", "organization_id", "facility_id", "department_id",
  "first_name", "middle_name", "last_name", // ✅ added middle_name
  "gender", "dob", "phone", "email", "address",
  "employee_no", "position", "status",
  "license_no", "specialty", "certifications",   "emergency_contact_name",      // ✅ ADD
  "emergency_contact_phone",     // ✅ ADD
  "hire_date", "termination_date",
  "emergency_contacts",
  "photo_path", "resume_url", "document_url",
  "user_id", // ✅ missing before audit
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];


/* -------------------- Feature Module -------------------- */
export const FIELD_ORDER_FEATURE_MODULE = [
  "id","name","key","icon","category","description",
  "tags","visibility","tenant_scope","enabled","status",
  "order_index",
  "route","parent_id",
  "show_on_dashboard","dashboard_type","dashboard_order",
  "created_by_id","updated_by_id","deleted_by_id",
  "created_at","updated_at","deleted_at"
];


/* -------------------- Feature Access -------------------- */
export const FIELD_ORDER_FEATURE_ACCESS = [
  "id", "organization_id", "facility_id", "module_id", "role_id", "status",
  "created_by_id", "updated_by_id", "deleted_by_id",
  "created_at", "updated_at", "deleted_at"
];


/* -------------------- Patient -------------------- */
export const FIELD_ORDER_PATIENT = [
  "id","pat_no","first_name","middle_name","last_name",
  "date_of_birth","date_of_birth_precision","gender",

  "phone_number","email_address","home_address",
  "marital_status","religion","profession",

  // ✅ identifiers (REAL model fields)
  "national_id","insurance_number","passport_number",

  // ✅ emergency (JSONB – ONLY valid field)
  "emergency_contacts",

  "registration_status","source_of_registration","notes",
  "qr_code_path","photo_path",

  "organization_id","facility_id","employee_id",
  "created_at","updated_at","deleted_at",
  "created_by_id","updated_by_id","deleted_by_id"
];

/* -------------------- Vital -------------------- */
export const FIELD_ORDER_VITAL = [
  "id", "patient_id", "registration_log_id", "admission_id", "consultation_id", "nurse_id", "triage_record_id",
  "organization_id", "facility_id",
  "status",
  "bp", "pulse", "rr", "temp", "oxygen", "weight", "height",
  "rbg", "pain_score", "position",
  "recorded_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];


/* -------------------- Consultation Staff -------------------- */
export const FIELD_ORDER_CONSULTATION_STAFF = [
  "id", "consultation_id", "employee_id",
  "organization_id", "facility_id",
  "role",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Billable Item Price History -------------------- */
export const FIELD_ORDER_BILLABLE_ITEM_PRICE_HISTORY = [
  "id", "organization_id", "facility_id",
  "billable_item_id",
  "old_price", "new_price", "effective_date",
  "created_at", "created_by_id"
];

/* -------------------- Facility Branding -------------------- */
export const FIELD_ORDER_FACILITY_BRANDING = [
  "id", "organization_id", "facility_id",
  "status",
  "theme", "logo_url", "logo_print_url", "favicon_url",
  "default_letterhead_id", "contact", "meta",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Organization Branding -------------------- */
export const FIELD_ORDER_ORGANIZATION_BRANDING = [
  "id", "organization_id",
  "status",
  "theme", "logo_url", "logo_print_url", "favicon_url",
  "default_letterhead_id", "contact", "meta",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Letterhead Template -------------------- */
export const FIELD_ORDER_LETTERHEAD_TEMPLATE = [
  "id", "organization_id", "facility_id",
  "name", "status",
  "header_html", "footer_html",
  "logo_url", "watermark_url",
  "pdf_options", "version", "effective_from", "effective_to", "meta",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Plan -------------------- */
export const FIELD_ORDER_PLAN = [
  "id", "name", "description", "price",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Organization Plan -------------------- */
export const FIELD_ORDER_ORGANIZATION_PLAN = [
  "id",  "organization_id",  "plan_id",
  "start_date",  "end_date",  "status"
];

/* -------------------- Stock Request -------------------- */
export const FIELD_ORDER_STOCK_REQUEST = [
  "id", "organization_id", "facility_id", "department_id",
  "reference_number", "status", "notes", "rejection_reason", "issue_notes", "fulfillment_notes",
  "approved_by_id", "approved_at",
  "rejected_by_id", "rejected_at",
  "issued_by_id", "issued_at",
  "fulfilled_by_id", "fulfilled_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Stock Request Item -------------------- */
export const FIELD_ORDER_STOCK_REQUEST_ITEM = [
  "id", "stock_request_id", "master_item_id", "organization_id", "facility_id", "central_stock_id",
  "quantity", "issued_quantity", "fulfilled_quantity",
  "status", "remarks", "fulfillment_notes", "rejection_reason",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Supplier -------------------- */
export const FIELD_ORDER_SUPPLIER = [
  "id", "organization_id", "facility_id",
  "name", "contact_name", "contact_email", "contact_phone", "address",
  "status", "notes",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Billable Item -------------------- */
export const FIELD_ORDER_BILLABLE_ITEM = [
  "id", "organization_id", "facility_id",
  "master_item_id", "department_id",
  "name", "category_id", "description",
  "price", "currency", "taxable", "discountable", "override_allowed",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];


/* -------------------- Consultation -------------------- */
export const FIELD_ORDER_CONSULTATION = [
  "id", "appointment_id", "registration_log_id",
  "recommendation_id", "parent_consultation_id", "triage_id",
  "patient_id", "doctor_id", "department_id",
  "invoice_id", "consultation_type_id",
  "organization_id", "facility_id",
  "consultation_date", "diagnosis", "consultation_notes", "prescribed_medications",
  "status",
  "finalized_by_id", "verified_by_id",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];


/* -------------------- Deposit -------------------- */
export const FIELD_ORDER_DEPOSIT = [
  "id", "patient_id", "organization_id", "facility_id",
  "applied_invoice_id",
  "amount", "applied_amount", "remaining_balance", "unapplied_amount",
  "method", "transaction_ref",
  "status", "notes", "reason",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Financial Ledger -------------------- */
export const FIELD_ORDER_FINANCIAL_LEDGER = [
  "id",
  "organization_id", "facility_id",
  "invoice_id", "patient_id",
  "payment_id", "refund_id", "deposit_id", "discount_waiver_id",
  "transaction_type", "amount", "method", "status", "note",
  "created_by_id", "created_at"
];

/* -------------------- Invoice Item -------------------- */
export const FIELD_ORDER_INVOICE_ITEM = [
  "id", "invoice_id", "billable_item_id",
  "organization_id", "facility_id",
  "description", "unit_price", "quantity", "discount", "tax",
  "total_price", "net_amount", "total", "note",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];


/* -------------------- Refund -------------------- */
export const FIELD_ORDER_REFUND = [
  "id", "patient_id", "invoice_id", "deposit_id", "payment_id",
  "organization_id", "facility_id",
  "amount", "currency", "reason", "note", "status",
  "approved_by_id", "approved_at",
  "rejected_by_id", "rejected_at",
  "processed_by_id", "processed_at",
  "cancelled_by_id", "cancelled_at",
  "created_by_id", "created_at", 
  "updated_by_id", "updated_at", 
  "deleted_by_id", "deleted_at",
  "actions"
];
/* -------------------- Refund Deposit -------------------- */
export const FIELD_ORDER_REFUND_DEPOSIT = [
  "id", "deposit_id", "patient_id",
  "organization_id", "facility_id",
  "refund_amount", "method", "reason", "status",
  "reviewed_by_id", "reviewed_at",
  "approved_by_id", "approved_at",
  "processed_by_id", "processed_at",
  "voided_by_id", "voided_at",
  "restored_by_id", "restored_at",
  "created_by_id", "created_at",
  "updated_at", "deleted_at",
  "actions"
];


/* -------------------- Refund Transaction -------------------- */
export const FIELD_ORDER_REFUND_TRANSACTION = [
  "id", "refund_id", "patient_id", "invoice_id",
  "organization_id", "facility_id",
  "amount", "reason", "status",
  "approved_by_id", "approved_at",
  "rejected_by_id", "rejected_at", "reject_reason",
  "processed_by_id", "processed_at",
  "cancelled_by_id", "cancelled_at",
  "reversed_by_id", "reversed_at",
  "created_by_id", "created_at", 
  "updated_by_id", "updated_at", 
  "deleted_by_id", "deleted_at",
  "actions"
];


/* -------------------- Registration Log -------------------- */
export const FIELD_ORDER_REGISTRATION_LOG = [
  "id", "patient_id", "registrar_id",
  "organization_id", "facility_id",
  "invoice_id", "registration_type_id",
  "registration_method", "registration_source", "patient_category",
  "visit_reason", "is_emergency", "registration_time", "notes",
  "log_status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Plan Module -------------------- */
export const FIELD_ORDER_PLAN_MODULE = [
  "id", "plan_id", "module_id", "enabled",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Central Stock -------------------- */
export const FIELD_ORDER_CENTRAL_STOCK = [
  "id", "organization_id", "facility_id",
  "master_item_id", "supplier_id",
  "batch_number", "received_date", "expiry_date",
  "quantity", "unit_cost", "is_locked",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];
/* -------------------- Master Item -------------------- */
export const FIELD_ORDER_MASTER_ITEM = [
  "id", "organization_id", "facility_id", "feature_module_id",
  "name", "code", "description",
  "item_type", "category_id", "department_id",
  "generic_group", "strength", "dosage_form", "unit",
  "reorder_level", "is_controlled", "sample_required", "test_method",
  "reference_price", "currency",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];


/* -------------------- Master Item Category -------------------- */
export const FIELD_ORDER_MASTER_ITEM_CATEGORY = [
  "id", "organization_id", "facility_id",
  "name", "code", "description",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Stock Adjustment -------------------- */
export const FIELD_ORDER_STOCK_ADJUSTMENT = [
  "id", "central_stock_id", "organization_id", "facility_id",
  "adjustment_type", "quantity", "reason",
  "status",
  "approved_by_id", "approved_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Appointment -------------------- */
export const FIELD_ORDER_APPOINTMENT = [
  "id", "organization_id", "facility_id",
  "appointment_code",
  "patient_id", "doctor_id", "department_id", "invoice_id",
  "date_time",
  "status", "notes",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Lab Request -------------------- */
export const FIELD_ORDER_LAB_REQUEST = [
  "id", "organization_id", "facility_id",
  "patient_id", "doctor_id", "department_id",
  "registration_log_id", // ✅ add
  "consultation_id", "lab_test_id", "invoice_id",
  "request_date", "status", "notes", "is_emergency", "billed",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];
/* -------------------- Lab Request Item -------------------- */
export const FIELD_ORDER_LAB_REQUEST_ITEM = [
  "id", "organization_id", "facility_id",
  "lab_request_id", "lab_test_id", "invoice_item_id",
  "status", "notes", "billed",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Prescription -------------------- */
export const FIELD_ORDER_PRESCRIPTION = [
  "id", "organization_id", "facility_id",
  "consultation_id", "registration_log_id",
  "patient_id", "doctor_id", "department_id", "invoice_id",
  "prescription_date",
  "is_emergency", "notes",
  "status",
  "issued_at", "dispensed_at", "completed_at",
  "fulfilled_by_id", "fulfilled_at",   // ✅ updated (was fulfilled_by)
  "billed",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];


/* -------------------- Prescription Item -------------------- */
export const FIELD_ORDER_PRESCRIPTION_ITEM = [
  "id", "organization_id", "facility_id",
  "prescription_id", "medication_id",
  "billable_item_id", "invoice_item_id",
  "patient_id",
  "dosage", "route", "duration", "quantity", "instructions",
  "refill_allowed", "refill_count",
  "status",
  "dispensed_qty",                 // ✅ new field added
  "dispensed_at", "cancelled_at",
  "billed",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Lab Supply -------------------- */
export const FIELD_ORDER_LAB_SUPPLY = [
  "id", "organization_id", "facility_id",
  "name", "unit", "quantity", "reorder_level",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];


/* -------------------- Surgery -------------------- */
export const FIELD_ORDER_SURGERY = [
  "id", "organization_id", "facility_id",
  "patient_id", "consultation_id", "surgeon_id", "department_id",
  "billable_item_id", "invoice_id",
  "scheduled_date", "surgery_type", "duration_minutes", "anesthesia_type",
  "complications", "notes", "cost_override", "document_url",
  "is_emergency", "status",
  "finalized_at", "finalized_by_id",
  "verified_by_id", "verified_at",
  "voided_by_id", "voided_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Bed -------------------- */
export const FIELD_ORDER_BED = [
  "id", "organization_id", "facility_id",
  "room_number", "bed_number", "department_id",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Employee Shift -------------------- */
export const FIELD_ORDER_EMPLOYEE_SHIFT = [
  "id", "organization_id", "facility_id",
  "employee_id", "day_of_week", "shift_start_time", "shift_end_time",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];
/* -------------------- Access Violation Log -------------------- */
export const FIELD_ORDER_ACCESS_VIOLATION_LOG = [
  "id", "organization_id", "facility_id",
  "user_id", "action", "reason",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Delivery Record -------------------- */
export const FIELD_ORDER_DELIVERY_RECORD = [
  "id", "organization_id", "facility_id",
  "patient_id", "consultation_id", "doctor_id", "midwife_id", "department_id",
  "billable_item_id", "invoice_id",
  "delivery_date", "delivery_type",
  "baby_count", "delivery_mode", "birth_weight", "birth_length",
  "newborn_weight", "newborn_gender", "apgar_score",
  "complications", "notes",
  "is_emergency", "status",
  "finalized_at", "finalized_by_id",
  "verified_by_id", "verified_at",
  "voided_by_id", "voided_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Maternity Visit -------------------- */
export const FIELD_ORDER_MATERNITY_VISIT = [
  "id", "organization_id", "facility_id",
  "patient_id", "doctor_id", "midwife_id", "department_id", "consultation_id",
  "registration_log_id",
  "billable_item_id", "invoice_id",

  "visit_date", "visit_type",

  "lnmp", "expected_due_date", "estimated_gestational_age",
  "fundus_height", "fetal_heart_rate", "presentation", "position",
  "complaint", "gravida", "para", "abortion", "living",
  "visit_notes",

  "blood_pressure", "weight", "height", "temperature", "pulse_rate",

  "is_emergency", "status",

  "finalized_at", "finalized_by_id",
  "verified_at", "verified_by_id",
  "cancel_reason", "cancelled_by_id",   // ✅ added
  "void_reason", "voided_by_id",       // ✅ added

  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Pharmacy Transaction -------------------- */
export const FIELD_ORDER_PHARMACY_TRANSACTION = [
  "id", "organization_id", "facility_id",
  "patient_id", "prescription_id", "prescription_item_id", "registration_log_id",
  "consultation_id", "department_id", "doctor_id", "invoice_item_id", "department_stock_id",
  "quantity_dispensed", "type", "status", "is_emergency", "notes",
  "fulfilled_by_id", "fulfillment_date",
  "void_reason", "voided_by_id", "voided_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];


/* -------------------- System Audit Log -------------------- */
export const FIELD_ORDER_SYSTEM_AUDIT_LOG = [
  "id", "organization_id", "facility_id",
  "table_name", "record_id", "action", "changes",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Insurance Claim -------------------- */
export const FIELD_ORDER_INSURANCE_CLAIM = [
  "id", "organization_id", "facility_id",
  "invoice_id", "patient_id", "provider_id",
  "claim_number", "amount_claimed", "amount_approved",
  "claim_date", "response_date", "rejection_reason",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Newborn Record -------------------- */
export const FIELD_ORDER_NEWBORN_RECORD = [
  "id", "organization_id", "facility_id",
  "mother_id", "delivery_record_id",
  "gender", "birth_weight", "birth_length", "head_circumference",
  "apgar_score_1min", "apgar_score_5min",
  "measurement_notes",
  "complications", "notes",
  "status",
  "death_reason", "death_time",
  "transfer_reason", "transfer_facility_id", "transfer_time",
  "void_reason", "voided_by_id", "voided_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Procedure Record -------------------- */
export const FIELD_ORDER_PROCEDURE_RECORD = [
  "id", "organization_id", "facility_id",
  "patient_id", "consultation_id", "performer_id", "department_id",
  "billable_item_id", "invoice_id",
  "procedure_date", "procedure_type", "description",
  "duration_minutes", "notes", "cost_override",
  "is_emergency", "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Room -------------------- */
export const FIELD_ORDER_ROOM = [
  "id", "organization_id", "facility_id", "ward_id",
  "room_number", "description",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Login Audit -------------------- */
export const FIELD_ORDER_LOGIN_AUDIT = [
  "id", "organization_id", "facility_id",
  "user_id", "login_time", "logout_time",
  "ip_address", "device_info", "user_agent",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];
/* -------------------- Medical Record -------------------- */
export const FIELD_ORDER_MEDICAL_RECORD = [
  "id", "consultation_id", "patient_id", "doctor_id", "registration_log_id", "invoice_id",
  "recorded_at","organization_id", "facility_id",
  "status", "is_emergency",
  "report_path",
  "cc", "hpi", "pmh", "fh_sh", "nut_hx", "imm_hx", "obs_hx", "gyn_hx",
  "pe", "resp_ex", "cv_ex", "abd_ex", "pel_ex", "ext", "neuro_ex",
  "ddx", "dx", "lab_inv", "img_inv", "tx_mx", "summary_pg",
  "reviewed_at", "reviewed_by_id",
  "finalized_at", "finalized_by_id",
  "verified_at", "verified_by_id",
  "voided_at", "voided_by_id", "void_reason",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];


/* -------------------- Nursing Note -------------------- */
export const FIELD_ORDER_NURSING_NOTE = [
  "id", "organization_id", "facility_id",
  "patient_id", "admission_id", "nurse_id", "consultation_id", "department_id",
  "note_date", "shift", "subjective", "objective", "assessment", "plan", "handover_notes",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];
/* -------------------- Discount -------------------- */
export const FIELD_ORDER_DISCOUNT = [
  "id", "organization_id", "facility_id",
  "invoice_id", "invoice_item_id", "discount_policy_id",  // 🔗 Added here
  "name", "code", "reason",
  "type", "value", "status",
  "void_reason", "voided_by_id", "voided_at",
  "finalized_by_id", "finalized_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Discount Waiver -------------------- */
export const FIELD_ORDER_DISCOUNT_WAIVER = [
  "id", "organization_id", "facility_id",
  "invoice_id", "patient_id",
  "type", "reason", "percentage", "amount", "applied_total",
  "status",  "approved_by_employee_id", "approved_by_id", "approved_at",
  "rejected_by_id", "rejected_at",  "voided_by_id", "voided_at", "void_reason",
  "finalized_by_id", "finalized_at",  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Discount Policy -------------------- */
export const FIELD_ORDER_DISCOUNT_POLICY = [
  "id", "code", "name", "description",
  "discount_type", "discount_value", "applies_to", "condition_json",
  "effective_from", "effective_to", "status",
  "organization_id", "facility_id",
  "activated_by_id", "activated_at",
  "deactivated_by_id", "deactivated_at",
  "expired_by_id", "expired_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Insurance Pre-Authorization -------------------- */
export const FIELD_ORDER_INSURANCE_PREAUTHORIZATION = [
  "id", "organization_id", "facility_id",
  "patient_id", "provider_id", "billable_item_id", "invoice_id", "consultation_id",
  "preauth_number", "request_date", "response_date",
  "amount_requested", "amount_approved", "validity_date", "notes", "rejection_reason",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Lab Result -------------------- */
export const FIELD_ORDER_LAB_RESULT = [
  "id", "organization_id", "facility_id", "patient_id",
  "lab_request_id", "lab_request_item_id", "registration_log_id",
  "consultation_id", "department_id", "doctor_id", "billable_item_id",
  "result", "notes", "doctor_notes", "result_date", "attachment_url",
  "status", "reviewed_at", "verified_at",
  "created_at", "updated_at", "deleted_at",
  "entered_by_id", "reviewed_by_id", "verified_by_id",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Radiology Record -------------------- */
export const FIELD_ORDER_RADIOLOGY_RECORD = [
  "id", "organization_id", "facility_id",
  "patient_id", "consultation_id", "department_id",
  "billable_item_id", "invoice_id",
  "radiologist_id", "verified_by_id",
  "study_type", "study_date", "body_part", "modality", "findings", "impression", "file_path",
  "status",
  "verified_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Invoice -------------------- */
export const FIELD_ORDER_INVOICE = [
  "id", "patient_id", "organization_id", "facility_id",
  "invoice_number", "status", "currency", "due_date", "is_locked",
  "subtotal", "total", "total_paid", "balance", "refunded_amount", "total_discount", "total_tax",
  "payer_type", "insurance_provider_id", "coverage_amount", "notes",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Insurance Provider -------------------- */
export const FIELD_ORDER_INSURANCE_PROVIDER = [
  "id", "organization_id", "facility_id",
  "name", "contact_info",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Recommendation -------------------- */
export const FIELD_ORDER_RECOMMENDATION = [
  "id", "organization_id", "facility_id",
  "patient_id", "doctor_id", "department_id", "consultation_id",
  "recommendation_date", "reason",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];
/* -------------------- Payment -------------------- */
export const FIELD_ORDER_PAYMENT = [
  "id", "invoice_id", "patient_id", "organization_id", "facility_id",
  "amount", "method", "status", "transaction_ref", "is_deposit",
  "reason", "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Ward -------------------- */
export const FIELD_ORDER_WARD = [
  "id", "organization_id", "facility_id", "department_id",
  "name", "description",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Admission -------------------- */
export const FIELD_ORDER_ADMISSION = [
  "id", "organization_id", "facility_id",
  "patient_id", "admitting_doctor_id", "discharging_doctor_id",
  "department_id", "consultation_id", "billable_item_id", "invoice_id", "insurance_id",
  "admit_date", "discharge_date",
  "status", "admission_type",
  "is_emergency", "admit_reason", "referral_source", "notes",
  "bed_number", "discharge_summary", "cost_override", "document_url",
  "finalized_at", "finalized_by_id", "verified_by_id", "verified_at",
  "voided_by_id", "voided_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Currency Rate -------------------- */
export const FIELD_ORDER_CURRENCY_RATE = [
  "id", "organization_id", "facility_id",
  "from_currency", "to_currency", "rate", "effective_date",
  "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Auto Billing Rule -------------------- */
export const FIELD_ORDER_AUTO_BILLING_RULE = [
  "id", "organization_id", "facility_id",
  "trigger_feature_module", "trigger_module", "billable_item_id",
  "auto_generate", "charge_mode", "default_price", "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Billing Trigger -------------------- */
export const FIELD_ORDER_BILLING_TRIGGER = [
  "id","organization_id","facility_id",
  "module_key","trigger_status","is_active",
  "created_at","updated_at",
  "created_by_id","updated_by_id"
];

/* -------------------- Message -------------------- */
export const FIELD_ORDER_MESSAGE = [
  "id", "conversation_id", "sender_id", "sender_role",
  "receiver_id", "receiver_role",
  "content", "message_type", "chat_type",
  "is_read", "read_at",
  "deleted_by_sender", "deleted_by_receiver",
  "created_at", "updated_at", "deleted_at",
  "created_by", "updated_by", "deleted_by"
];

/* -------------------- Message Attachment -------------------- */
export const FIELD_ORDER_MESSAGE_ATTACHMENT = [
  "id", "message_id",
  "file_name", "file_type", "file_size", "file_path",
  "created_at", "updated_at", "deleted_at",
  "created_by", "updated_by", "deleted_by"
];

/* -------------------- Triage Record -------------------- */
export const FIELD_ORDER_TRIAGE_RECORD = [
  "id", "patient_id", "doctor_id", "nurse_id", "registration_log_id",
  "invoice_id", "triage_type_id",
  "organization_id", "facility_id",
  "triage_status", "symptoms", "triage_notes",
  "bp", "pulse", "rr", "temp", "oxygen", "weight", "height", "rbg", "pain_score", "position",
  "recorded_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Conversation -------------------- */
export const FIELD_ORDER_CONVERSATION = [
  "id", "organization_id", "facility_id",
  "patient_id", "employee_id",
  "topic", "conversation_type",
  "created_at", "updated_at", "deleted_at",
  "created_by", "updated_by", "deleted_by"
];
/* -------------------- Department Stock -------------------- */
export const FIELD_ORDER_DEPARTMENT_STOCK = [
  "id", "organization_id", "facility_id", "department_id",
  "master_item_id", "central_stock_id",
  "batch_no", "expiry_date",        // ✅ newly added
  "quantity", "min_threshold", "max_threshold", "status",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- EKG Record -------------------- */
export const FIELD_ORDER_EKG_RECORD = [
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
];
/* -------------------- Ultrasound Record -------------------- */
export const FIELD_ORDER_ULTRASOUND_RECORD = [
  "id", "organization_id", "facility_id",
  "patient_id", "consultation_id", "maternity_visit_id", "registration_log_id",
  "department_id", "billable_item_id", "invoice_id", "technician_id",
  "scan_type", "scan_date", "scan_location",
  "ultra_findings", "note",
  "number_of_fetus", "biparietal_diameter", "presentation",
  "lie", "position", "amniotic_volume", "fetal_heart_rate", "gender",
  "previous_cesarean", "prev_ces_date", "prev_ces_location",
  "cesarean_date", "indication", "next_of_kin",
  "is_emergency", "status",
  "verified_by_id", "verified_at",
  "finalized_by_id", "finalized_at",
  "voided_by_id", "voided_at", "void_reason",
  "source", "file_path",
  "created_by_id", "updated_by_id", "deleted_by_id",
  "created_at", "updated_at", "deleted_at"
];

/* -------------------- Patient Chart Cache -------------------- */
export const FIELD_ORDER_PATIENT_CHART_CACHE = [
  "id", "patient_id", "organization_id", "facility_id",
  "status", "chart_snapshot", "generated_at",
  "revalidated_by_id", "revalidated_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Patient Chart Note -------------------- */
export const FIELD_ORDER_PATIENT_CHART_NOTE = [
  "id", "patient_id", "organization_id", "facility_id",
  "author_id", "note_type", "status", "content",
  "reviewed_by_id", "reviewed_at",
  "verified_by_id", "verified_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];

/* -------------------- Patient Chart View Log -------------------- */
export const FIELD_ORDER_PATIENT_CHART_VIEW_LOG = [
  "id", "patient_id", "user_id", "organization_id", "facility_id",
  "action", "viewed_at", "ip_address", "user_agent",
  "reviewed_by_id", "reviewed_at", "verified_by_id", "verified_at",
  "created_at", "updated_at", "deleted_at",
  "created_by_id", "updated_by_id", "deleted_by_id"
];
