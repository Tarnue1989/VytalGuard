// =============================================
// Billable Item Form Rules (Controller-aligned - FINAL MULTI-PRICE)
// =============================================

export const BILLABLE_ITEM_FORM_RULES = [
  /* ================= IDENTITY ================= */
  { id: "masterItemSearch", message: "Master Item is required" },
  { id: "master_item_id", message: "Master Item selection is required" },

  // Auto-filled (no validation needed)
  { id: "name", message: "Billable item name is required", when: () => false },
  { id: "code", message: "Billable item code is required", when: () => false },
  { id: "description", message: "Description is required", when: () => false },

  /* ================= CATEGORY ================= */
  { id: "category_id", message: "Category is required", when: () => false },

  /* ============================================================
     🔥 PRICING (MULTI-PRICE MODE)
     ❌ Removed single fields: payer_type, price, currency
     ✅ Validation handled dynamically in JS (price rows)
  ============================================================ */

  /* ================= FLAGS ================= */
  { id: "taxable", message: "Taxable flag is required", when: () => false },
  { id: "discountable", message: "Discountable flag is required", when: () => false },
  { id: "overrideAllowed", message: "Override permission is required", when: () => false },

  /* ================= STATUS ================= */
  {
    id: "status",
    message: "Billable item status is required",
    when: () => true,
  },

  /* ================= ORGANIZATION ================= */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* ================= FACILITY ================= */
  {
    id: "facilitySelect",
    message: "Facility is required",
    when: () => {
      const role = (localStorage.getItem("userRole") || "").toLowerCase();

      if (role.includes("super")) return true;
      if (role.includes("org")) return true;

      return true;
    },
  },
];