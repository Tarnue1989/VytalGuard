export const DASHBOARD_KPI_PERMISSIONS = {
  /* ===========================
     🩺 CLINICAL
  ============================ */
  patients: "patients:view",
  employees: "employees:view",
  consultations: "consultations:view",
  admissions: "admissions:view",
  triage_records: "triage_records:view",
  medical_records: "medical_records:view",
  vitals: "vitals:view",
  recommendations: "recommendations:view",
  deliveries: "deliveries:view",
  maternity_visits: "maternity_visits:view",
  ekg_records: "ekg_records:view",
  ultrasound_records: "ultrasound_records:view",
  newborn_records: "newborn_records:view",

  /* ===========================
     🧪 LAB
  ============================ */
  lab_requests: "lab_requests:view",
  lab_results: "lab_results:view",

  /* ===========================
     💊 PHARMACY
  ============================ */
  pharmacy_transactions: "pharmacy_transactions:view",

  /* ===========================
     💳 BILLING / FINANCE
  ============================ */
  invoices: "invoices:view",
  payments: "payments:view",
  refunds: "refunds:view",
  deposits: "deposits:view",
  discount_waivers: "discount_waivers:view",
  billable_items: "billable_items:view",
  auto_billing_rules: "auto_billing_rules:view",

  /* ===========================
     🏢 ADMIN / SYSTEM
  ============================ */
  departments: "departments:view",
  facilities: "facilities:view",
  organizations: "organizations:view",
  users: "users:view",
  roles: "roles:view",
  suppliers: "suppliers:view",

  /* ===========================
     📦 INVENTORY
  ============================ */
  central_stocks: "central_stocks:view",
  department_stocks: "department_stocks:view",
  stock_adjustments: "stock_adjustments:view",
  stock_requests: "stock_requests:view",
  stock_returns: "stock_returns:view",
  stock_ledger: "stock_ledger:view",

  /* ===========================
     ⚙️ FEATURE SYSTEM
     (usually admin-only)
  ============================ */
  feature_modules: "feature_modules:view",
  feature_accesses: "feature_accesses:view",
};
