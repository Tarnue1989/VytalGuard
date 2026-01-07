// 📦 employee-main.js – Secure Add/Edit Page Controller for Employees (Enterprise Master Pattern)
// ============================================================================
// 🔹 Follows delivery-record-main.js architecture
// 🔹 Preserves FormData upload workflow and all working logic
// 🔹 Unified reset, cancel, clear, edit-prefill, permission guard
// ============================================================================

import { setupEmployeeFormSubmission } from "./employee-form.js";
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
  loadDepartmentsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  const form = document.getElementById("employeeForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset selects
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset file previews
  ["photo", "resume", "document"].forEach((type) => {
    const preview = document.getElementById(`${type}Preview`);
    const removeBtn = document.getElementById(
      `remove${type.charAt(0).toUpperCase() + type.slice(1)}Btn`
    );
    const input = document.getElementById(`${type}Input`);
    if (preview) preview.innerHTML = "";
    if (removeBtn) removeBtn.classList.add("hidden");
    if (input) input.value = "";
  });

  // Reset status radio
  document.getElementById("status_active")?.setAttribute("checked", true);

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Employee";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Employee`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("employeeForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const depSelect = document.getElementById("departmentSelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* --------------------- Organizations & Facilities --------------------- */
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
      // Staff / doctor / nurse roles
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility");
  }

  /* --------------------------- Department --------------------------- */
  try {
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(depSelect, depts, "id", "name", "-- Select Department --");
  } catch (err) {
    console.error("❌ Department preload failed:", err);
    showToast("❌ Failed to load departments");
  }

  /* --------------------------- Form Setup --------------------------- */
  setupEmployeeFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("employeeEditId");
  const rawPayload = sessionStorage.getItem("employeeEditPayload");

  async function applyPrefill(entry) {
    const fill = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === "date" && val) {
        const d = new Date(val);
        el.value = !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : "";
      } else el.value = val || "";
    };

    [
      "first_name", "middle_name", "last_name", "gender", "dob", "phone",
      "email", "address", "employee_no", "position", "license_no", "specialty",
      "certifications", "hire_date", "termination_date",
      "emergency_contact_name", "emergency_contact_phone",
    ].forEach((id) => fill(id, entry[id]));

    if (entry.status) {
      const radio = document.getElementById(`status_${entry.status.toLowerCase()}`);
      if (radio) radio.checked = true;
    }

    const orgId = entry.organization_id || entry.organization?.id;
    const facId = entry.facility_id || entry.facility?.id;
    const depId = entry.department_id || entry.department?.id;

    if (orgId && orgSelect) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
      orgSelect.value = orgId;
    }

    if (facId && facSelect) {
      const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {});
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      facSelect.value = facId;
    }

    if (depId && depSelect) {
      const deps = await loadDepartmentsLite(facId ? { facility_id: facId } : {});
      setupSelectOptions(depSelect, deps, "id", "name", "-- Select Department --");
      depSelect.value = depId;
    }

    if (entry.photo_path) {
      document.getElementById("photoPreview").innerHTML =
        `<img src="${entry.photo_path}" class="preview-img" alt="Employee Photo" />`;
      document.getElementById("removePhotoBtn")?.classList.remove("hidden");
    }

    if (entry.resume_url) {
      const fname = entry.resume_url.split("/").pop();
      document.getElementById("resumePreview").innerHTML =
        `<a href="${entry.resume_url}" target="_blank">${fname}</a>`;
      document.getElementById("removeResumeBtn")?.classList.remove("hidden");
    }

    if (entry.document_url) {
      const fname = entry.document_url.split("/").pop();
      document.getElementById("documentPreview").innerHTML =
        `<a href="${entry.document_url}" target="_blank">${fname}</a>`;
      document.getElementById("removeDocumentBtn")?.classList.remove("hidden");
    }

    // UI update
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Employee";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Employee`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached employee payload:", err);
      showToast("❌ Could not load cached employee for editing");
    }
  } else {
    // Optional: URL param support (like master)
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/employees/${id}`);
        const data = await res.json();
        const entry = data?.data;
        if (!res.ok || !entry)
          throw new Error(data.message || "❌ Failed to fetch employee");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load record:", err);
        showToast(err.message || "❌ Could not load employee record");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear Buttons
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("employeeEditId");
    sessionStorage.removeItem("employeeEditPayload");
    window.location.href = "/employees-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("employeeEditId");
    sessionStorage.removeItem("employeeEditPayload");
    resetForm();
  });
});
