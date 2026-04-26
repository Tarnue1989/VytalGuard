// =============================================
// Currency Rate Form Rules (Compact)
// =============================================

export const CURRENCY_RATE_FORM_RULES = [
  { id: "from_currency", message: "From Currency is required" },
  { id: "to_currency", message: "To Currency is required" },

  { id: "rate", message: "Exchange Rate is required" },

  {
    id: "effective_date",
    message: "Effective Date is required",
    when: () => true,
  },

  {
    id: "status",
    message: "Status is required",
    when: () => true,
  },

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
    when: () => false,
  },
];