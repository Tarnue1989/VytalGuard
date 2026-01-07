// 📦 add-patient.js – Secure Add/Edit Page Controller for Patients (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors employee-main.js architecture
// 🔹 Unified guard, dropdown preload, edit-prefill, reset, cancel, clear
// 🔹 Fully aligned with VytalGuard enterprise master modules
// 🔹 100% ID retention for linked HTML
// ============================================================================

import { setupPatientFormSubmission } from "./patient-form.js";
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
  const form = document.getElementById("patientForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["photo"].forEach((type) => {
    const preview = document.getElementById(`${type}Preview`);
    const removeBtn = document.getElementById(
      `remove${type.charAt(0).toUpperCase() + type.slice(1)}Btn`
    );
    const input = document.getElementById(`${type}Input`);
    if (preview) preview.innerHTML = "";
    if (removeBtn) removeBtn.classList.add("hidden");
    if (input) input.value = "";
  });

  document.getElementById("registration_status_active")?.setAttribute("checked", true);

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Patient";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Patient`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("patientForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* --------------------- Organization / Facility --------------------- */
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
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

  /* --------------------- Form Setup --------------------- */
  setupPatientFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("patientEditId");
  const rawPayload = sessionStorage.getItem("patientEditPayload");

  async function applyPrefill(entry) {
    const fill = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === "date" && val) {
        const d = new Date(val);
        el.value = !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : "";
      } else {
        el.value = val ?? "";
      }
    };

    [
      "first_name","middle_name","last_name","gender","date_of_birth",
      "phone_number","email_address","home_address","pat_no",
      "marital_status","religion","profession",
      "national_id","insurance_number","passport_number","notes"
    ].forEach((id) => fill(id, entry[id]));

    // ✅ CRITICAL FIX: Emergency contacts JSONB → form fields
    if (Array.isArray(entry.emergency_contacts) && entry.emergency_contacts.length) {
      const ec = entry.emergency_contacts[0];
      fill("emergency_contact_name", ec?.name);
      fill("emergency_contact_phone", ec?.phone);
    }

    if (entry.registration_status) {
      document.getElementById(
        `registration_status_${entry.registration_status.toLowerCase()}`
      )?.setAttribute("checked", true);
    }

    const orgId = entry.organization_id || entry.organization?.id;
    const facId = entry.facility_id || entry.facility?.id;

    if (orgId && orgSelect) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
      orgSelect.value = orgId;
    }

    if (facId && facSelect) {
      const facs = await loadFacilitiesLite(
        orgId ? { organization_id: orgId } : {}
      );
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      facSelect.value = facId;
    }

    if (entry.photo_path) {
      document.getElementById("photoPreview").innerHTML =
        `<img src="${entry.photo_path}" class="preview-img" alt="Patient Photo" />`;
      document.getElementById("removePhotoBtn")?.classList.remove("hidden");
    }

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Patient";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Patient`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached payload error:", err);
      showToast("❌ Could not load cached patient");
    }
  } else {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/patients/${id}`);
        const data = await res.json();
        if (!res.ok || !data?.data)
          throw new Error(data?.message || "Failed to load patient");
        await applyPrefill(data.data);
      } catch (err) {
        console.error(err);
        showToast(err.message);
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("patientEditId");
    sessionStorage.removeItem("patientEditPayload");
    window.location.href = "/patients-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("patientEditId");
    sessionStorage.removeItem("patientEditPayload");
    resetForm();
  });
});
