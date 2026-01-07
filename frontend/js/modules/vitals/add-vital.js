// 📦 vital-main.js – Vital Form (Add/Edit) Page Controller (master-aligned)
// ============================================================================
// 🧭 Master Pattern: consultation-main.js
// 🔹 Full enterprise-aligned structure: permissions, role-based dropdowns,
//   tooltips, unified edit/add flow, consistent reset and auth handling.
// 🔹 All original IDs preserved exactly.
// ============================================================================

import { setupVitalFormSubmission } from "./vital-form.js";

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
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – automatically resolve correct permission (add/edit)
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference for consistent module handling
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper → Back to Add Mode
============================================================ */
function resetForm() {
  const form = document.getElementById("vitalForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden IDs
  ["patientId", "nurseId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset dropdowns
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Vital";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Vital`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("vitalForm");
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

  /* -------------------- Patient & Nurse Suggestions -------------------- */
  setupSuggestionInputDynamic(
    document.getElementById("patientInput"),
    document.getElementById("patientSuggestions"),
    "/api/lite/patients",
    (selected) => {
      const patientIdEl = document.getElementById("patientId");
      const patientInput = document.getElementById("patientInput");
      if (!patientIdEl || !patientInput) return;

      patientIdEl.value = selected?.id || "";
      patientInput.value =
        selected?.label ||
        (selected?.pat_no && selected?.full_name
          ? `${selected.pat_no} - ${selected.full_name}`
          : selected?.full_name || selected?.pat_no || "");
    },
    "label"
  );

  setupSuggestionInputDynamic(
    document.getElementById("nurseInput"),
    document.getElementById("nurseSuggestions"),
    "/api/lite/employees",
    (selected) => {
      const nurseIdEl = document.getElementById("nurseId");
      const nurseInput = document.getElementById("nurseInput");
      if (!nurseIdEl || !nurseInput) return;

      nurseIdEl.value = selected?.id || "";
      nurseInput.value =
        selected?.full_name ||
        `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim();
    },
    "full_name"
  );

  /* -------------------- Form setup & submission -------------------- */
  setupVitalFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* --------------------------- Edit Mode --------------------------- */
  const editId = sessionStorage.getItem("vitalEditId");
  const rawPayload = sessionStorage.getItem("vitalEditPayload");

  async function applyPrefill(entry) {
    // 🧠 Patient
    if (entry.patient) {
      document.getElementById("patientId").value = entry.patient.id;
      document.getElementById("patientInput").value =
        entry.patient.label ||
        (entry.patient.pat_no && entry.patient.full_name
          ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
          : entry.patient.full_name || entry.patient.pat_no || "");
    }

    // 🧠 Nurse
    if (entry.nurse) {
      document.getElementById("nurseId").value = entry.nurse.id;
      document.getElementById("nurseInput").value =
        entry.nurse.full_name ||
        `${entry.nurse.first_name || ""} ${entry.nurse.last_name || ""}`.trim();
    }

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

    // 🩺 Vital measurements
    [
      "bp", "pulse", "rr", "temp", "oxygen",
      "weight", "height", "rbg", "painScore", "position",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = entry[id] || entry[id.replace("painScore", "pain_score")] || "";
    });

    if (entry.recorded_at) {
      document.getElementById("recordedAt").value = new Date(entry.recorded_at)
        .toISOString()
        .slice(0, 16);
    }

    // Switch to edit mode UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Vital";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Vital`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached vital for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/vitals/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch vital");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load vital:", err);
        showToast(err.message || "❌ Failed to load vital for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ------------------------- Cancel & Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("vitalEditId");
    sessionStorage.removeItem("vitalEditPayload");
    window.location.href = "/vitals-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("vitalEditId");
    sessionStorage.removeItem("vitalEditPayload");
    resetForm();
  });
});
