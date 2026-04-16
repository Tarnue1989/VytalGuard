import {
  USER_STATUS, ROLE_TYPE, FACILITY_STATUS, ORG_STATUS, ROLE_STATUS,
  FEATURE_MODULE_STATUS, FEATURE_ACCESS_STATUS, DEPARTMENT_STATUS, GENDER_TYPES,
  REGISTRATION_LOG_STATUS, REGISTRATION_METHODS, REGISTRATION_CATEGORIES,
  EMPLOYEE_STATUS, USER_FACILITY_STATUS, 
  CONSULTATION_STATUS, TRIAGE_STATUS, VITAL_STATUS, RECOMMENDATION_STATUS,
  MEDICAL_RECORD_STATUS, CONSULTATION_STAFF_ROLES,
  PLAN_STATUS, ORG_PLAN_STATUS, PLAN_MODULE_STATUS,
  INVOICE_STATUS, PAYMENT_STATUS, REFUND_STATUS, DEPOSIT_STATUS,
  AUTO_BILLING_RULE_STATUS, BILLABLE_ITEM_STATUS,
  DISCOUNT_WAIVER_STATUS, INSURANCE_CLAIM_STATUS, INSURANCE_PREAUTH_STATUS,
  PAYER_TYPES, AUTO_BILLING_CHARGE_MODE, PAYMENT_METHODS,
  CENTRAL_STOCK_STATUS, STOCK_ADJUSTMENT_STATUS, MASTER_ITEM_STATUS, MASTER_ITEM_TYPES,
  MASTER_ITEM_CATEGORY_STATUS, PHARMACY_TRANSACTION_STATUS, SUPPLIER_STATUS,
  NEWBORN_STATUS, PROCEDURE_STATUS, RADIOLOGY_STATUS,
  MATERNITY_VISIT_STATUS, SURGERY_STATUS, DELIVERY_STATUS,
  NURSING_NOTE_STATUS, BED_STATUS, WARD_STATUS, ROOM_STATUS,
  PASSWORD_HISTORY_STATUS, ACCESS_VIOLATION_STATUS, SYSTEM_AUDIT_STATUS, LOGIN_AUDIT_STATUS,
  INSURANCE_PROVIDER_STATUS, 
  APPOINTMENT_STATUS, ADMISSION_STATUS, ADMISSION_TYPE,
  ADJUSTMENT_TYPES, STOCK_REQUEST_STATUS, STOCK_REQUEST_ITEM_STATUS,
  CURRENCY_RATE_STATUS, LAB_REQUEST_STATUS, LAB_RESULT_STATUS, LAB_SUPPLY_STATUS,
  PRESCRIPTION_STATUS, PRESCRIPTION_ITEM_STATUS, PATIENT_INSURANCE_STATUS,

  // 🔹 ORDER (NEW)
  ORDER_STATUS, ORDER_TYPE, ORDER_PRIORITY,
  ORDER_FULFILLMENT_STATUS, ORDER_BILLING_STATUS,
  ORDER_ITEM_STATUS,

  EMPLOYEE_SHIFT_STATUS,
  ULTRASOUND_STATUS, LETTERHEAD_STATUS, LETTERHEAD_TEMPLATE_STATUS,
  THEME_STATUS, HOME_CONTENT_STATUS, ANNOUNCEMENT_STATUS, VIDEO_STATUS, 
  LEDGER_STATUS, LEDGER_TRANSACTION_TYPE, LAB_REQUEST_ITEM_STATUS, DEPARTMENT_STOCK_STATUS,
  DISCOUNT_TYPE, DISCOUNT_STATUS, POLICY_APPLIES_TO, POLICY_STATUS,

  // 🔥 NEW (BILLING)
  BILLING_MODE, PRICE_CHANGE_TYPE,


} from "./enums.js";
// 🧠 Safe join helper for enums (handles both arrays & objects)
const joinValues = (e) =>
  Array.isArray(e) ? e.join(", ") : Object.values(e).join(", ");

/* -------------------- Account -------------------- */
export const FIELD_LABELS_ACCOUNT = {
  id: "ID", account_number: "Account Number", name: "Account Name",
  type: "Account Type", currency: "Currency",
  balance: "Balance", is_active: "Active",
  organization_id: "Organization", facility_id: "Facility",
  created_at: "Created At", updated_at: "Updated At"
};

/* -------------------- Cash Ledger -------------------- */
export const FIELD_LABELS_CASH_LEDGER = {
  id: "ID", date: "Date",
  type: "Ledger Type", direction: "Direction",
  account_id: "Account",
  from_account_id: "From Account", to_account_id: "To Account",
  amount: "Amount", currency: "Currency",
  reference_type: "Reference Type", reference_id: "Reference",
  reversal_of_id: "Reversal Of",
  description: "Description",
  created_at: "Created At"
};

/* -------------------- Expense -------------------- */
export const FIELD_LABELS_EXPENSE = {
  id: "ID",
  expense_number: "Expense #",
  date: "Date",
  amount: "Amount",
  currency: "Currency",
  category: "Category",
  payment_method: "Payment Method",
  account_id: "Account",
  employee_id: "Employee",
  ledger_id: "Ledger Entry",
  status: "Status",
  description: "Description",

  created_at: "Created At",
  approved_by_id: "Approved By",
  approved_at: "Approved At",
  posted_by_id: "Posted By",
  posted_at: "Posted At",
  reversed_by_id: "Reversed By",
  reversed_at: "Reversed At",
  voided_by_id: "Voided By",
  voided_at: "Voided At"
};
/* -------------------- Payroll -------------------- */
export const FIELD_LABELS_PAYROLL = {
  id: "ID",
  payroll_number: "Payroll #",
  employee_id: "Employee",
  period: "Period",
  currency: "Currency",
  basic_salary: "Basic Salary",
  allowances: "Allowances",
  deductions: "Deductions",
  net_salary: "Net Salary",
  expense_id: "Expense",
  paid_at: "Paid At",
  status: "Status",
  created_at: "Created At",
  approved_by_id: "Approved By",
  approved_at: "Approved At"
};

