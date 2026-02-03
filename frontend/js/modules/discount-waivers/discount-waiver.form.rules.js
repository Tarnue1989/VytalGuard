/* =============================================
   Discount Waiver Form Rules (Controller-aligned)
   ENTERPRISE MASTER PARITY
============================================= */

export const DISCOUNT_WAIVER_FORM_RULES = [
  // ================= Identity =================
  {
    id: "invoiceInput",
    message: "Invoice is required",
  },
  {
    id: "invoiceId",
    message: "Invoice is required",
  },

  // ================= Waiver Type =================
  {
    id: "typeSelect",
    message: "Waiver type is required",
  },

  // ================= Percentage / Amount =================
  {
    id: "percentage",
    message: "Percentage is required",
    when: () => document.getElementById("typeSelect")?.value === "percentage",
  },
  {
    id: "amount",
    message: "Amount is required",
    when: () => document.getElementById("typeSelect")?.value === "fixed",
  },

  // ================= Business Safety =================
  {
    id: "percentage",
    message: "Percentage must be between 0 and 100",
    when: () => {
      const type = document.getElementById("typeSelect")?.value;
      const val = parseFloat(document.getElementById("percentage")?.value);
      return type === "percentage" && (isNaN(val) || val <= 0 || val > 100);
    },
  },
  {
    id: "amount",
    message: "Amount must be greater than zero",
    when: () => {
      const type = document.getElementById("typeSelect")?.value;
      const val = parseFloat(document.getElementById("amount")?.value);
      return type === "fixed" && (isNaN(val) || val <= 0);
    },
  },

  // ================= Reason =================
  {
    id: "reason",
    message: "Reason is required",
  },

  // ================= Scope =================
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },
  {
    id: "facilitySelect",
    message: "Facility is required",
    when: () => {
      const role = (localStorage.getItem("userRole") || "").toLowerCase();
      if (role.includes("super")) return false;
      if (role.includes("org")) return false;
      return true;
    },
  },
];
