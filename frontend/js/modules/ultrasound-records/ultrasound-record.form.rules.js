/* =============================================
   Ultrasound Record Form Rules (Controller-aligned)
   MASTER-PARITY (Delivery Record / EKG Form Pattern)
============================================= */

export const ULTRASOUND_RECORD_FORM_RULES = [
  // ================= Identity =================
  { id: "patientInput", message: "Patient is required" },
  { id: "scanDate", message: "Scan date is required" },
  { id: "billableItemSelect", message: "Scan type is required" },

  // ================= Clinical Links =================
  { id: "technicianInput", message: "Technician is required", when: () => false },

  {
    id: "consultationSelect",
    message: "Consultation is required",
    when: () => false, // optional by default (controlled elsewhere)
  },

  {
    id: "maternityVisitSelect",
    message: "Maternity visit is required",
    when: () => false, // optional by default (controlled elsewhere)
  },

  // ================= Scan Details =================
  { id: "scanLocation", message: "Scan location is required", when: () => false },
  { id: "ultraFindings", message: "Findings are required", when: () => false },
  { id: "note", message: "Notes are required", when: () => false },

  // ================= Measurements =================
  {
    id: "numberOfFetus",
    message: "Number of fetuses is required",
    when: () => document.getElementById("numberOfFetus")?.value !== "",
  },
  {
    id: "biparietalDiameter",
    message: "Biparietal diameter is required",
    when: () => document.getElementById("biparietalDiameter")?.value !== "",
  },
  { id: "presentation", message: "Presentation is required", when: () => false },
  { id: "lie", message: "Lie is required", when: () => false },
  { id: "position", message: "Position is required", when: () => false },
  {
    id: "amnioticVolume",
    message: "Amniotic volume is required",
    when: () => document.getElementById("amnioticVolume")?.value !== "",
  },
  {
    id: "fetalHeartRate",
    message: "Fetal heart rate is required",
    when: () => document.getElementById("fetalHeartRate")?.value !== "",
  },
  { id: "gender", message: "Gender is required", when: () => false },

  // ================= History =================
  { id: "indication", message: "Indication is required", when: () => false },
  { id: "previousCesarean", message: "Previous cesarean flag is required", when: () => false },
  {
    id: "prevCesDate",
    message: "Previous cesarean date is required",
    when: () => document.getElementById("previousCesarean")?.checked === true,
  },
  {
    id: "prevCesLocation",
    message: "Previous cesarean location is required",
    when: () => document.getElementById("previousCesarean")?.checked === true,
  },
  { id: "cesareanDate", message: "Cesarean date is required", when: () => false },
  { id: "nextOfKin", message: "Next of kin is required", when: () => false },

  // ================= File Upload =================
  { id: "ultrasoundFile", message: "Ultrasound file is required", when: () => false },

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
