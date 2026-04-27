/* ========================================================================
   📚 Dashboard Constants (Full Enterprise Match)
   ======================================================================== */

// 🔹 Base URL
export const BASE_PATH =
  (document.querySelector("base") &&
    document.querySelector("base").getAttribute("href")) || "/";

// 🔹 Default assets
export const DEFAULT_USER_AVATAR = "/assets/images/default-user.png";
export const DASHBOARD_THEME_CSS = "/assets/css/dashboard-theme.css";

// =======================================================================
// 🎨 COLOR MAP – one unified source matching all backend modules
// =======================================================================
export const KPI_COLOR_MAP = {
  appointments: "primary",
  lab_requests: "warning",
  prescriptions: "success",
  admissions: "info",
  payments: "danger",
  consultations: "indigo",
  deliveries: "teal",
  deposits: "purple",
  discounts: "orange",
  discount_waivers: "pink",
  ultrasound_records: "cyan",
  ekg_records: "rose",
  maternity_visits: "fuchsia",
  surgeries: "red",
  central_stocks: "slate",
  department_stocks: "gray",
  billable_items: "amber",
  employees: "blue",
  facilities: "green",
  departments: "indigo",
  lab_results: "lime",
  invoices: "violet",
  pharmacy_transactions: "emerald",
  registration_logs: "gray",
  default: "secondary",
};

export const KPI_LABEL_OVERRIDES = {
  payments: "Collected Payments",
  revenue: "Total Revenue",
  deposits: "Deposits Held",
};

// =======================================================================
// 🧩 ICON MAP – standardized icons (RemixIcon-based)
// =======================================================================
export const KPI_ICON_MAP = {
  appointments: "ri-calendar-check-line",
  lab_requests: "ri-flask-line",
  prescriptions: "ri-capsule-line",
  admissions: "ri-hospital-line",
  payments: "ri-bank-card-line",
  consultations: "ri-user-heart-line",
  deliveries: "ri-truck-line",
  deposits: "ri-hand-coin-line",
  discounts: "ri-price-tag-3-line",
  discount_waivers: "ri-refund-2-line",
  ultrasound_records: "ri-heart-pulse-line",
  ekg_records: "ri-pulse-line",
  maternity_visits: "ri-women-line",
  surgeries: "ri-scissors-line",
  central_stocks: "ri-archive-stack-line",
  department_stocks: "ri-box-3-line",
  billable_items: "ri-bill-line",
  employees: "ri-user-2-line",
  facilities: "ri-building-4-line",
  departments: "ri-team-line",
  lab_results: "ri-flask-fill",
  invoices: "ri-file-list-3-line",
  pharmacy_transactions: "ri-capsule-fill",
  registration_logs: "ri-clipboard-line",
  default: "ri-activity-line",
};

// =======================================================================
// 🏷️ Label Formatter
// =======================================================================
export function formatKeyLabel(key) {
  if (KPI_LABEL_OVERRIDES[key]) {
    return KPI_LABEL_OVERRIDES[key];
  }

  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bOf\b/g, "of")
    .replace(/\bAnd\b/g, "and");
}

// =======================================================================
// 🏷️ Badge Style Helper
// =======================================================================
export function getBadgeStyle(val, color) {
  const base = "badge border me-1 mb-1 rounded-pill px-2 py-1 fw-semibold";
  if (val === 0) return `${base} border-light text-muted`;
  if (val <= 5) return `${base} border-${color} text-${color}`;
  return `${base} border-${color} bg-${color}-subtle text-${color}`;
}
