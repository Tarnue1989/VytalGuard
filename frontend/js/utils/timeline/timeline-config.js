// 📁 frontend/js/utils/timeline/timeline-config.js

export const TIMELINE_FLOWS = {
  // =========================================================
  // 💰 FINANCE / BILLING
  // =========================================================
  invoice: ["draft", "issued", "unpaid", "partial", "paid"],

  payment: ["pending", "completed", "verified"],

  deposit: ["pending", "cleared", "applied"],

  refund: ["pending", "approved", "processed"],

  refund_deposits: ["pending", "review", "approved", "processed"],

  discount_waiver: ["pending", "approved", "applied", "finalized"],

  discount: ["draft", "active", "finalized"],

  expense: ["draft", "pending", "approved", "posted"],

  payroll: ["draft", "pending", "approved", "paid"],

  // =========================================================
  // 🏥 INSURANCE
  // =========================================================
  insurance_claim: [
    "draft",
    "submitted",
    "in_review",
    "approved",
    "processing_payment",
    "paid"
  ],

  insurance_preauth: ["pending", "approved"],

  patient_insurance: ["active"],

  // =========================================================
  // 🧾 ADMIN / VISIT / ENCOUNTER
  // =========================================================
  registration_log: ["draft", "pending", "active", "completed"],

  consultation: ["open", "in_progress", "completed", "verified"],

  triage: ["open", "in_progress", "completed", "verified"],

  vital: ["open", "in_progress", "completed", "verified"],

  medical_record: ["draft", "reviewed", "finalized", "verified"],

  appointment: ["scheduled", "in_progress", "completed", "verified"],

  admission: ["admitted", "in_progress", "discharged"],

  // =========================================================
  // 🧪 LAB / DIAGNOSTICS / CLINICAL
  // =========================================================
  lab_request: ["draft", "pending", "in_progress", "completed", "verified"],

  lab_result: [
    "draft",
    "pending",
    "in_progress",
    "completed",
    "reviewed",
    "verified"
  ],

  lab_request_item: ["draft", "pending", "in_progress", "completed", "verified"],

  radiology: ["pending", "in_progress", "completed", "verified"],

  ultrasound_record: ["pending", "in_progress", "completed", "verified", "finalized"],

  ekg_record: ["pending", "in_progress", "completed", "verified", "finalized"],

  procedure: ["scheduled", "in_progress", "completed"],

  surgery: ["scheduled", "in_progress", "completed", "verified", "finalized"],

  delivery_record: ["scheduled", "in_progress", "completed", "verified"],

  maternity_visit: ["scheduled", "in_progress", "completed", "verified"],

  // =========================================================
  // 💊 PHARMACY / PRESCRIPTION
  // =========================================================
  prescription: ["draft", "issued", "dispensed", "completed", "verified"],

  prescription_item: ["draft", "issued", "partially_dispensed", "dispensed"],

  pharmacy_transaction: ["pending", "partially_dispensed", "dispensed", "verified"],

  // =========================================================
  // 📦 ORDERS / STOCK
  // =========================================================
  order: ["draft", "pending", "approved", "in_progress", "completed", "verified", "finalized"],

  order_item: ["draft", "pending", "approved", "in_progress", "completed", "verified"],

  stock_request: ["draft", "pending", "approved", "issued", "partially_fulfilled", "fulfilled"],

  stock_request_item: ["pending", "approved", "issued", "partially_fulfilled", "fulfilled"],

  stock_adjustment: ["draft", "pending", "approved"],

  stock_return: ["pending", "approved"],

  // =========================================================
  // 🧍 SIMPLE STATUS MODULES
  // =========================================================
  patient: ["active"],

  employee: ["active", "on_leave", "inactive"],

  user: ["active", "inactive", "suspended"],

  facility: ["active"],

  organization: ["active"],

  department: ["active"],

  ward: ["active"],

  room: ["active"],

  supplier: ["active"],

  insurance_provider: ["active"],

  billable_item: ["active"],

  auto_billing_rule: ["active"],

  feature_module: ["active"],

  feature_access: ["active"],

  user_facility: ["active"],

  plan: ["active"],

  org_plan: ["active", "expired"],

  plan_module: ["active"],

  central_stock: ["active", "expired", "quarantined"],

  department_stock: ["active"],

  currency_rate: ["active", "expired"],

  master_item: ["active"],

  master_item_category: ["active"],

  letterhead: ["active"],

  letterhead_template: ["active"],

  theme: ["active"],

  home_content: ["active"],

  video: ["active"],

  link: ["active"],

  employee_shift: ["active"],

  // =========================================================
  // 📢 CONTENT / COMMUNICATION
  // =========================================================
  announcement: ["draft", "published"],

  notification: ["unread", "read"],

  conversation: [],

  message: [],

  // =========================================================
  // 📄 AUDIT / SYSTEM
  // =========================================================
  access_violation: ["logged", "investigating", "resolved"],

  system_audit: ["logged", "reviewed", "archived"],

  password_history: ["active"],

  patientchart_cache: ["active", "stale", "invalid"],

  patientcharts: ["active", "stale", "invalid"],

  patientchart_view_logs: ["logged", "reviewed", "verified"],

  // =========================================================
  // 💳 SUBSCRIPTION
  // =========================================================
  subscription: ["trialing", "active", "past_due"],

  subscription_invoice: ["unpaid", "past_due", "paid"],

  // =========================================================
  // 💵 LEDGER / ACCOUNTING
  // =========================================================
  ledger: ["pending", "posted"],

  ledger_entry: ["pending", "posted"],

  refund_transaction: ["pending", "approved", "processed"],

  deposit_refund: ["pending", "review", "approved", "processed"],

  refund_deposit_transaction: ["created", "processed"],
};

export const TERMINAL_STATES = [
  "cancelled",
  "voided",
  "reversed",
  "rejected",
  "failed",
  "deleted",
  "inactive",
  "terminated",
  "no_show",
  "dismissed",
  "archived",
  "canceled"
];

export const TIMELINE_LABELS = {
  in_progress: "In Progress",
  partially_approved: "Partially Approved",
  processing_payment: "Processing Payment",
  partially_dispensed: "Partially Dispensed",
  partially_fulfilled: "Partially Fulfilled",
  on_leave: "On Leave",
  no_show: "No Show",
};

export function getTimelineFlow(moduleName) {
  return TIMELINE_FLOWS[moduleName] || [];
}

export function isTerminalState(status) {
  return TERMINAL_STATES.includes(String(status || "").toLowerCase());
}

export function getTimelineLabel(step) {
  const value = String(step || "").toLowerCase();
  if (TIMELINE_LABELS[value]) return TIMELINE_LABELS[value];

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}