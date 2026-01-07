// 📦 add-master-item-category.js – Master Item Category Form Controller (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-main.js / vital-main.js
// 🔹 Full enterprise-aligned structure (auth guard, permissions, shared state)
// 🔹 Consistent reset/edit/add UI flow + organization/facility scoping
// 🔹 100% ID retention – safe for linked HTML + JS
// ============================================================================

import { setupMasterItemCategoryFormSubmission } from "./master-item-category-form.js";

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
  setupSelectOptions,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – resolves correct permission automatically
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// 🧩 Shared reference (enterprise standard)
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper → Back to Add Mode
============================================================ */
function resetForm() {
  const form = document.getElementById("masterItemCategoryForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset radios
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // Reset dropdowns
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Master Item Category";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Category`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("masterItemCategoryForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* --------------------- Organization & Facility --------------------- */
  try {
    if (userRole.includes("super")) {
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
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility");
  }

  /* -------------------- Form setup & submission -------------------- */
  setupMasterItemCategoryFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* --------------------------- Edit Mode --------------------------- */
  const editId = sessionStorage.getItem("masterItemCategoryEditId");
  const rawPayload = sessionStorage.getItem("masterItemCategoryEditPayload");

  async function applyPrefill(entry) {
    // 🧠 Core fields
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";
    document.getElementById("description").value = entry.description || "";

    // 🏢 Organization & Facility
    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      const facs = await loadFacilitiesLite(
        { organization_id: entry.organization.id },
        true
      );
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }
    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;

    // 🟢 Status
    if (entry.status) {
      const radio = document.getElementById(`status_${entry.status.toLowerCase()}`);
      if (radio) radio.checked = true;
    }

    // 🧭 Switch to Edit mode UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Master Item Category";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Category`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached category for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/master-item-categories/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch category");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load category:", err);
        showToast(err.message || "❌ Failed to load category for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ------------------------- Cancel & Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("masterItemCategoryEditId");
    sessionStorage.removeItem("masterItemCategoryEditPayload");
    window.location.href = "/master-item-categories-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("masterItemCategoryEditId");
    sessionStorage.removeItem("masterItemCategoryEditPayload");
    resetForm();
  });
});
