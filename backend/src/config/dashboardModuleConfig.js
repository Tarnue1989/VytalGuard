// Central dashboard scoping + behavior config

export const DASHBOARD_MODULE_CONFIG = {
  // 🌍 GLOBAL (Super Admin only)
  organizations: { scope: "global" },
  roles: { scope: "global" },
  feature_modules: { scope: "global" },

  // 🏢 ORG-LEVEL (Org Admin SHOULD see these)
  users: { scope: "org" },
  feature_accesses: { scope: "org" },
  facilities: { scope: "org" },              // ✅ FIX
  departments: { scope: "org" },             // ✅ FIX
  employees: { scope: "org" },               // ✅ FIX
  suppliers: { scope: "org" },               // ✅ FIX
  master_items: { scope: "org" },             // ✅ FIX
  master_item_categories: { scope: "org" },   // ✅ FIX

  // 🏥 FACILITY (Clinical / Operations)
  appointments: { scope: "facility" },
  patients: { scope: "facility" },
  lab_requests: { scope: "facility" },
  lab_results: { scope: "facility" },
  consultations: { scope: "facility" },
  prescriptions: { scope: "facility" },
  admissions: { scope: "facility" },
  maternity_visits: { scope: "facility" },
  ultrasound_records: { scope: "facility" },
  ekg_records: { scope: "facility" },
  surgeries: { scope: "facility" },
  vitals: { scope: "facility" },
  registration_logs: { scope: "facility" },

  // 💳 BILLING (Facility-bound)
  payments: { scope: "facility" },
  invoices: { scope: "facility" },
  deposits: { scope: "facility" },
  refunds: { scope: "facility" },
  discount_waivers: { scope: "facility" },
  auto_billing_rules: { scope: "facility" },
  billable_items: { scope: "facility" },

  // 🧱 INVENTORY
  central_stocks: { scope: "facility" },
  department_stocks: { scope: "facility" },
  stock_adjustments: { scope: "facility" },
  stock_returns: { scope: "facility" },
  stock_requests: { scope: "facility" },
  pharmacy_transactions: { scope: "facility" },

  // 🔒 IMMUTABLE
  stock_ledger: { scope: "facility", softDelete: false },

  // 🚫 NOT A KPI SOURCE
  finance: { skip: true },
};
