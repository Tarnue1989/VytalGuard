// ============================================================================
// 🧩 Report Constants – Enterprise HMS Standard
// Shared across report-main.js, report-render.js, dashboard widgets, etc.
// ============================================================================

/* ============================================================
   🎨 COLORS (Aligns with VytalGuard HMS Palette)
============================================================ */
export const REPORT_COLORS = {
  primary: "#1976d2", // Blue
  secondary: "#26a69a", // Teal
  info: "#42a5f5", // Light Blue
  success: "#43a047", // Green
  warning: "#f9a825", // Amber
  danger: "#e53935", // Red
  muted: "#9e9e9e", // Grey
  gridLine: "rgba(0,0,0,0.05)",
};

/* ============================================================
   📊 DEFAULT CHART CONFIGURATION
============================================================ */
export const REPORT_CHART_CONFIG = {
  defaultType: "line",
  lineOptions: {
    borderWidth: 2,
    tension: 0.3,
    fill: false,
    pointRadius: 3,
  },
  barOptions: {
    borderWidth: 1,
    backgroundColor: REPORT_COLORS.primary,
  },
};

/* ============================================================
   🧠 MODEL DISPLAY MAP
   Friendly labels for modelType dropdowns or summaries
============================================================ */
export const REPORT_MODEL_LABELS = {
  registration: "Registration Log",
  patient: "Patient",
  consultation: "Consultation",
  triage: "Triage Record",
  vital: "Vital Record",
  admission: "Admission",
  delivery: "Delivery Record",
  ultrasound: "Ultrasound Record",
  ekg: "EKG Record",
  appointment: "Appointment",
  lab_request: "Lab Request",
  lab_request_item: "Lab Test",
  prescription: "Prescription",
  prescription_item: "Dispensed Drug",
  billable_item: "Billable Item",
  invoice: "Invoice",
  invoice_item: "Invoice Item",
  deposit: "Deposit",
  payment: "Payment",
  refund: "Refund",
  refund_transaction: "Refund Transaction",
  discount: "Discount",
  discount_waiver: "Discount Waiver",
};

/* ============================================================
   ⚙️ DEFAULT GROUP / FILTER OPTIONS
============================================================ */
export const REPORT_GROUP_FIELDS = [
  { value: "status", label: "Status" },
  { value: "gender", label: "Gender" },
  { value: "department_id", label: "Department" },
  { value: "doctor_id", label: "Doctor" },
  { value: "method", label: "Payment Method" },
  { value: "category_id", label: "Category" },
  { value: "facility_id", label: "Facility" },
];

export const REPORT_DATE_RANGES = [
  { value: "", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "month_to_date", label: "Month-to-Date" },
  { value: "year_to_date", label: "Year-to-Date" },
];

export const REPORT_AGGREGATE_BY = [
  { value: "", label: "None" },
  { value: "day", label: "By Day" },
  { value: "month", label: "By Month" },
  { value: "year", label: "By Year" },
];

/* ============================================================
   📦 SUMMARY CARD TEMPLATES
============================================================ */
export const REPORT_SUMMARY_CARD_MAP = {
  total_count: {
    label: "Total Records",
    icon: "fa-list",
    color: REPORT_COLORS.primary,
  },
  sum_total: {
    label: "Total Amount",
    icon: "fa-dollar-sign",
    color: REPORT_COLORS.success,
  },
  sum_balance: {
    label: "Outstanding Balance",
    icon: "fa-money-bill-wave",
    color: REPORT_COLORS.warning,
  },
  sum_amount: {
    label: "Total Payments",
    icon: "fa-coins",
    color: REPORT_COLORS.info,
  },
  avg_value: {
    label: "Average Value",
    icon: "fa-chart-line",
    color: REPORT_COLORS.secondary,
  },
};

/* ============================================================
   🧭 FIELD LABELS (for dynamic table headers)
============================================================ */
export const FIELD_LABELS_REPORT = {
  status: "Status",
  gender: "Gender",
  department_id: "Department",
  doctor_id: "Doctor",
  method: "Payment Method",
  organization_id: "Organization",
  facility_id: "Facility",
  category_id: "Category",
  created_at: "Created Date",
  updated_at: "Updated Date",
  sum_total: "Total Amount",
  sum_balance: "Outstanding Balance",
  sum_amount: "Total Payments",
  avg_value: "Average Value",
  total_count: "Record Count",
};

/* ============================================================
   🧭 Utility: Resolve Label/Color for Summary Card
============================================================ */
export function getSummaryCardConfig(key) {
  const cfg = REPORT_SUMMARY_CARD_MAP[key];
  return (
    cfg || {
      label: key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: "fa-database",
      color: REPORT_COLORS.muted,
    }
  );
}
