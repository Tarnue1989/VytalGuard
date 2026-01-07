// 📦 add-supplier.js – Enterprise-Aligned Page Controller (Add/Edit Supplier)
// ============================================================================
// 🧭 Master Pattern: add-triage-record.js
// 🔹 Unified enterprise structure — Add/Edit mode, permission guard,
//   session-based edit cache, dropdown preloads, and safe resets.
// 🔹 All supplier-specific fields & IDs preserved.
// ============================================================================

import { setupSupplierFormSubmission } from "./supplier-form.js";

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – Automatically resolves correct permission
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference for consistent state tracking
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper → Back to Add Mode
============================================================ */
function resetForm() {
  const form = document.getElementById("supplierForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear selects
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default status
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // Switch UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Supplier";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Supplier`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("supplierForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🏢 Organization & Facility Handling
  ============================================================ */
  try {
    if (userRole.includes("super")) {
      // Super Admin → Full control
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (userRole.includes("admin")) {
      // Admin → Facility-scoped
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      // Staff → Hide both
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility lists");
  }

  /* ============================================================
     🧩 Supplier Form Submission (Master Pattern)
  ============================================================ */
  setupSupplierFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("supplierEditId");
  const rawPayload = sessionStorage.getItem("supplierEditPayload");

  async function applyPrefill(entry) {
    if (!entry) return;
    showLoading();

    // 🧾 Basic fields
    ["name", "contact_name", "contact_email", "contact_phone", "address", "notes"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.value = entry[id] || "";
      }
    );

    // 🏢 Organization & Facility
    const orgId = entry.organization_id || entry.organization?.id;
    const facId = entry.facility_id || entry.facility?.id;

    try {
      if (orgId && orgSelect) {
        const orgs = await loadOrganizationsLite();
        setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
        orgSelect.value = orgId;
      }

      if (facId && facSelect) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
        facSelect.value = facId;
      }
    } catch (err) {
      console.error("❌ Prefill org/fac failed:", err);
    }

    // 🔘 Status
    const rawStatus = (entry.status || "").toLowerCase();
    const statusEl = document.getElementById(`status_${rawStatus}`);
    if (statusEl) statusEl.checked = true;

    // 🪄 Switch UI to Edit Mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Supplier";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Supplier`;

    hideLoading();
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached supplier for editing");
    }
  } else {
    // Fallback: ?id param in URL
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/suppliers/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch supplier");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Fetch edit record failed:", err);
        showToast(err.message || "❌ Failed to load supplier for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear Buttons
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("supplierEditId");
    sessionStorage.removeItem("supplierEditPayload");
    window.location.href = "/suppliers-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("supplierEditId");
    sessionStorage.removeItem("supplierEditPayload");
    resetForm();
  });
});
