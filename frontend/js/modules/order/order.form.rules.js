/* ============================================================
   📦 ORDER FORM RULES (ENTERPRISE MASTER PARITY)
   ------------------------------------------------------------
   🔹 Lab Request → Order Adaptation
   🔹 Controller-faithful (no HTML validation)
   🔹 Rule-driven (validateUsingRules)
   🔹 Role-aware scope enforcement
============================================================ */

export const ORDER_FORM_RULES = [
  // ================= Identity =================
  {
    id: "patientSearch",
    message: "Patient is required",
  },
  {
    id: "patientId",
    message: "Patient is required",
  },

  // ================= Core Context =================
  {
    id: "departmentSelect",
    message: "Department is required",
    when: () => false,
  },

  {
    id: "providerSearch",
    message: "Provider is required",
    when: () => false,
  },
  {
    id: "providerId",
    message: "Provider is required",
    when: () => false,
  },

  {
    id: "consultationSearch",
    message: "Consultation is required",
    when: () => false,
  },

  {
    id: "registrationLogSearch",
    message: "Registration log is required",
    when: () => false,
  },

  {
    id: "order_date",
    message: "Order date is required",
    when: () => false,
  },

  // ================= Order Items =================
  {
    id: "orderPillsContainer",
    message: "At least one order item is required",
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

  // ================= Notes =================
  {
    id: "notes",
    message: "Notes are required",
    when: () => false,
  },

  // ================= Flags =================
  {
    id: "is_priority",
    message: "Priority flag is required",
    when: () => false,
  },
];