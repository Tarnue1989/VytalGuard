/* =============================================
   Cash Closing Form Rules (MASTER PARITY)
   Aligned with CashClosing Controller + UI
============================================= */

export const CASH_CLOSING_FORM_RULES = [
  /* ================= Core ================= */

  {
    id: "date", // ✅ FIXED (was dateInput)
    message: "Closing date is required",
  },

  {
    id: "accountSelect",
    message: "Account is required",
  },

  /* ================= Scope ================= */

  // Organization → Superadmin only
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  // Facility → required for everyone except super without org context
  {
    id: "facilitySelect",
    message: "Facility is required",
    when: () => {
      const role = (localStorage.getItem("userRole") || "").toLowerCase();
      if (role.includes("super")) return false;
      return true;
    },
  },

  /* ================= Optional (Future Safe) ================= */

  // 🔹 Notes (if you later add)
  {
    id: "notes",
    message: "Notes are required",
    when: () => false, // not required now (keeps parity structure)
  },
];