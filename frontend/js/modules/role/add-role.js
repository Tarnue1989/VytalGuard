// 📦 role-main.js – Role Form (Add/Edit) Page Controller (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: vital-main.js
// 🔹 Fully enterprise-aligned structure (auth guard, permissions, role visibility)
// 🔹 Consistent reset/edit/add UI flow + shared state pattern
// 🔹 All original HTML IDs preserved exactly
// ============================================================================

import { setupRoleFormSubmission } from "./role-form.js";

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

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧩 Role Normalization (CRITICAL)
============================================================ */
function resolveUserRole() {
  const raw = (localStorage.getItem("userRole") || "").toLowerCase();

  if (raw.includes("superadmin")) return "superadmin";
  if (raw.includes("organization_admin")) return "organization_admin";
  if (raw.includes("facility_admin")) return "facility_admin";

  return "staff";
}

const userRole = resolveUserRole();

/* ============================================================
   🧹 Reset Form Helper → Back to Add Mode
============================================================ */
function resetForm() {
  const form = document.getElementById("roleForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset radios
  document.getElementById("status_active")?.setAttribute("checked", true);
  document.getElementById("is_system_false")?.setAttribute("checked", true);

  // Reset dropdowns
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI text
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Role";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Role`;
  }
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("roleForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  /* ============================================================
     🏢 Organization & Facility Scoping
  ============================================================ */
  try {
    // 🔑 SUPERADMIN → selectable org + facility
    if (userRole === "superadmin") {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");

      orgSelect?.addEventListener("change", async () => {
        const orgId = orgSelect.value || null;
        const facilities = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(
          facSelect,
          facilities,
          "id",
          "name",
          "-- Select Facility --"
        );
      });
    }

    // 🏢 ORGANIZATION ADMIN → org locked, facility selectable
    else if (userRole === "organization_admin") {
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }

    // 🏥 FACILITY ADMIN / STAFF → both hidden
    else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility");
  }

  /* ============================================================
     🧾 Form Setup & Submission
  ============================================================ */
  setupRoleFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Support
  ============================================================ */
  const editId = sessionStorage.getItem("roleEditId");
  const rawPayload = sessionStorage.getItem("roleEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";
    document.getElementById("description").value = entry.description || "";

    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;

      const facs = await loadFacilitiesLite(
        { organization_id: entry.organization.id },
        true
      );
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }

    if (entry.facility?.id && facSelect) {
      facSelect.value = entry.facility.id;
    }

    if (entry.role_type) {
      const radio = document.getElementById(
        `is_system_${entry.role_type === "system"}`
      );
      if (radio) radio.checked = true;
    }

    if (entry.status) {
      const radio = document.getElementById(
        `status_${entry.status.toLowerCase()}`
      );
      if (radio) radio.checked = true;
    }

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Role";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Role`;
    }
  }

  if (editId && rawPayload) {
    try {
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(JSON.parse(rawPayload));
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached role for editing");
    }
  } else {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      try {
        showLoading();
        const res = await authFetch(`/api/roles/${id}`);
        const result = await res.json();
        if (!res.ok || !result?.data)
          throw new Error(result.message || "❌ Failed to fetch role");

        sharedState.currentEditIdRef.value = id;
        await applyPrefill(result.data);
      } catch (err) {
        console.error("❌ Failed to load role:", err);
        showToast(err.message || "❌ Failed to load role for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("roleEditId");
    sessionStorage.removeItem("roleEditPayload");
    window.location.href = "/roles-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("roleEditId");
    sessionStorage.removeItem("roleEditPayload");
    resetForm();
  });
});
