// =============================================
// Feature Access Form Rules (HTML + Controller aligned)
// =============================================
// 🧭 Mirrors FEATURE_MODULE_FORM_RULES exactly
// 🔹 Conditional validation via when()
// 🔹 Superadmin organization rules enforced
// 🔹 Supports single + bulk (replace) flows
// 🔹 Safe for add & edit forms
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
     🧩 Single Module Mode
     (Ignored when bulk preview is active)
  ============================================================ */

  {
    id: "module_id",
    message: "Module is required",
    when: () => {
      const previewVisible =
        document.getElementById("modulePreviewContainer") &&
        !document
          .getElementById("modulePreviewContainer")
          .classList.contains("d-none");

      return previewVisible === false;
    },
  },

  /* ============================================================
     🧱 Bulk Mode (Replace / Grant All)
  ============================================================ */

  {
    id: "modulePreviewList",
    message: "At least one module must be selected",
    when: () => {
      const container = document.getElementById("modulePreviewContainer");
      if (!container || container.classList.contains("d-none")) return false;

      return container.querySelectorAll(
        "input[type='checkbox']:checked"
      ).length === 0;
    },
  },

  /* ============================================================
     🏥 Facility Scope
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
     🔒 Superadmin-only Rules
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
