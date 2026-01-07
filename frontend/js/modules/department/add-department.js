// 📦 department-main.js – Department Form (Add/Edit) Page Controller (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-main.js / vital-main.js
// 🔹 Full enterprise consistency: permissions, auth guard, reset & edit flow
// 🔹 Dynamic org/facility + head suggestion with identical UI behavior
// 🔹 All IDs preserved exactly as in your HTML
// ============================================================================

import { setupDepartmentFormSubmission } from "./department-form.js";

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
  loadEmployeesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – resolves correct permission (add/edit)
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference (enterprise-wide state pattern)
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper → Back to Add Mode
============================================================ */
function resetForm() {
  const form = document.getElementById("departmentForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden + select fields
  ["headId", "organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default status active
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // UI reset
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Department";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Department`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("departmentForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const headInput = document.getElementById("headInput");
  const headSuggestions = document.getElementById("headSuggestions");
  const headHidden = document.getElementById("headId");

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

  /* -------------------- Head of Department Suggestion -------------------- */
  setupSuggestionInputDynamic(
    headInput,
    headSuggestions,
    "/api/lite/employees",
    (selected) => {
      headHidden.value = selected?.id || "";
      headInput.value =
        selected?.label ||
        (selected?.employee_no && selected?.full_name
          ? `${selected.full_name} (${selected.employee_no})`
          : selected?.full_name || "");
    },
    "label"
  );

  /* -------------------- Form setup & submission -------------------- */
  setupDepartmentFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* --------------------------- Edit Mode --------------------------- */
  const editId = sessionStorage.getItem("departmentEditId");
  const rawPayload = sessionStorage.getItem("departmentEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";
    document.getElementById("description").value = entry.description || "";

    // 🟢 Status
    if (entry.status) {
      const radio = document.getElementById(`status_${entry.status.toLowerCase()}`);
      if (radio) radio.checked = true;
    }

    // 🏢 Organization & Facility
    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      if (userRole.includes("super")) {
        try {
          const facs = await loadFacilitiesLite(
            { organization_id: entry.organization.id },
            true
          );
          setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
        } catch (err) {
          console.error("❌ Facilities prefill reload failed:", err);
        }
      }
    }
    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;

    // 👨‍⚕️ Head of Department
    if (entry.head_of_department) {
      const head = entry.head_of_department;
      const headName = [head.first_name, head.middle_name, head.last_name]
        .filter(Boolean)
        .join(" ");
      headInput.value = headName;
      headHidden.value = head.id;
    }

    // Switch UI to Edit Mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Department";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Department`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached department for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/departments/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch department");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load department:", err);
        showToast(err.message || "❌ Failed to load department for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ------------------------- Cancel & Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("departmentEditId");
    sessionStorage.removeItem("departmentEditPayload");
    window.location.href = "/departments-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("departmentEditId");
    sessionStorage.removeItem("departmentEditPayload");
    resetForm();
  });
});
