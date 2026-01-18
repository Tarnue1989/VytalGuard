// =============================================
// Feature Module Form Rules (HTML + Controller aligned)
// =============================================
// 🧭 Mirrors PATIENT_FORM_RULES exactly
// 🔹 Conditional validation via when()
// 🔹 Superadmin tenant rules enforced
// 🔹 Safe for add & edit forms
// =============================================

export const FEATURE_MODULE_FORM_RULES = [
  /* ===== Identity ===== */
  { id: "name", message: "Module Name is required" },
  { id: "key", message: "Module Key is required" },

  /* ===== Presentation ===== */
  { id: "icon", message: "Icon is required", when: () => false },
  { id: "category", message: "Category is required", when: () => false },
  { id: "description", message: "Description is required", when: () => false },
  { id: "tags", message: "Tags are required", when: () => false },

  /* ===== Routing & Hierarchy ===== */
  { id: "route", message: "Route is required", when: () => true },
  { id: "parent_id", message: "Parent module is required", when: () => false },
  { id: "order_index", message: "Menu order is required", when: () => false },

  /* ===== Visibility & Scope ===== */
  {
    id: "tenant_scope",
    message: "Tenant scope is required",
    when: () => true,
  },

  {
    id: "visibility",
    message: "Visibility selection is required",
    when: () => true,
  },

  { id: "enabled", message: "Enabled flag is required", when: () => false },
  { id: "status", message: "Status is required", when: () => true },

  /* ===== Dashboard ===== */
  {
    id: "show_on_dashboard",
    message: "Dashboard visibility selection is required",
    when: () => false,
  },

  {
    id: "dashboard_type",
    message: "Dashboard type is required when shown on dashboard",
    when: () =>
      document.getElementById("show_on_dashboard")?.checked === true,
  },

  {
    id: "dashboard_order",
    message: "Dashboard order is required",
    when: () => false,
  },

  /* ===== Superadmin-only Rules ===== */
  {
    id: "tenant_scope",
    message: "Only Super Admin can assign Global tenant scope",
    when: () =>
      (localStorage.getItem("userRole") || "")
        .toLowerCase()
        .includes("super") === false &&
      document.getElementById("tenant_scope")?.value === "global",
  },
];
