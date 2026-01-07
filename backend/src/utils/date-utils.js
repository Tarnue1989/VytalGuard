// 📁 date-utils.js – Enterprise Date Normalization Utilities
// ============================================================
// 🧭 SINGLE SOURCE OF TRUTH for DATE / DATEONLY handling
// 🔹 Prevents JS Date → timestamp drift
// 🔹 Safe for Sequelize DATEONLY + Postgres DATE
// 🔹 Reusable across all controllers & services
// ============================================================

/**
 * Normalize any date-like input into YYYY-MM-DD (DATEONLY safe)
 * @param {string|Date|null|undefined} value
 * @returns {string|null}
 */
export function normalizeDateOnly(value) {
  if (!value) return null;

  // Already YYYY-MM-DD
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return null;

  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * Normalize multiple DATEONLY fields at once
 * @param {object} obj
 * @param {string[]} fields
 */
export function normalizeDateOnlyFields(obj, fields = []) {
  if (!obj || typeof obj !== "object") return;

  fields.forEach((f) => {
    if (f in obj) {
      obj[f] = normalizeDateOnly(obj[f]);
    }
  });
}
