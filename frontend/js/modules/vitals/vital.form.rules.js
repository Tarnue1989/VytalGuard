export const VITAL_FORM_RULES = [
  /* Identity */
  { id: "patientId", message: "Patient is required" },
  { id: "recordedAt", message: "Recorded date/time is required" },
  { id: "position", message: "Position is required", when: () => false },

  /* Vitals */
  { id: "bp", message: "Blood pressure is required", when: () => false },
  { id: "pulse", message: "Pulse is required", when: () => false },
  { id: "rr", message: "Respiratory rate is required", when: () => false },
  { id: "temp", message: "Temperature is required", when: () => false },
  { id: "oxygen", message: "Oxygen saturation is required", when: () => false },
  { id: "weight", message: "Weight is required", when: () => false },
  { id: "height", message: "Height is required", when: () => false },
  { id: "rbg", message: "RBG is required", when: () => false },
  { id: "painScore", message: "Pain score is required", when: () => false },

  /* Scope */
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
      const r = (localStorage.getItem("userRole") || "").toLowerCase();
      return !r.includes("super") && !r.includes("org");
    },
  },
];
