/* =============================================
   Consultation Form Rules (Controller-aligned)
   ENTERPRISE MASTER PARITY
============================================= */

export const CONSULTATION_FORM_RULES = [
  // ================= Identity =================
  {
    id: "patientInput",
    message: "Patient is required",
  },
  {
    id: "patientId",
    message: "Patient is required",
  },

  // ================= Core Consultation =================
  {
    id: "departmentSelect",
    message: "Department is required",
    when: () => false, // optional per controller
  },
  {
    id: "consultationTypeSelect",
    message: "Consultation type is required",
    when: () => false, // optional unless enforced later
  },
  {
    id: "consultationDate",
    message: "Consultation date is required",
    when: () => false, // backend allows default/auto
  },

  // ================= Appointment Link =================
  {
    id: "appointmentSelect",
    message: "Appointment is required",
    when: () => false, // optional linkage
  },

  // ================= Doctor =================
  {
    id: "doctorInput",
    message: "Doctor is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },
  {
    id: "doctorId",
    message: "Doctor is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  // ================= Clinical Fields =================
  {
    id: "diagnosis",
    message: "Diagnosis is required",
    when: () => false,
  },
  {
    id: "consultationNotes",
    message: "Consultation notes are required",
    when: () => false,
  },
  {
    id: "prescribedMedications",
    message: "Prescribed medications are required",
    when: () => false,
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