/* -------------------- Cash Closing -------------------- */
export const FIELD_LABELS_CASH_CLOSING = {
  id: "ID", date: "Date",
  account_id: "Account",
  opening_balance: "Opening Balance",
  closing_balance: "Closing Balance",
  total_in: "Total In",
  total_out: "Total Out",
  is_locked: "Locked",
  closed_by_id: "Closed By",
  closed_at: "Closed At",
  created_at: "Created At"
};
/* -------------------- Organization -------------------- */
export const FIELD_LABELS_ORGANIZATION = {
  id: "ID", name: "Organization Name", code: "Code",
  status: `Status (${joinValues(ORG_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Facility -------------------- */
export const FIELD_LABELS_FACILITY = {
  id: "ID", organization_id: "Organization", name: "Facility Name",
  code: "Code", address: "Address", phone: "Phone", email: "Email",
  status: `Status (${joinValues(FACILITY_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Role -------------------- */
export const FIELD_LABELS_ROLE = {
  id: "ID", name: "Role Name", description: "Description",
  role_type: `Role Type (${joinValues(ROLE_TYPE)})`,
  status: `Status (${joinValues(ROLE_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- User -------------------- */
export const FIELD_LABELS_USER = {
  id: "ID", username: "Username", email: "Email", organization_id: "Organization",
  status: `Status (${joinValues(USER_STATUS)})`, last_login_at: "Last Login",
  login_attempts: "Failed Login Attempts", locked_until: "Locked Until", must_reset_password: "Must Reset Password",
  is_system: "System Account", // ✅ NEW
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Permission -------------------- */
export const FIELD_LABELS_PERMISSION = {
  id: "ID", key: "Key", name: "Name", description: "Description", module: "Module", category: "Category", is_global: "Global",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At"
};

/* -------------------- Role Permission -------------------- */
export const FIELD_LABELS_ROLE_PERMISSION = {
  id: "ID", role_id: "Role", permission_id: "Permission", organization_id: "Organization", facility_id: "Facility",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At"
};

/* -------------------- User Facility -------------------- */
export const FIELD_LABELS_USER_FACILITY = {
  id: "ID", user_id: "User",  organization_id: "Organization", facility_id: "Facility", role_id: "Role",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Department -------------------- */
export const FIELD_LABELS_DEPARTMENT = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  head_of_department_id: "Head of Department",
  name: "Name", code: "Code",
  status: `Status (${joinValues(DEPARTMENT_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Employee -------------------- */
export const FIELD_LABELS_EMPLOYEE = {
  id: "ID", organization_id: "Organization", facility_id: "Facility", department_id: "Department",
  first_name: "First Name", middle_name: "Middle Name", last_name: "Last Name", // ✅ added
  gender: "Gender", dob: "Date of Birth", phone: "Phone", email: "Email", address: "Address",
  employee_no: "Employee No", position: "Position", status: "Status",
  license_no: "License No", specialty: "Specialty", certifications: "Certifications",   emergency_contact_name: "Emergency Contact Name",
  emergency_contact_phone: "Emergency Contact Phone",
  hire_date: "Hire Date", termination_date: "Termination Date",
  emergency_contacts: "Emergency Contacts",
  photo_path: "Profile Photo", resume_url: "Resume (CV)", document_url: "Supporting Document",
  user_id: "Linked User", // ✅ added for user link
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Feature Module -------------------- */
export const FIELD_LABELS_FEATURE_MODULE = {
  id:"ID",name:"Module Name",key:"Key",icon:"Icon",category:"Category",
  description:"Description",tags:"Tags",visibility:"Visibility",enabled:"Enabled",
  tenant_scope:"Tenant Scope",
  status:`Status (${joinValues(FEATURE_MODULE_STATUS)})`,
  order_index:"Order Index",
  route:"Route",parent_id:"Parent Module",
  show_on_dashboard:"Show on Dashboard",
  dashboard_type:"Dashboard Type",
  dashboard_order:"Dashboard Order",
  created_by_id:"Created By",updated_by_id:"Updated By",deleted_by_id:"Deleted By",
  created_at:"Created At",updated_at:"Updated At",deleted_at:"Deleted At"
};


/* -------------------- Feature Access -------------------- */
export const FIELD_LABELS_FEATURE_ACCESS = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  module_id: "Module", role_id: "Role",
  status: `Status (${joinValues(FEATURE_ACCESS_STATUS)})`,
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At"
};

/* -------------------- Patient -------------------- */
export const FIELD_LABELS_PATIENT = {
  id: "ID", pat_no: "Patient No",
  first_name: "First Name", middle_name: "Middle Name", last_name: "Last Name",
  date_of_birth: "Date of Birth", gender: `Gender (${joinValues(GENDER_TYPES)})`,
  phone_number: "Phone Number", email_address: "Email Address", home_address: "Home Address",
  marital_status: "Marital Status", religion: "Religion", profession: "Profession",
  emergency_contacts: "Emergency Contacts",
  registration_status: `Registration Status (${joinValues(REGISTRATION_LOG_STATUS)})`,
  source_of_registration: `Source of Registration (${joinValues(REGISTRATION_METHODS)})`,
  notes: "Notes", qr_code_path: "QR Code", photo_path: "Photo",
  organization_id: "Organization", facility_id: "Facility", employee_id: "Registered By",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Vital -------------------- */
export const FIELD_LABELS_VITAL = {
  id: "ID", patient_id: "Patient", registration_log_id: "Registration Log", admission_id: "Admission", consultation_id: "Consultation", nurse_id: "Nurse", triage_record_id: "Triage Record",
  organization_id: "Organization", facility_id: "Facility",
  status: `Status (${joinValues(VITAL_STATUS)})`,
  bp: "Blood Pressure", pulse: "Pulse", rr: "Respiration Rate", temp: "Temperature",
  oxygen: "Oxygen Saturation", weight: "Weight", height: "Height", rbg: "Random Blood Glucose",
  pain_score: "Pain Score", position: "Position", recorded_at: "Recorded At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Consultation Staff -------------------- */
export const FIELD_LABELS_CONSULTATION_STAFF = {
  id: "ID", consultation_id: "Consultation", employee_id: "Employee",
  organization_id: "Organization", facility_id: "Facility",
  role: `Role (${joinValues(CONSULTATION_STAFF_ROLES)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};



/* -------------------- Facility Branding -------------------- */
export const FIELD_LABELS_FACILITY_BRANDING = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  status: `Status (${joinValues(THEME_STATUS)})`,
  theme: "Theme", logo_url: "Logo", logo_print_url: "Print Logo", favicon_url: "Favicon",
  default_letterhead_id: "Default Letterhead", contact: "Contact Info", meta: "Meta Data",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Organization Branding -------------------- */
export const FIELD_LABELS_ORGANIZATION_BRANDING = {
  id: "ID",
  organization_id: "Organization",

  status: `Status (${joinValues(THEME_STATUS)})`,

  theme: "Theme",
  logo_url: "Logo",
  logo_print_url: "Print Logo",
  favicon_url: "Favicon",

  company_name: "Company Name",
  tagline: "Tagline",

  letterhead_header: "Letterhead Header",
  letterhead_footer: "Letterhead Footer",
  default_letterhead_id: "Default Letterhead",

  contact: "Contact Info",
  social_links: "Social Links",

  email_from_name: "Email From Name",
  email_footer: "Email Footer",

  currency: "Currency",
  locale: "Locale",
  timezone: "Timezone",

  ui_settings: "UI Settings",

  meta: "Meta Data",

  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  created_by_id: "Created By",
  updated_by_id: "Updated By",
  deleted_by_id: "Deleted By",
};

/* -------------------- Letterhead Template -------------------- */
export const FIELD_LABELS_LETTERHEAD_TEMPLATE = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  name: "Template Name", status: `Status (${joinValues(LETTERHEAD_STATUS)})`,
  header_html: "Header HTML", footer_html: "Footer HTML",
  logo_url: "Logo", watermark_url: "Watermark", pdf_options: "PDF Options",
  version: "Version", effective_from: "Effective From", effective_to: "Effective To", meta: "Meta Data",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Plan -------------------- */
export const FIELD_LABELS_PLAN = {
  id: "ID", name: "Plan Name", description: "Description", price: "Price",
  status: `Status (${joinValues(PLAN_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};
/* -------------------- Organization Plan -------------------- */
export const FIELD_LABELS_ORGANIZATION_PLAN = {
  id: "ID",
  organization_id: "Organization",
  plan_id: "Plan",
  start_date: "Start Date",
  end_date: "End Date",
  status: "Status"
};

/* -------------------- Stock Request -------------------- */
export const FIELD_LABELS_STOCK_REQUEST = {
  id: "ID", organization_id: "Organization", facility_id: "Facility", department_id: "Department",
  reference_number: "Reference Number", status: `Status (${joinValues(STOCK_REQUEST_STATUS)})`,
  notes: "Notes", rejection_reason: "Rejection Reason", issue_notes: "Issue Notes", fulfillment_notes: "Fulfillment Notes",
  approved_by_id: "Approved By", approved_at: "Approved At",
  rejected_by_id: "Rejected By", rejected_at: "Rejected At",
  issued_by_id: "Issued By", issued_at: "Issued At",
  fulfilled_by_id: "Fulfilled By", fulfilled_at: "Fulfilled At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Stock Request Item -------------------- */
export const FIELD_LABELS_STOCK_REQUEST_ITEM = {
  id: "ID", stock_request_id: "Stock Request", master_item_id: "Item", organization_id: "Organization", facility_id: "Facility", central_stock_id: "Central Stock",
  quantity: "Requested Quantity", issued_quantity: "Issued Quantity", fulfilled_quantity: "Fulfilled Quantity",
  status: `Status (${joinValues(STOCK_REQUEST_ITEM_STATUS)})`,
  remarks: "Remarks", fulfillment_notes: "Fulfillment Notes", rejection_reason: "Rejection Reason",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Supplier -------------------- */
export const FIELD_LABELS_SUPPLIER = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  name: "Supplier Name",
  contact_name: "Contact Name",
  contact_email: "Contact Email",
  contact_phone: "Contact Phone",
  address: "Address",
  status: `Status (${joinValues(SUPPLIER_STATUS)})`,
  notes: "Notes",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Master Item -------------------- */
export const FIELD_LABELS_MASTER_ITEM = {
  id: "ID", organization_id: "Organization", facility_id: "Facility", feature_module_id: "Feature Module",
  name: "Item Name", code: "Code", description: "Description",
  item_type: `Type (${joinValues(MASTER_ITEM_TYPES)})`,
  category_id: "Category", department_id: "Department",
  generic_group: "Generic Group", strength: "Strength",
  dosage_form: "Dosage Form", unit: "Unit",
  reorder_level: "Reorder Level", is_controlled: "Controlled Substance",
  sample_required: "Sample Required", test_method: "Test Method",
  reference_price: "Reference Price", currency: "Currency",
  status: `Status (${joinValues(MASTER_ITEM_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};
/* -------------------- Billable Item -------------------- */
export const FIELD_LABELS_BILLABLE_ITEM = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  master_item_id: "Master Item", department_id: "Department",

  name: "Item Name", category_id: "Category", description: "Description",

  // 🔥 NEW
  item_type: "Item Type", billing_mode: `Billing Mode (${joinValues(BILLING_MODE)})`,

  price: "Price", currency: "Currency",

  taxable: "Taxable", discountable: "Discountable", override_allowed: "Allow Override",

  // 🔥 NEW
  is_active: "Active",

  status: `Status (${joinValues(BILLABLE_ITEM_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};
/* -------------------- Billable Item Price -------------------- */
export const FIELD_LABELS_BILLABLE_ITEM_PRICE = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  billable_item_id: "Billable Item",

  payer_type: "Payer Type", currency: "Currency",
  price: "Price",

  is_default: "Default",

  effective_from: "Effective From", effective_to: "Effective To",

  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Billable Item Price History -------------------- */
export const FIELD_LABELS_BILLABLE_ITEM_PRICE_HISTORY = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  billable_item_id: "Billable Item",

  // 🔥 CONTEXT
  payer_type: "Payer Type", currency: "Currency",

  old_price: "Old Price", new_price: "New Price",

  // 🔥 NEW
  change_type: "Change Type",

  effective_date: "Effective Date",
  created_at: "Created At", created_by_id: "Created By"
};




/* -------------------- Invoice Item -------------------- */
export const FIELD_LABELS_INVOICE_ITEM = {
  id: "ID", invoice_id: "Invoice", billable_item_id: "Billable Item",
  organization_id: "Organization", facility_id: "Facility",
  description: "Description", unit_price: "Unit Price", quantity: "Quantity",
  discount: "Discount", tax: "Tax", total_price: "Total Price",
   total: "Total", note: "Note",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Consultation -------------------- */
export const FIELD_LABELS_CONSULTATION = {
  id: "ID", appointment_id: "Appointment", registration_log_id: "Registration Log",
  recommendation_id: "Recommendation", parent_consultation_id: "Parent Consultation",
  patient_id: "Patient", doctor_id: "Doctor", department_id: "Department",
  invoice_id: "Invoice", consultation_type_id: "Consultation Type",
  organization_id: "Organization", facility_id: "Facility",
  consultation_date: "Consultation Date", diagnosis: "Diagnosis",
  consultation_notes: "Consultation Notes", prescribed_medications: "Prescribed Medications",
  status: `Status (${joinValues(CONSULTATION_STATUS)})`,
  finalized_by_id: "Finalized By", verified_by_id: "Verified By",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Deposit -------------------- */
export const FIELD_LABELS_DEPOSIT = {deposit_number: "Deposit No",
  id: "ID", patient_id: "Patient", organization_id: "Organization", facility_id: "Facility",
  applied_invoice_id: "Invoice", amount: "Amount", applied_amount: "Applied Amount",
  remaining_balance: "Remaining Balance", unapplied_amount: "Unapplied Amount",
  method: `Payment Method (${joinValues(PAYMENT_METHODS)})`, transaction_ref: "Transaction Ref",
  status: `Status (${joinValues(DEPOSIT_STATUS)})`, notes: "Notes", reason: "Reason",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Financial Ledger -------------------- */
export const FIELD_LABELS_FINANCIAL_LEDGER = {
  id: "ID",
  organization_id: "Organization",
  facility_id: "Facility",  invoice_id: "Invoice",  patient_id: "Patient",
  payment_id: "Payment",  refund_id: "Refund",  deposit_id: "Deposit",
  discount_waiver_id: "Discount Waiver",  transaction_type: `Transaction Type (${["credit","debit"].join(", ")})`,
  amount: "Amount",  method: `Payment Method (${joinValues(PAYMENT_METHODS)})`,
  status: `Status (${joinValues(LEDGER_STATUS)})`,  note: "Note",
  created_by_id: "Created By",  created_at: "Created At"
};

/* -------------------- Refund -------------------- */
export const FIELD_LABELS_REFUND = {refund_number: "Refund No",
  id: "ID", patient_id: "Patient", invoice_id: "Invoice", deposit_id: "Deposit", payment_id: "Payment",
  organization_id: "Organization", facility_id: "Facility",
  amount: "Amount", method: "Payment Method", currency: "Currency",
  reason: "Reason", note: "Note", status: "Status",
  approved_by_id: "Approved By", approved_at: "Approved At",
  rejected_by_id: "Rejected By", rejected_at: "Rejected At",
  processed_by_id: "Processed By", processed_at: "Processed At",
  cancelled_by_id: "Cancelled By", cancelled_at: "Cancelled At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By",
  actions: "Actions"
};

/* -------------------- Refund Deposit -------------------- */
export const FIELD_LABELS_REFUND_DEPOSIT = {refund_deposit_number: "Refund Deposit No",
  id: "ID", deposit_id: "Deposit", patient_id: "Patient",
  organization_id: "Organization", facility_id: "Facility",
  refund_amount: "Refund Amount", method: "Method", reason: "Reason",
  status: "Status",
  reviewed_by_id: "Reviewed By", reviewed_at: "Reviewed At",
  approved_by_id: "Approved By", approved_at: "Approved At",
  processed_by_id: "Processed By", processed_at: "Processed At",
  voided_by_id: "Voided By", voided_at: "Voided At",
  restored_by_id: "Restored By", restored_at: "Restored At",
  created_by_id: "Created By", created_at: "Created At",
  updated_at: "Updated At", deleted_at: "Deleted At",
  actions: "Actions"
};

/* -------------------- Refund Transaction -------------------- */
export const FIELD_LABELS_REFUND_TRANSACTION = {
  id: "ID", refund_id: "Refund", patient_id: "Patient", invoice_id: "Invoice",
  organization_id: "Organization", facility_id: "Facility",
  amount: "Amount", reason: "Reason", status: "Status",
  approved_by_id: "Approved By", approved_at: "Approved At",
  rejected_by_id: "Rejected By", rejected_at: "Rejected At", reject_reason: "Reject Reason",
  processed_by_id: "Processed By", processed_at: "Processed At",
  cancelled_by_id: "Cancelled By", cancelled_at: "Cancelled At",
  reversed_by_id: "Reversed By", reversed_at: "Reversed At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By",
  actions: "Actions"
};

/* -------------------- Registration Log -------------------- */
export const FIELD_LABELS_REGISTRATION_LOG = {
  id: "ID",
  patient_id: "Patient",
  registrar_id: "Registrar",
  organization_id: "Organization",
  facility_id: "Facility",
  invoice_id: "Invoice",
  registration_type_id: "Registration Type",

  // 🔥 NEW
  payer_type: `Payer Type (${joinValues(PAYER_TYPES)})`,
  patient_insurance_id: "Patient Insurance",

  registration_method: `Registration Method (${joinValues(REGISTRATION_METHODS)})`,
  registration_source: "Registration Source",
  patient_category: `Patient Category (${joinValues(REGISTRATION_CATEGORIES)})`,
  visit_reason: "Visit Reason",
  is_emergency: "Emergency",
  registration_time: "Registration Time",
  notes: "Notes",
  log_status: `Log Status (${joinValues(REGISTRATION_LOG_STATUS)})`,

  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",
  created_by_id: "Created By",
  updated_by_id: "Updated By",
  deleted_by_id: "Deleted By"
};

/* -------------------- Plan Module -------------------- */
export const FIELD_LABELS_PLAN_MODULE = {
  id: "ID", plan_id: "Plan", module_id: "Module",
  enabled: "Enabled",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Central Stock -------------------- */
export const FIELD_LABELS_CENTRAL_STOCK = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  master_item_id: "Master Item", supplier_id: "Supplier", department_id: "Department",
  quantity: "Quantity", unit: "Unit",
  cost_price: "Cost Price", selling_price: "Selling Price",
  expiry_date: "Expiry Date", batch_no: "Batch No",
  status: `Status (${joinValues(CENTRAL_STOCK_STATUS)})`,
  notes: "Notes",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};
/* -------------------- Employee Shift -------------------- */
export const FIELD_LABELS_EMPLOYEE_SHIFT = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  employee_id: "Employee",
  day_of_week: "Day of Week",
  shift_start_time: "Shift Start Time",
  shift_end_time: "Shift End Time",
  status: `Status (${joinValues(EMPLOYEE_SHIFT_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Master Item Category -------------------- */
export const FIELD_LABELS_MASTER_ITEM_CATEGORY = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  name: "Category Name", code: "Code", description: "Description",
  status: `Status (${joinValues(MASTER_ITEM_CATEGORY_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};


/* -------------------- Stock Adjustment -------------------- */
export const FIELD_LABELS_STOCK_ADJUSTMENT = {
  id: "ID", central_stock_id: "Central Stock", organization_id: "Organization", facility_id: "Facility",
  adjustment_type: `Adjustment Type (${joinValues(ADJUSTMENT_TYPES)})`,
  quantity: "Quantity", reason: "Reason",
  status: `Status (${joinValues(STOCK_ADJUSTMENT_STATUS)})`,
  approved_by_id: "Approved By", approved_at: "Approved At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Appointment -------------------- */
export const FIELD_LABELS_APPOINTMENT = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  appointment_code: "Appointment Code",
  patient_id: "Patient", doctor_id: "Doctor", department_id: "Department", invoice_id: "Invoice",
  date_time: "Date & Time",
  status: `Status (${joinValues(APPOINTMENT_STATUS)})`,
  notes: "Notes",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};


/* -------------------- Lab Request -------------------- */
export const FIELD_LABELS_LAB_REQUEST = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", doctor_id: "Doctor", department_id: "Department", registration_log_id: "Registration Log", 
  consultation_id: "Consultation", lab_test_id: "Lab Test", invoice_id: "Invoice",
  request_date: "Request Date",
  status: `Status (${joinValues(LAB_REQUEST_STATUS)})`,
  notes: "Notes", is_emergency: "Emergency", billed: "Billed",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Lab Request Item -------------------- */
export const FIELD_LABELS_LAB_REQUEST_ITEM = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  lab_request_id: "Lab Request", lab_test_id: "Lab Test / Billable Item",
  invoice_item_id: "Invoice Item",
  status: `Status (${joinValues(LAB_REQUEST_ITEM_STATUS)})`,
  notes: "Notes", billed: "Billed (System)",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Prescription -------------------- */
export const FIELD_LABELS_PRESCRIPTION = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  consultation_id: "Consultation", registration_log_id: "Registration Log",
  patient_id: "Patient", doctor_id: "Doctor", department_id: "Department",
  invoice_id: "Invoice", prescription_date: "Prescription Date",
  is_emergency: "Emergency", notes: "Notes",
  status: `Status (${joinValues(PRESCRIPTION_STATUS)})`,
  issued_at: "Issued At", dispensed_at: "Dispensed At", completed_at: "Completed At",
  fulfilled_by_id: "Fulfilled By",   // ✅ renamed (was fulfilled_by)
  fulfilled_at: "Fulfilled At",
  billed: "Billed",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};


/* -------------------- Prescription Item -------------------- */
export const FIELD_LABELS_PRESCRIPTION_ITEM = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  prescription_id: "Prescription", medication_id: "Medication",
  billable_item_id: "Billable Item", invoice_item_id: "Invoice Item",
  patient_id: "Patient", dosage: "Dosage", route: "Route", duration: "Duration",
  quantity: "Quantity", instructions: "Instructions",
  refill_allowed: "Refill Allowed", refill_count: "Refill Count",
  status: `Status (${joinValues(PRESCRIPTION_ITEM_STATUS)})`,
  dispensed_qty: "Dispensed Quantity",   // ✅ new
  dispensed_at: "Dispensed At", cancelled_at: "Cancelled At",
  billed: "Billed",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Lab Supply -------------------- */
export const FIELD_LABELS_LAB_SUPPLY = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  name: "Supply Name", unit: "Unit", quantity: "Quantity", reorder_level: "Reorder Level",
  status: `Status (${joinValues(LAB_SUPPLY_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};


/* -------------------- Surgery -------------------- */
export const FIELD_LABELS_SURGERY = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", consultation_id: "Consultation", surgeon_id: "Surgeon",
  department_id: "Department", billable_item_id: "Billable Item", invoice_id: "Invoice",
  scheduled_date: "Scheduled Date", surgery_type: "Surgery Type",
  duration_minutes: "Duration (Minutes)", anesthesia_type: "Anesthesia Type",
  complications: "Complications", notes: "Notes", cost_override: "Cost Override", document_url: "Document",
  is_emergency: "Emergency",
  status: `Status (${joinValues(SURGERY_STATUS)})`,
  finalized_at: "Finalized At", finalized_by_id: "Finalized By",
  verified_by_id: "Verified By", verified_at: "Verified At",
  voided_by_id: "Voided By", voided_at: "Voided At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Bed -------------------- */
export const FIELD_LABELS_BED = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  room_number: "Room Number", bed_number: "Bed Number", department_id: "Department",
  status: `Status (${joinValues(BED_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};
/* -------------------- Login Audit -------------------- */
export const FIELD_LABELS_LOGIN_AUDIT = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  user_id: "User", login_time: "Login Time", logout_time: "Logout Time",
  ip_address: "IP Address", device_info: "Device Info", user_agent: "User Agent",
  status: `Status (${joinValues(LOGIN_AUDIT_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Access Violation Log -------------------- */
export const FIELD_LABELS_ACCESS_VIOLATION_LOG = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  user_id: "User", action: "Action", reason: "Reason",
  status: `Status (${joinValues(ACCESS_VIOLATION_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Delivery Record -------------------- */
export const FIELD_LABELS_DELIVERY_RECORD = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", consultation_id: "Consultation", doctor_id: "Doctor", midwife_id: "Midwife",
  department_id: "Department", billable_item_id: "Billable Item", invoice_id: "Invoice",
  delivery_date: "Delivery Date", delivery_type: "Delivery Type",
  baby_count: "Baby Count", delivery_mode: "Delivery Mode",
  birth_weight: "Birth Weight", birth_length: "Birth Length",
  newborn_weight: "Newborn Weight", newborn_gender: "Newborn Gender",
  apgar_score: "Apgar Score", complications: "Complications", notes: "Notes",
  is_emergency: "Emergency",
  status: `Status (${joinValues(DELIVERY_STATUS)})`,
  finalized_at: "Finalized At", finalized_by_id: "Finalized By",
  verified_by_id: "Verified By", verified_at: "Verified At",
  voided_by_id: "Voided By", voided_at: "Voided At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Maternity Visit -------------------- */
export const FIELD_LABELS_MATERNITY_VISIT = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", doctor_id: "Doctor", midwife_id: "Midwife",
  department_id: "Department", consultation_id: "Consultation",
  registration_log_id: "Registration Log",
  billable_item_id: "Billable Item", invoice_id: "Invoice",

  visit_date: "Visit Date", visit_type: "Visit Type",

  lnmp: "LNMP", expected_due_date: "Expected Due Date", estimated_gestational_age: "Gestational Age",
  fundus_height: "Fundus Height", fetal_heart_rate: "Fetal Heart Rate",
  presentation: "Presentation", position: "Position", complaint: "Complaint",
  gravida: "Gravida", para: "Para", abortion: "Abortion", living: "Living",
  visit_notes: "Visit Notes",

  blood_pressure: "Blood Pressure", weight: "Weight", height: "Height",
  temperature: "Temperature", pulse_rate: "Pulse Rate",

  is_emergency: "Emergency",
  status: `Status (${joinValues(MATERNITY_VISIT_STATUS)})`,

  finalized_at: "Finalized At", finalized_by_id: "Finalized By",
  verified_at: "Verified At", verified_by_id: "Verified By",
  cancel_reason: "Cancel Reason", cancelled_by_id: "Cancelled By",   // ✅ added
  void_reason: "Void Reason", voided_by_id: "Voided By",             // ✅ added

  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Pharmacy Transaction -------------------- */
export const FIELD_LABELS_PHARMACY_TRANSACTION = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", prescription_id: "Prescription", prescription_item_id: "Prescription Item",
  registration_log_id: "Registration Log",
  consultation_id: "Consultation", department_id: "Department",
  doctor_id: "Doctor", invoice_item_id: "Invoice Item", department_stock_id: "Department Stock",
  quantity_dispensed: "Quantity Dispensed", type: "Type",
  status: `Status (${joinValues(PHARMACY_TRANSACTION_STATUS)})`,
  is_emergency: "Emergency", notes: "Notes",
  fulfilled_by_id: "Fulfilled By", fulfillment_date: "Fulfillment Date",
  void_reason: "Void Reason", voided_by_id: "Voided By", voided_at: "Voided At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Department Stock -------------------- */
export const FIELD_LABELS_DEPARTMENT_STOCK = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  department_id: "Department", master_item_id: "Master Item",
  central_stock_id: "Central Stock",
  batch_no: "Batch No", expiry_date: "Expiry Date",   // ✅ newly added
  quantity: "Quantity", min_threshold: "Min Threshold", max_threshold: "Max Threshold",
  status: `Status (${joinValues(DEPARTMENT_STOCK_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};


/* -------------------- System Audit Log -------------------- */
export const FIELD_LABELS_SYSTEM_AUDIT_LOG = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  table_name: "Table Name", record_id: "Record ID", action: "Action", changes: "Changes",
  status: `Status (${joinValues(SYSTEM_AUDIT_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};
/* -------------------- Patient Insurance -------------------- */
export const FIELD_LABELS_PATIENT_INSURANCE = {
  id: "ID",
  organization_id: "Organization",
  facility_id: "Facility",

  patient_id: "Patient",
  provider_id: "Insurance Provider",

  policy_number: "Policy Number",
  plan_name: "Plan Name",

  coverage_limit: "Coverage Limit",
  currency: "Currency",

  valid_from: "Valid From",
  valid_to: "Valid To",

  is_primary: "Primary Insurance",

  notes: "Notes",

  status: `Status (${joinValues(PATIENT_INSURANCE_STATUS)})`,

  created_at: "Created At",
  updated_at: "Updated At",
  deleted_at: "Deleted At",

  created_by_id: "Created By",
  updated_by_id: "Updated By",
  deleted_by_id: "Deleted By",
};
/* -------------------- Insurance Claim -------------------- */
export const FIELD_LABELS_INSURANCE_CLAIM = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  invoice_id: "Invoice", patient_id: "Patient", provider_id: "Provider",
  claim_number: "Claim Number", currency: "Currency",
  amount_claimed: "Amount Claimed",
  amount_approved: "Amount Approved",
  amount_paid: "Amount Paid",
  payment_reference: "Payment Reference",
  claim_date: "Claim Date", response_date: "Response Date",
  reviewed_at: "Reviewed At", approved_at: "Approved At",
  paid_at: "Paid At",
  rejection_reason: "Rejection Reason",
  notes: "Notes",
  status: `Status (${joinValues(INSURANCE_CLAIM_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At",
  deleted_at: "Deleted At",
  created_by_id: "Created By",
  updated_by_id: "Updated By",
  deleted_by_id: "Deleted By"
};
/* -------------------- Newborn Record -------------------- */
export const FIELD_LABELS_NEWBORN_RECORD = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  mother_id: "Mother", delivery_record_id: "Delivery Record",
  gender: `Gender (${joinValues(GENDER_TYPES)})`,
  birth_weight: "Birth Weight", birth_length: "Birth Length",
  head_circumference: "Head Circumference",
  apgar_score_1min: "Apgar Score (1 Min)", apgar_score_5min: "Apgar Score (5 Min)",
  measurement_notes: "Measurement Notes",
  complications: "Complications", notes: "Notes",

  // 🚼 Lifecycle
  status: `Status (${joinValues(NEWBORN_STATUS)})`,
  death_reason: "Death Reason", death_time: "Death Time",
  transfer_reason: "Transfer Reason", transfer_facility_id: "Transfer Facility", transfer_time: "Transfer Time",
  void_reason: "Void Reason", voided_by_id: "Voided By", voided_at: "Voided At",

  // 🕵🏽 Audit
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Procedure Record -------------------- */
export const FIELD_LABELS_PROCEDURE_RECORD = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", consultation_id: "Consultation", performer_id: "Performer",
  department_id: "Department", billable_item_id: "Billable Item", invoice_id: "Invoice",
  procedure_date: "Procedure Date", procedure_type: "Procedure Type", description: "Description",
  duration_minutes: "Duration (Minutes)", notes: "Notes", cost_override: "Cost Override",
  is_emergency: "Emergency",
  status: `Status (${joinValues(PROCEDURE_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Room -------------------- */
export const FIELD_LABELS_ROOM = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  ward_id: "Ward", room_number: "Room Number", description: "Description",
  status: `Status (${joinValues(ROOM_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};
/* -------------------- Medical Record -------------------- */
export const FIELD_LABELS_MEDICAL_RECORD = {
  id: "ID", consultation_id: "Consultation", patient_id: "Patient", doctor_id: "Doctor",
  registration_log_id: "Registration Log", invoice_id: "Invoice", recorded_at: "Recorded At", 
  organization_id: "Organization", facility_id: "Facility",
  status: `Status (${joinValues(MEDICAL_RECORD_STATUS)})`, is_emergency: "Emergency",
  report_path: "Report Path",
  cc: "Chief Complaint", hpi: "History of Present Illness", pmh: "Past Medical History",
  fh_sh: "Family/Social History", nut_hx: "Nutrition History", imm_hx: "Immunization History",
  obs_hx: "Obstetric History", gyn_hx: "Gynecological History",
  pe: "Physical Exam", resp_ex: "Respiratory Exam", cv_ex: "Cardiovascular Exam",
  abd_ex: "Abdominal Exam", pel_ex: "Pelvic Exam", ext: "Extremities", neuro_ex: "Neurological Exam",
  ddx: "Differential Diagnosis", dx: "Diagnosis", lab_inv: "Lab Investigations",
  img_inv: "Imaging Investigations", tx_mx: "Treatment/Management", summary_pg: "Summary/Progress",
  reviewed_at: "Reviewed At", reviewed_by_id: "Reviewed By",
  finalized_at: "Finalized At", finalized_by_id: "Finalized By",
  verified_at: "Verified At", verified_by_id: "Verified By",
  voided_at: "Voided At", voided_by_id: "Voided By", void_reason: "Void Reason",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};


/* -------------------- Nursing Note -------------------- */
export const FIELD_LABELS_NURSING_NOTE = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", admission_id: "Admission", nurse_id: "Nurse",
  consultation_id: "Consultation", department_id: "Department",
  note_date: "Note Date", shift: "Shift",
  subjective: "Subjective", objective: "Objective",
  assessment: "Assessment", plan: "Plan", handover_notes: "Handover Notes",
  status: `Status (${joinValues(NURSING_NOTE_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Discount -------------------- */
export const FIELD_LABELS_DISCOUNT = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  invoice_id: "Invoice", invoice_item_id: "Invoice Item",
  discount_policy_id: "Discount Policy", name: "Name", code: "Code", reason: "Reason",
  type: `Type (${joinValues(DISCOUNT_TYPE)})`, value: "Value",
  status: `Status (${joinValues(DISCOUNT_STATUS)})`,
  void_reason: "Void Reason", voided_by_id: "Voided By", voided_at: "Voided At",
  finalized_by_id: "Finalized By", finalized_at: "Finalized At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Discount Waiver -------------------- */
export const FIELD_LABELS_DISCOUNT_WAIVER = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  invoice_id: "Invoice", patient_id: "Patient",
  type: `Type (${joinValues(DISCOUNT_TYPE)})`, reason: "Reason",
  percentage: "Percentage", amount: "Amount", applied_total: "Applied Total",
  status: `Status (${joinValues(DISCOUNT_WAIVER_STATUS)})`,
  approved_by_employee_id: "Approved By Employee",
  approved_by_id: "Approved By User", approved_at: "Approved At",
  rejected_by_id: "Rejected By", rejected_at: "Rejected At",
  voided_by_id: "Voided By", voided_at: "Voided At", void_reason: "Void Reason",
  finalized_by_id: "Finalized By", finalized_at: "Finalized At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Discount Policy -------------------- */
export const FIELD_LABELS_DISCOUNT_POLICY = {
  id: "ID", code: "Policy Code", name: "Policy Name",
  description: "Description",
  discount_type: `Discount Type (${joinValues(DISCOUNT_TYPE)})`,
  discount_value: "Discount Value",
  applies_to: `Applies To (${joinValues(POLICY_APPLIES_TO)})`,
  condition_json: "Conditions",
  effective_from: "Effective From", effective_to: "Effective To",
  status: `Status (${joinValues(POLICY_STATUS)})`,
  organization_id: "Organization", facility_id: "Facility",
  activated_by_id: "Activated By", activated_at: "Activated At",
  deactivated_by_id: "Deactivated By", deactivated_at: "Deactivated At",
  expired_by_id: "Expired By", expired_at: "Expired At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};


/* -------------------- Insurance PreAuthorization -------------------- */
export const FIELD_LABELS_INSURANCE_PREAUTHORIZATION = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", provider_id: "Provider", billable_item_id: "Service Item",
  invoice_id: "Invoice", consultation_id: "Consultation",
  preauth_number: "PreAuth Number", request_date: "Request Date", response_date: "Response Date",
  amount_requested: "Amount Requested", amount_approved: "Amount Approved", validity_date: "Validity Date",
  notes: "Notes", rejection_reason: "Rejection Reason",
  status: `Status (${joinValues(INSURANCE_PREAUTH_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Lab Result -------------------- */
export const FIELD_LABELS_LAB_RESULT = {
  id: "ID", organization_id: "Organization", facility_id: "Facility", patient_id: "Patient",
  lab_request_id: "Lab Request", lab_request_item_id: "Lab Request Item", registration_log_id: "Registration Log", 
  department_id: "Department", billable_item_id: "Billable Item",
  doctor_id: "Doctor", consultation_id: "Consultation",
  result: "Result", notes: "Notes", doctor_notes: "Doctor Notes", result_date: "Result Date", attachment_url: "Attachment",
  status: `Status (${joinValues(LAB_RESULT_STATUS)})`,
  reviewed_at: "Reviewed At", verified_at: "Verified At",
  entered_by_id: "Entered By", reviewed_by_id: "Reviewed By", verified_by_id: "Verified By",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Radiology Record -------------------- */
export const FIELD_LABELS_RADIOLOGY_RECORD = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", consultation_id: "Consultation", department_id: "Department",
  billable_item_id: "Billable Item", invoice_id: "Invoice",
  radiologist_id: "Radiologist", verified_by_id: "Verified By",
  study_type: "Study Type", study_date: "Study Date", body_part: "Body Part", modality: "Modality",
  findings: "Findings", impression: "Impression", file_path: "File Path",
  status: `Status (${joinValues(RADIOLOGY_STATUS)})`,
  verified_at: "Verified At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Invoice -------------------- */
export const FIELD_LABELS_INVOICE = {
  id: "ID", patient_id: "Patient", organization_id: "Organization", facility_id: "Facility",
  invoice_number: "Invoice Number",
  status: `Status (${joinValues(INVOICE_STATUS)})`,
  currency: "Currency", due_date: "Due Date", is_locked: "Locked",
  subtotal: "Subtotal", total: "Total", total_paid: "Total Paid", balance: "Balance", refunded_amount: "Refunded Amount",
  total_discount: "Total Discount", total_tax: "Total Tax",
  payer_type: `Payer Type (${joinValues(PAYER_TYPES)})`,
  insurance_provider_id: "Insurance Provider", coverage_amount: "Coverage Amount", notes: "Notes",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Insurance Provider -------------------- */
export const FIELD_LABELS_INSURANCE_PROVIDER = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  name: "Provider Name", contact_info: "Contact Info",
  status: `Status (${joinValues(INSURANCE_PROVIDER_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Recommendation -------------------- */
export const FIELD_LABELS_RECOMMENDATION = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", doctor_id: "Doctor", department_id: "Department", consultation_id: "Consultation",
  recommendation_date: "Recommendation Date", reason: "Reason",
  status: `Status (${joinValues(RECOMMENDATION_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};
/* -------------------- Message Attachment -------------------- */
export const FIELD_LABELS_MESSAGE_ATTACHMENT = {
  id: "ID", message_id: "Message",
  file_name: "File Name", file_type: "File Type", file_size: "File Size", file_path: "File Path",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by: "Created By", updated_by: "Updated By", deleted_by: "Deleted By"
};

/* -------------------- Triage Record -------------------- */
export const FIELD_LABELS_TRIAGE_RECORD = {
  id: "ID", patient_id: "Patient", doctor_id: "Doctor", nurse_id: "Nurse",
  consultation_id: "Consultation", registration_log_id: "Registration Log", invoice_id: "Invoice",
  triage_type_id: "Triage Type",
  organization_id: "Organization", facility_id: "Facility",
  triage_status: `Status (${joinValues(TRIAGE_STATUS)})`,
  symptoms: "Symptoms", triage_notes: "Notes",
  bp: "Blood Pressure", pulse: "Pulse", rr: "Respiratory Rate", temp: "Temperature",
  oxygen: "Oxygen Saturation", weight: "Weight", height: "Height", rbg: "Random Blood Glucose",
  pain_score: "Pain Score", position: "Position",
  recorded_at: "Recorded At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Payment -------------------- */
export const FIELD_LABELS_PAYMENT = {payment_number: "Payment No",
  id: "ID", invoice_id: "Invoice", patient_id: "Patient",
  organization_id: "Organization", facility_id: "Facility",
  amount: "Amount",
  method: `Method (${joinValues(PAYMENT_METHODS)})`,
  status: `Status (${joinValues(PAYMENT_STATUS)})`,
  transaction_ref: "Transaction Ref", is_deposit: "Deposit",   reason: "Reason", 
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Ward -------------------- */
export const FIELD_LABELS_WARD = {
  id: "ID", organization_id: "Organization", facility_id: "Facility", department_id: "Department",
  name: "Ward Name", description: "Description",
  status: `Status (${joinValues(WARD_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Admission -------------------- */
export const FIELD_LABELS_ADMISSION = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", admitting_doctor_id: "Admitting Doctor", discharging_doctor_id: "Discharging Doctor",
  department_id: "Department", consultation_id: "Consultation", billable_item_id: "Billable Item",
  invoice_id: "Invoice", insurance_id: "Insurance Provider",
  admit_date: "Admit Date", discharge_date: "Discharge Date",
  status: `Status (${joinValues(ADMISSION_STATUS)})`,
  admission_type: `Admission Type (${joinValues(ADMISSION_TYPE)})`,
  is_emergency: "Emergency",
  admit_reason: "Admit Reason", referral_source: "Referral Source", notes: "Notes",
  bed_number: "Bed Number", discharge_summary: "Discharge Summary",
  cost_override: "Cost Override", document_url: "Document",
  finalized_at: "Finalized At", finalized_by_id: "Finalized By",
  verified_at: "Verified At", verified_by_id: "Verified By",
  voided_at: "Voided At", voided_by_id: "Voided By",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Currency Rate -------------------- */
export const FIELD_LABELS_CURRENCY_RATE = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  from_currency: "From Currency", to_currency: "To Currency",
  rate: "Rate", effective_date: "Effective Date",
  status: `Status (${joinValues(CURRENCY_RATE_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Auto Billing Rule -------------------- */
export const FIELD_LABELS_AUTO_BILLING_RULE = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  trigger_feature_module: "Feature Module", trigger_module: "Trigger Module",
  billable_item_id: "Billable Item", auto_generate: "Auto Generate",
  charge_mode: `Charge Mode (${joinValues(AUTO_BILLING_CHARGE_MODE)})`,
  default_price: "Default Price",
  status: `Status (${joinValues(AUTO_BILLING_RULE_STATUS)})`,
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Billing Trigger -------------------- */
export const FIELD_LABELS_BILLING_TRIGGER = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  module_key: "Module", trigger_status: "Trigger Status",
  is_active: "Enabled",
  created_at: "Created At", updated_at: "Updated At",
  created_by_id: "Created By", updated_by_id: "Updated By"
};

/* -------------------- Message -------------------- */
export const FIELD_LABELS_MESSAGE = {
  id: "ID", conversation_id: "Conversation",
  sender_id: "Sender", sender_role: "Sender Role",
  receiver_id: "Receiver", receiver_role: "Receiver Role",
  content: "Content", message_type: "Message Type", chat_type: "Chat Type",
  is_read: "Read", read_at: "Read At",
  deleted_by_sender: "Deleted By Sender", deleted_by_receiver: "Deleted By Receiver",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by: "Created By", updated_by: "Updated By", deleted_by: "Deleted By"
};
/* -------------------- Conversation -------------------- */
export const FIELD_LABELS_CONVERSATION = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", employee_id: "Employee",
  topic: "Topic",
  conversation_type: "Conversation Type",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by: "Created By", updated_by: "Updated By", deleted_by: "Deleted By"
};

/* -------------------- EKG Record -------------------- */
export const FIELD_LABELS_EKG_RECORD = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", consultation_id: "Consultation", registration_log_id: "Registration Log",
  billable_item_id: "Billable Item", invoice_id: "Invoice", technician_id: "Technician",
  heart_rate: "Heart Rate (bpm)", pr_interval: "PR Interval (ms)", qrs_duration: "QRS Duration (ms)",
  qt_interval: "QT Interval (ms)", axis: "Axis", rhythm: "Rhythm",
  interpretation: "Interpretation", recommendation: "Recommendation", note: "Notes",
  recorded_date: "Recorded Date", file_path: "File Path", source: "Source",
  is_emergency: "Emergency Case", status: "Status",
  verified_by_id: "Verified By", verified_at: "Verified At",
  finalized_by_id: "Finalized By", finalized_at: "Finalized At",
  voided_by_id: "Voided By", voided_at: "Voided At",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Ultrasound Record -------------------- */
export const FIELD_LABELS_ULTRASOUND_RECORD = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", consultation_id: "Consultation", maternity_visit_id: "Maternity Visit",
  registration_log_id: "Registration Log", department_id: "Department",
  billable_item_id: "Billable Item", invoice_id: "Invoice", technician_id: "Technician",
  scan_type: "Scan Type", scan_date: "Scan Date", scan_location: "Scan Location",
  ultra_findings: "Findings", note: "Notes", number_of_fetus: "Number of Fetuses",
  biparietal_diameter: "Biparietal Diameter (mm)", presentation: "Presentation",
  lie: "Lie", position: "Position", amniotic_volume: "Amniotic Volume (cm³)",
  fetal_heart_rate: "Fetal Heart Rate (bpm)", gender: "Gender",
  previous_cesarean: "Previous Cesarean", prev_ces_date: "Previous Cesarean Date",
  prev_ces_location: "Previous Cesarean Location", cesarean_date: "Cesarean Date",
  indication: "Indication", next_of_kin: "Next of Kin",
  is_emergency: "Emergency Case", status: "Status",
  verified_by_id: "Verified By", verified_at: "Verified At",
  finalized_by_id: "Finalized By", finalized_at: "Finalized At",
  cancelled_by_id: "Cancelled By", cancelled_at: "Cancelled At",
  voided_by_id: "Voided By", voided_at: "Voided At", void_reason: "Void Reason",
  source: "Source", file_path: "File Path",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By",
  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At"
};



/* ============================================================
   🩺 Patient Chart Module – Compact Field Labels
============================================================ */

/* -------------------- Patient Chart Cache -------------------- */
export const FIELD_LABELS_PATIENT_CHART_CACHE = {
  id: "ID", patient_id: "Patient", organization_id: "Organization", facility_id: "Facility", status: "Status",
  chart_snapshot: "Chart Snapshot", generated_at: "Generated At", revalidated_by_id: "Revalidated By", revalidated_at: "Revalidated At",
  created_by_id: "Created By", created_at: "Created At", updated_by_id: "Updated By", updated_at: "Updated At",
  deleted_by_id: "Deleted By", deleted_at: "Deleted At"
};

/* -------------------- Patient Chart Note -------------------- */
export const FIELD_LABELS_PATIENT_CHART_NOTE = {
  id: "ID", patient_id: "Patient", organization_id: "Organization", facility_id: "Facility", author_id: "Author",
  note_type: "Note Type", status: "Status", content: "Content", reviewed_by_id: "Reviewed By", reviewed_at: "Reviewed At",
  verified_by_id: "Verified By", verified_at: "Verified At", created_by_id: "Created By", created_at: "Created At",
  updated_by_id: "Updated By", updated_at: "Updated At", deleted_by_id: "Deleted By", deleted_at: "Deleted At"
};

/* -------------------- Patient Chart View Log -------------------- */
export const FIELD_LABELS_PATIENT_CHART_VIEW_LOG = {
  id: "ID", patient_id: "Patient", user_id: "User", organization_id: "Organization", facility_id: "Facility",
  action: "Action", viewed_at: "Viewed At", ip_address: "IP Address", user_agent: "User Agent",
  reviewed_by_id: "Reviewed By", reviewed_at: "Reviewed At", verified_by_id: "Verified By", verified_at: "Verified At",
  created_by_id: "Created By", created_at: "Created At", updated_by_id: "Updated By", updated_at: "Updated At",
  deleted_by_id: "Deleted By", deleted_at: "Deleted At"
};

/* -------------------- Order -------------------- */
export const FIELD_LABELS_ORDER = {
  id: "ID", organization_id: "Organization", facility_id: "Facility",
  patient_id: "Patient", provider_id: "Provider", consultation_id: "Consultation",

  type: `Type (${joinValues(ORDER_TYPE)})`,
  priority: `Priority (${joinValues(ORDER_PRIORITY)})`,

  invoice_id: "Invoice",
  billing_status: `Billing Status (${joinValues(ORDER_BILLING_STATUS)})`,
  fulfillment_status: `Fulfillment Status (${joinValues(ORDER_FULFILLMENT_STATUS)})`,

  order_date: "Order Date",

  status: `Status (${joinValues(ORDER_STATUS)})`,
  status_changed_at: "Status Changed At", status_changed_by_id: "Status Changed By",

  notes: "Notes",

  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};

/* -------------------- Order Item -------------------- */
export const FIELD_LABELS_ORDER_ITEM = {
  id: "ID", order_id: "Order", billable_item_id: "Billable Item", invoice_item_id: "Invoice Item",

  organization_id: "Organization", facility_id: "Facility",

  quantity: "Quantity", unit_price: "Unit Price", total_price: "Total Price",

  dosage: "Dosage", frequency: "Frequency", duration: "Duration", instructions: "Instructions",

  status: `Status (${joinValues(ORDER_ITEM_STATUS)})`,
  billing_status: `Billing Status (${joinValues(ORDER_BILLING_STATUS)})`,

  notes: "Notes",

  created_at: "Created At", updated_at: "Updated At", deleted_at: "Deleted At",
  created_by_id: "Created By", updated_by_id: "Updated By", deleted_by_id: "Deleted By"
};