// 📦 add-master-item.js – Master Item Form Controller (Enterprise-Aligned + Feature Module Support)
// ============================================================================
// 🧭 Master Pattern: add-autoBillingRule.js / vital-main.js
// 🔹 Full enterprise structure (auth guard, permissions, shared state)
// 🔹 Consistent reset/edit/add UI flow + org/facility/department scoping
// 🔹 Integrated dynamic Feature Module linkage (UUID-safe)
// 🔹 100% ID retention – safe for linked HTML + JS
// ============================================================================

import { setupMasterItemFormSubmission } from "./master-item-form.js";

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  loadMasterItemCategoriesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard – resolves correct permission automatically
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🧩 Shared Reference (Enterprise Standard)
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper → Back to Add Mode
============================================================ */
function resetForm() {
  const form = document.getElementById("masterItemForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset status
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // Reset dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "categorySelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset Feature Module dynamic input
  const featureModuleInput = document.getElementById("featureModuleInput");
  const featureModuleId = document.getElementById("featureModuleId");
  if (featureModuleInput) featureModuleInput.value = "";
  if (featureModuleId) featureModuleId.value = "";

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Master Item";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Item`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("masterItemForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const catSelect = document.getElementById("categorySelect");
  const featureModuleInput = document.getElementById("featureModuleInput");
  const featureModuleId = document.getElementById("featureModuleId");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* --------------------- Organization, Facility, Dept, Category --------------------- */
  try {
    if (userRole.includes("super")) {
      // 🔹 Super Admin – can select any org/facility
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      orgSelect?.addEventListener("change", async () => {
        const orgId = orgSelect.value;
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      });

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");

      const depts = await loadDepartmentsLite({}, true);
      setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

      const cats = await loadMasterItemCategoriesLite({}, true);
      setupSelectOptions(catSelect, cats, "id", "name", "-- Select Category --");
    } else if (userRole.includes("admin")) {
      // 🔹 Admin – fixed org, choose from own facilities
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");

      const depts = await loadDepartmentsLite({}, true);
      setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

      const cats = await loadMasterItemCategoriesLite({}, true);
      setupSelectOptions(catSelect, cats, "id", "name", "-- Select Category --");
    } else {
      // 🔹 Staff – hide org & facility
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* -------------------- Form Setup & Submission -------------------- */
  setupMasterItemFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("masterItemEditId");
  const rawPayload = sessionStorage.getItem("masterItemEditPayload");

  async function applyPrefill(entry) {
    // Core Fields
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";
    document.getElementById("generic_group").value = entry.generic_group || "";
    document.getElementById("strength").value = entry.strength || "";
    document.getElementById("dosage_form").value = entry.dosage_form || "";
    document.getElementById("unit").value = entry.unit || "";
    document.getElementById("reorder_level").value = entry.reorder_level || 0;
    document.getElementById("reference_price").value = entry.reference_price || 0;
    document.getElementById("currency").value = entry.currency || "";
    document.getElementById("test_method").value = entry.test_method || "";
    document.getElementById("is_controlled").checked = !!entry.is_controlled;
    document.getElementById("sample_required").checked = !!entry.sample_required;

    // Org/Facility/Dept/Category
    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      if (userRole.includes("super")) {
        const facs = await loadFacilitiesLite(
          { organization_id: entry.organization.id },
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
    }
    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;
    if (entry.department?.id && deptSelect) deptSelect.value = entry.department.id;
    if (entry.category?.id && catSelect) catSelect.value = entry.category.id;

    // ✅ Feature Module Prefill
    if (entry.feature_module_id && featureModuleId)
      featureModuleId.value = entry.feature_module_id;
    if (entry.feature_module?.name && featureModuleInput)
      featureModuleInput.value = entry.feature_module.name;

    // Status
    if (entry.status) {
      const radio = document.getElementById(`status_${entry.status.toLowerCase()}`);
      if (radio) radio.checked = true;
    }

    // Update UI → Edit Mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Master Item";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Item`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached item for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/master-items/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch item");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load item:", err);
        showToast(err.message || "❌ Failed to load item for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("masterItemEditId");
    sessionStorage.removeItem("masterItemEditPayload");
    window.location.href = "/master-items-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("masterItemEditId");
    sessionStorage.removeItem("masterItemEditPayload");
    resetForm();
  });
});
