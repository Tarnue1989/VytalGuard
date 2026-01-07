// 📦 add-triage-record.js – Enterprise-Aligned Page Controller (Add/Edit)
// ============================================================================
// 🧭 Master Pattern: vital-main.js
// 🔹 Full enterprise structure — unified Add/Edit logic, permission guard,
//   session-based edit cache, dropdown/suggestion preloads, and safe resets.
// 🔹 All original triage-specific fields & IDs preserved.
// ============================================================================

import { setupTriageRecordFormSubmission } from "./triage-record-form.js";

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
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";
import {
  renderSymptomCheckboxes,
  setupSymptomCheckboxes,
  syncSymptomCheckboxes,
} from "../../utils/symptom-utils.js";

// 🔐 Auth Guard – automatically resolves correct permission (add/edit)
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
  const form = document.getElementById("triageRecordForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  [
    "patientId",
    "doctorId",
    "nurseId",
    "organizationSelect",
    "facilitySelect",
    "triageTypeSelect",
    "registrationLogSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Triage Record";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Triage Record`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("triageRecordForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const triageTypeSelect = document.getElementById("triageTypeSelect");
  const regLogSelect = document.getElementById("registrationLogSelect");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🩺 Symptom Checkboxes
  ============================================================ */
  renderSymptomCheckboxes("symptomCheckboxes");
  setupSymptomCheckboxes("symptoms");

  /* ============================================================
     🏢 Organization & Facility Handling
  ============================================================ */
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

  /* ============================================================
     🧾 Triage Types (Billable Items)
  ============================================================ */
  try {
    const triageTypes = await loadBillableItemsLite({ category: "triage" }, true);
    setupSelectOptions(triageTypeSelect, triageTypes, "id", "name", "-- Select Triage Type --");
  } catch (err) {
    console.error("❌ Triage types preload failed:", err);
    showToast("❌ Could not load triage types");
  }

  /* ============================================================
     👥 Suggestion Inputs
  ============================================================ */
  setupSuggestionInputDynamic(
    document.getElementById("patientInput"),
    document.getElementById("patientSuggestions"),
    "/api/lite/patients",
    (selected) => {
      document.getElementById("patientId").value = selected?.id || "";
      document.getElementById("patientInput").value =
        selected?.label ||
        (selected?.pat_no && selected?.full_name
          ? `${selected.pat_no} - ${selected.full_name}`
          : selected?.full_name || selected?.pat_no || "");
    },
    "label"
  );

  setupSuggestionInputDynamic(
    document.getElementById("doctorInput"),
    document.getElementById("doctorSuggestions"),
    "/api/lite/employees",
    (selected) => {
      document.getElementById("doctorId").value = selected?.id || "";
      document.getElementById("doctorInput").value =
        selected?.full_name ||
        `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim();
    },
    "full_name"
  );

  setupSuggestionInputDynamic(
    document.getElementById("nurseInput"),
    document.getElementById("nurseSuggestions"),
    "/api/lite/employees",
    (selected) => {
      document.getElementById("nurseId").value = selected?.id || "";
      document.getElementById("nurseInput").value =
        selected?.full_name ||
        `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim();
    },
    "full_name"
  );

  /* ============================================================
     🧩 Form Submission (Master Pattern)
  ============================================================ */
  setupTriageRecordFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode
  ============================================================ */
  const editId = sessionStorage.getItem("triageRecordEditId");
  const rawPayload = sessionStorage.getItem("triageRecordEditPayload");

  async function applyPrefill(entry) {
    // 🧾 Prefill scalar fields
    const fields = [
      "bp",
      "pulse",
      "rr",
      "temp",
      "oxygen",
      "weight",
      "height",
      "rbg",
      "painScore",
      "position",
      "symptoms",
      "triageNotes",
    ];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el)
        el.value = entry[id] || entry[id.replace("painScore", "pain_score")] || "";
    });

    // 🗓️ Date
    if (entry.recorded_at)
      document.getElementById("recordedAt").value = entry.recorded_at.split("T")[0];

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

    // 🧩 Triage Type & Registration Log
    if (entry.triageType?.id) triageTypeSelect.value = entry.triageType.id;
    if (entry.registrationLog?.id) regLogSelect.value = entry.registrationLog.id;

    // 👤 Patient
    if (entry.patient) {
      document.getElementById("patientId").value = entry.patient.id;
      document.getElementById("patientInput").value =
        entry.patient.label ||
        (entry.patient.pat_no && entry.patient.full_name
          ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
          : entry.patient.full_name || entry.patient.pat_no || "");
    }

    // 👨‍⚕️ Doctor & Nurse
    if (entry.doctor) {
      document.getElementById("doctorId").value = entry.doctor.id;
      document.getElementById("doctorInput").value =
        entry.doctor.full_name ||
        `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();
    }
    if (entry.nurse) {
      document.getElementById("nurseId").value = entry.nurse.id;
      document.getElementById("nurseInput").value =
        entry.nurse.full_name ||
        `${entry.nurse.first_name || ""} ${entry.nurse.last_name || ""}`.trim();
    }

    // 🧠 Sync symptom checkboxes
    syncSymptomCheckboxes(entry.symptoms, ".common-symptom");

    // 🪄 Switch UI to Edit Mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Triage Record";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Triage Record`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached triage record for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/triage-records/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch triage record");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load triage record:", err);
        showToast(err.message || "❌ Failed to load triage record for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("triageRecordEditId");
    sessionStorage.removeItem("triageRecordEditPayload");
    window.location.href = "/triage-records-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("triageRecordEditId");
    sessionStorage.removeItem("triageRecordEditPayload");
    resetForm();
  });
});
