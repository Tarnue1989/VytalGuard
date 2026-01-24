/* =============================================
   Delivery Record Form Rules (Controller-aligned)
   MASTER-PARITY (EKG FORM RULES PATTERN)
============================================= */

export const DELIVERY_RECORD_FORM_RULES = [
  // ================= Identity =================
  { id: "patientInput", message: "Patient is required" },
  { id: "deliveryDate", message: "Delivery date is required" },
  { id: "billableItemSelect", message: "Delivery type is required" },

  // ================= Clinical Links =================
  { id: "doctorInput", message: "Doctor is required", when: () => false },
  { id: "midwifeInput", message: "Midwife is required", when: () => false },
  { id: "consultationSelect", message: "Consultation is required", when: () => false },

  // ================= Delivery Details =================
  { id: "deliveryMode", message: "Delivery mode is required", when: () => false },
  { id: "babyCount", message: "Baby count is required", when: () => false },
  { id: "birthWeight", message: "Birth weight is required", when: () => false },
  { id: "birthLength", message: "Birth length is required", when: () => false },
  { id: "newbornWeight", message: "Newborn weight is required", when: () => false },
  { id: "newbornGender", message: "Newborn gender is required", when: () => false },
  { id: "apgarScore", message: "Apgar score is required", when: () => false },

  // ================= Notes =================
  { id: "complications", message: "Complications field is required", when: () => false },
  { id: "notes", message: "Notes field is required", when: () => false },

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
  { id: "departmentSelect", message: "Department is required", when: () => false },
];
