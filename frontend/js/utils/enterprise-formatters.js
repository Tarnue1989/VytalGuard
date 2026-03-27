// utils/enterprise-formatters.js
// ============================================================
// 🔥 ENTERPRISE FORMATTERS (GLOBAL STANDARD)
// ============================================================

export function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

export function safeText(value) {
  if (value === null || value === undefined) return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function safeNumber(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

export function logAction(module, action, payload = {}) {
  console.debug(`[${module}] ${action}`, payload);
}