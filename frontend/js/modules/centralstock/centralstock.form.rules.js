/* =============================================
   Central Stock Form Rules (Controller-aligned)
   🔹 FULL PARITY WITH BILLABLE_ITEM_FORM_RULES
   🔹 Rule-driven, role-aware, controller-safe
============================================= */

export const CENTRAL_STOCK_FORM_RULES = [
  /* ============================
     Identity
  ============================ */

  // Item (search input)
  { id: "itemSearch", message: "Item is required" },

  // Resolved item ID (set by suggestion selection)
  {
    id: "master_item_id",
    message: "Item selection is required",
  },

  // Supplier
  { id: "supplierSelect", message: "Supplier is required" },

  /* ============================
     Quantity & Dates
  ============================ */

  // Quantity
  { id: "quantity", message: "Quantity is required" },

  // Received Date
  { id: "receivedDate", message: "Received date is required" },

  // Expiry Date (optional – controller tolerant)
  {
    id: "expiryDate",
    message: "Expiry date is required",
    when: () => false,
  },

  /* ============================
     Batch / Notes (optional)
  ============================ */

  {
    id: "batchNumber",
    message: "Batch number is required",
    when: () => false,
  },

  {
    id: "notes",
    message: "Notes are required",
    when: () => false,
  },

  /* ============================
     Status
  ============================ */

  {
    id: "status",
    message: "Stock status is required",
    when: () => true,
  },

  /* ============================
     Organization (superadmin only)
  ============================ */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* ============================
     Facility (facility-scoped users only)
  ============================ */
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
