/* ============================================================
   🧪 LAB REQUEST FORM RULES (ENTERPRISE MASTER PARITY)
   ------------------------------------------------------------
   🔹 Consultation / Central Stock aligned
   🔹 Controller-faithful (no HTML validation)
   🔹 Rule-driven (validateUsingRules)
   🔹 Role-aware scope enforcement
============================================================ */

export const LAB_REQUEST_FORM_RULES = [
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
    when: () => false, // optional per controller
  },

  {
    id: "doctorSearch",
    message: "Doctor is required",
    when: () => false, // optional unless enforced later
  },
  {
    id: "doctorId",
    message: "Doctor is required",
    when: () => false,
  },

  {
    id: "consultationSearch",
    message: "Consultation is required",
    when: () => false, // optional linkage
  },

  {
    id: "registrationLogSearch",
    message: "Registration log is required",
    when: () => false, // optional linkage
  },

  {
    id: "request_date",
    message: "Request date is required",
    when: () => false, // backend default allowed
  },

  // ================= Lab Tests =================
  // ⚠️ IMPORTANT:
  // Pill-based items are validated at submit-time.
  // This rule is a logical placeholder for rule-engine symmetry.
  {
    id: "requestPillsContainer",
    message: "At least one lab test is required",
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
    id: "is_emergency",
    message: "Emergency flag is required",
    when: () => false,
  },
];
