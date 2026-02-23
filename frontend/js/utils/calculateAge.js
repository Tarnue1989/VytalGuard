// 📁 utils/calculateAge.js
// ============================================================
// 🧮 Patient Age Calculator (DERIVED — NEVER STORED)
// ------------------------------------------------------------
// • Frontend-safe
// • Timezone-safe
// • Reusable across cards, tables, summaries
// • Returns display-ready value (e.g. "4 yrs")
// ============================================================

export function calculateAge(dob) {
  if (!dob) return "—";

  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "—";

  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age >= 0 ? `${age} yrs` : "—";
}
