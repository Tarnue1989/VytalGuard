// =============================================
// Feature Access Form Rules (FINAL – CARD SYSTEM)
// =============================================
// ✔ Works with module cards (no module_id)
// ✔ Supports bulk preview
// ✔ Safe for add + edit
// ✔ Matches backend + UI
// =============================================

export const FEATURE_ACCESS_FORM_RULES = [
  /* ============================================================
     🏢 Scope
  ============================================================ */

  {
    id: "organization_id",
    message: "Organization is required",
    when: () => true,
  },

  {
    id: "role_id",
    message: "Role is required",
    when: () => true,
  },

  /* ============================================================
     🧱 Bulk Mode Validation
  ============================================================ */

  {
    id: "modulePreviewList",
    message: "At least one module must be selected",
    when: () => {
      const container = document.getElementById("modulePreviewContainer");

      // only validate when bulk preview is visible
      if (!container || container.classList.contains("d-none")) return false;

      return container.querySelectorAll(
        "input[type='checkbox']:checked"
      ).length === 0;
    },
  },

  /* ============================================================
     🏥 Facility Scope (no strict validation)
  ============================================================ */

  {
    id: "facility_id",
    message: "Facility selection is invalid",
    when: () => false,
  },

  /* ============================================================
     🔐 Status
  ============================================================ */

  {
    id: "status",
    message: "Status selection is required",
    when: () => true,
  },

  /* ============================================================
     🔒 Superadmin Rule
  ============================================================ */

  {
    id: "organization_id",
    message: "Only Super Admin can assign access across organizations",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super") === false &&
      document.getElementById("organization_id")?.value &&
      document.getElementById("organization_id")?.value !==
        localStorage.getItem("organization_id"),
  },
];