/* ============================================================
   📊 SUMMARY FORMAT UTILITIES (Enterprise-Safe)
   ------------------------------------------------------------
   PURPOSE:
   - Convert summary objects into human-readable text
   - Reusable across ALL modules (appointments, patients, billing)
   - UI-safe (no [object Object])
============================================================ */

/**
 * Formats a summary object into a readable string
 * Example:
 *   { Female: 2, Male: 1 } → "Female: 2 | Male: 1"
 */
export function formatSummaryObject(obj, options = {}) {
  if (!obj || typeof obj !== "object") return "—";

  const {
    separator = " | ",
    emptyValue = "—",
    transformKey = (k) => k,
  } = options;

  const entries = Object.entries(obj).filter(
    ([, value]) => value !== null && value !== undefined
  );

  if (!entries.length) return emptyValue;

  return entries
    .map(([key, value]) => `${transformKey(key)}: ${value}`)
    .join(separator);
}
