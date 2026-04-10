/* ============================================================
   💰 BILLABLE ITEM FORM RULES (ENTERPRISE MASTER PARITY)
   ------------------------------------------------------------
   🔹 Converted from: LAB_REQUEST_FORM_RULES
   🔹 BillableItem Controller–faithful
   🔹 Rule-driven (validateUsingRules)
   🔹 Role-aware scope enforcement
   🔹 Multi-price (prices[]) support
============================================================ */

export const BILLABLE_ITEM_FORM_RULES = [
  // ================= Identity =================
  {
    id: "masterItemSearch",
    message: "Master item is required",
  },
  {
    id: "master_item_id",
    message: "Master item is required",
  },

  // ================= Core Fields =================
  {
    id: "name",
    message: "Item name is required",
  },

  {
    id: "code",
    message: "Code is required",
    when: () => false, // optional per controller
  },

  {
    id: "description",
    message: "Description is required",
    when: () => false,
  },

  {
    id: "category_id",
    message: "Category is required",
    when: () => false, // optional in controller
  },

  {
    id: "department_id",
    message: "Department is required",
    when: () => false,
  },

  // ================= Pricing =================
  // ⚠️ IMPORTANT:
  // prices[] (multi-price) validated at submit-time
  {
    id: "pricePillsContainer",
    message: "At least one price is required",
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

  // ================= Flags =================
  {
    id: "taxable",
    message: "Taxable flag is required",
    when: () => false,
  },

  {
    id: "discountable",
    message: "Discountable flag is required",
    when: () => false,
  },

  {
    id: "override_allowed",
    message: "Override flag is required",
    when: () => false,
  },
];