/* =============================================
   Discount Form Rules (Controller-aligned)
   ENTERPRISE MASTER PARITY
============================================= */

export const DISCOUNT_FORM_RULES = [
  // ================= Identity =================
  {
    id: "invoiceInput",
    message: "Invoice is required",
  },
  {
    id: "invoiceId",
    message: "Invoice is required",
  },

  // ================= Discount Details =================
  {
    id: "typeSelect",
    message: "Discount type is required",
  },
  {
    id: "value",
    message: "Discount value is required",
  },
  {
    id: "reason",
    message: "Reason is required",
  },

  // ================= Invoice Item (optional) =================
  {
    id: "invoiceItemId",
    message: "Invoice item selection is invalid",
    when: () => false, // optional – whole invoice allowed
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
