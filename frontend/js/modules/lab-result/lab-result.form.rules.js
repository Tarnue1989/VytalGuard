// =============================================
// Lab Result Form Rules (HTML + Controller aligned)
// =============================================

export const LAB_RESULT_FORM_RULES = [
  /* ============================================================
     🔐 Organization (Superadmin Only)
  ============================================================ */
  {
    id: "organizationSelect",
    message: "Organization is required",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super"),
  },

  /* ============================================================
     🏥 Facility (Auto-resolved for non-super roles)
  ============================================================ */
  {
    id: "facilitySelect",
    message: "Facility is required",
    when: () => false,
  },

  /* ============================================================
     🔗 Core Required (Primary Links)
  ============================================================ */
  {
    id: "patientId",
    message: "Patient is required",
    when: () => true,
  },
  {
    id: "labRequestSelect",
    message: "Lab Request is required",
    when: () => true,
  },
  {
    id: "labRequestItemSelect",
    message: "Lab Test Item is required",
    when: () => true,
  },

  /* ============================================================
     🩺 Clinical Context (Auto-Filled / Readonly)
  ============================================================ */
  {
    id: "departmentIdHidden",
    message: "Department is required",
    when: () => false,
  },
  {
    id: "doctorId",
    message: "Doctor is required",
    when: () => false,
  },
  {
    id: "consultationId",
    message: "Consultation is required",
    when: () => false,
  },
  {
    id: "registrationLogId",
    message: "Registration Log is required",
    when: () => false,
  },

  /* ============================================================
     📅 Result Date (Required Always)
  ============================================================ */
  {
    id: "result_date",
    message: "Result date is required",
    when: () => true,
  },

  /* ============================================================
     🧾 Single Result Field (Edit Mode Only)
  ============================================================ */
  {
    id: "result",
    message: "Result value is required",
    when: () =>
      Boolean(
        sessionStorage.getItem("labResultEditId") ||
        new URLSearchParams(window.location.search).get("id")
      ),
  },

  /* ============================================================
     📝 Optional Fields
  ============================================================ */
  {
    id: "notes",
    message: "Notes are required",
    when: () => false,
  },
  {
    id: "doctor_notes",
    message: "Doctor notes are required",
    when: () => false,
  },

  /* ============================================================
     📎 Attachment (Optional)
  ============================================================ */
  {
    id: "attachmentInput",
    message: "Attachment is required",
    when: () => false,
  },

  /* ============================================================
     💊 Multi-Result Safety (Create Mode Only)
  ============================================================ */
  {
    id: "resultPillsContainer",
    message:
      "At least one lab result must be added before submitting",
    when: () =>
      !Boolean(
        sessionStorage.getItem("labResultEditId") ||
        new URLSearchParams(window.location.search).get("id")
      ),
  },
];