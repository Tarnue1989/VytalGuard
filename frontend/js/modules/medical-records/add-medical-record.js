// 📦 add-medical-record.js – Medical Record (Add/Edit) Page Controller (Upgraded)
// ==============================================================================
// 🧭 Master Pattern: Consultation Main Controller
// – Handles auth guard, org/facility role visibility, form initialization,
//   suggestion binding, edit prefill, and cancel/clear behavior.
// – 100% compatible with add-medical-record.html IDs
// ==============================================================================

import { setupMedicalRecordFormSubmission } from "./medical-record-form.js";
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

/* ============================================================
   🔐 Auth Guard
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
  const form = document.getElementById("medicalRecordForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Hidden IDs
  ["patientId", "doctorId", "consultationId", "registrationLogId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Core fields
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const chk = document.getElementById("isEmergency");
  if (chk) chk.checked = false;
  const file = document.getElementById("reportFile");
  if (file) file.value = "";

  // UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Medical Record";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Medical Record`;

  // Clear any stale edit session
  sessionStorage.removeItem("medicalRecordEditId");
  sessionStorage.removeItem("medicalRecordEditPayload");
}

/* ============================================================
   🚀 Page Initialization
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("medicalRecordForm");
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

  /* --------------------- Dynamic Suggestions --------------------- */
  setupSuggestionInputDynamic(
    document.getElementById("patientInput"),
    document.getElementById("patientSuggestions"),
    "/api/lite/patients",
    (selected) => {
      document.getElementById("patientId").value = selected?.id || "";
      const input = document.getElementById("patientInput");
      input.value =
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
    document.getElementById("consultationInput"),
    document.getElementById("consultationSuggestions"),
    "/api/lite/consultations",
    (selected) => {
      document.getElementById("consultationId").value = selected?.id || "";
      document.getElementById("consultationInput").value =
        selected?.label || selected?.diagnosis || selected?.consultation_date || "";
    },
    "label"
  );

  setupSuggestionInputDynamic(
    document.getElementById("registrationLogInput"),
    document.getElementById("registrationLogSuggestions"),
    "/api/lite/registration-logs",
    (selected) => {
      document.getElementById("registrationLogId").value = selected?.id || "";
      document.getElementById("registrationLogInput").value =
        selected?.label || selected?.registration_time || "";
    },
    "label"
  );

  /* -------------------- Form Submission Setup -------------------- */
  setupMedicalRecordFormSubmission({
    form,
    token,
    sharedState, // ✅ pass shared state for PUT detection
    resetForm,
    loadEntries: null,
  });

  // 🩹 Prevent any leftover ID from auto-triggering add-mode POSTs
  if (!sessionStorage.getItem("medicalRecordEditId")) {
    sessionStorage.removeItem("medicalRecordEditId");
  }

  /* ------------------------ Edit Mode Logic ------------------------ */
  const editId = sessionStorage.getItem("medicalRecordEditId");
  const rawPayload = sessionStorage.getItem("medicalRecordEditPayload");
  const params = new URLSearchParams(window.location.search);
  const urlId = params.get("id");

  async function applyPrefill(entry, id) {
    document.getElementById("recordedAt").value =
      entry.recorded_at?.split("T")[0] ||
      entry.created_at?.split("T")[0] ||
      "";
    document.getElementById("isEmergency").checked = !!entry.is_emergency;

    /* ✅ Robust Org + Facility Prefill for All Roles */
    const orgId = entry.organization?.id || entry.organization_id || null;
    const facId = entry.facility?.id || entry.facility_id || null;

    try {
      if (userRole.includes("super")) {
        if (orgSelect) {
          const orgs = await loadOrganizationsLite();
          setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
          if (orgId) orgSelect.value = orgId;
        }

        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
        if (facId) facSelect.value = facId;
      } else {
        const facs = await loadFacilitiesLite({}, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
        if (facId) facSelect.value = facId;
      }
    } catch (err) {
      console.error("❌ Facility prefill failed:", err);
    }

    // Prefill Patient
    if (entry.patient) {
      document.getElementById("patientId").value = entry.patient.id;
      document.getElementById("patientInput").value =
        entry.patient.label ||
        (entry.patient.pat_no && entry.patient.first_name
          ? `${entry.patient.pat_no} - ${entry.patient.first_name} ${entry.patient.last_name}`
          : entry.patient.full_name || entry.patient.pat_no || "");
    }

    // Prefill Doctor
    if (entry.doctor) {
      document.getElementById("doctorId").value = entry.doctor.id;
      document.getElementById("doctorInput").value =
        entry.doctor.full_name ||
        `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();
    }

    // Consultation
    if (entry.consultation) {
      document.getElementById("consultationId").value = entry.consultation.id;
      document.getElementById("consultationInput").value =
        entry.consultation.diagnosis || entry.consultation.label || "";
    }

    // Registration Log
    if (entry.registrationLog) {
      document.getElementById("registrationLogId").value = entry.registrationLog.id;
      document.getElementById("registrationLogInput").value =
        entry.registrationLog.label || entry.registrationLog.registration_time || "";
    }

    // Text Areas
    [
      "cc","hpi","pmh","fh_sh","nut_hx","imm_hx","obs_hx","gyn_hx",
      "pe","resp_ex","cv_ex","abd_ex","pel_ex","ext","neuro_ex",
      "ddx","dx","lab_inv","img_inv","tx_mx","summary_pg"
    ].forEach((f) => {
      if (document.getElementById(f)) document.getElementById(f).value = entry[f] || "";
    });

    // UI Switch → Edit Mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Medical Record";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Medical Record`;

    // ✅ Sync Session + Shared State
    sessionStorage.setItem("medicalRecordEditId", id);
    sessionStorage.setItem("medicalRecordEditPayload", JSON.stringify(entry));
    sharedState.currentEditIdRef.value = id;
  }

  try {
    if (editId && rawPayload) {
      const entry = JSON.parse(rawPayload);
      await applyPrefill(entry, editId);
    } else if (urlId) {
      showLoading();
      const res = await authFetch(`/api/medical-records/${urlId}`);
      const result = await res.json();
      const entry = result?.data;
      if (!res.ok || !entry)
        throw new Error(result.message || "❌ Failed to fetch medical record");
      await applyPrefill(entry, urlId);
    }
  } catch (err) {
    console.error("❌ Edit prefill failed:", err);
    showToast(err.message || "❌ Could not load medical record for editing");
  } finally {
    hideLoading();
  }

  /* ------------------------- Cancel & Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    resetForm();
    window.location.href = "/medical-records-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", resetForm);
});
