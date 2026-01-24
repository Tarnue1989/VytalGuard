
/* =============================================
   EKG Record Form Rules (Controller-aligned)
============================================= */

export const EKG_RECORD_FORM_RULES = [
  // ================= Identity =================
  { id: "patientInput", message: "Patient is required" },
  { id: "recordedDate", message: "Recorded date is required" },

  // ================= Clinical Links =================
  { id: "billableItemSelect", message: "Billable item is required", when: () => false },
  { id: "consultationSelect", message: "Consultation is required", when: () => false },
  { id: "registrationLogSelect", message: "Registration log is required", when: () => false },

  // ================= Measurements =================
  { id: "heartRate", message: "Heart rate is required", when: () => false },
  { id: "prInterval", message: "PR interval is required", when: () => false },
  { id: "qrsDuration", message: "QRS duration is required", when: () => false },
  { id: "qtInterval", message: "QT interval is required", when: () => false },
  { id: "axis", message: "Axis is required", when: () => false },
  { id: "rhythm", message: "Rhythm is required", when: () => false },

  // ================= Interpretation =================
  { id: "interpretation", message: "Interpretation is required", when: () => false },
  { id: "recommendation", message: "Recommendation is required", when: () => false },
  { id: "note", message: "Notes are required", when: () => false },

  // ================= Flags =================
  { id: "isEmergency", message: "Emergency flag is required", when: () => false },

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
