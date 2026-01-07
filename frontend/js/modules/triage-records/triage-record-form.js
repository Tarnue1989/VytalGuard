// 📁 triageRecord-form.js – Enterprise-Aligned Master Pattern (Secure + Role-Aware)
// ============================================================================
// 🧭 Master Pattern: vital-form.js
// 🔹 Identical structure, validation flow, and permission logic
// 🔹 Preserves all triage-specific fields and existing HTML IDs
// 🔹 Full edit/add UI toggle, suggestion inputs, and super/admin/staff flow
// ============================================================================

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
  syncSymptomCheckboxes,
} from "../../utils/symptom-utils.js";

/* ============================================================
   🔧 Helpers
============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
  if (msg?.detail) return msg.detail;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}
function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
}
function normalizeDate(val) {
  return val ? new Date(val).toISOString() : null;
}
function formatForDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toISOString().slice(0, 10);
}

/* ============================================================
   🚀 Setup Triage Record Form
============================================================ */
export async function setupTriageRecordFormSubmission({ form }) {
  // 🔐 Auth Guard + Logout watcher
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("triageRecordEditId");
  const queryId = getQueryParam("id");
  const triageId = sessionId || queryId;
  const isEdit = !!triageId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Triage Record");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Triage Record`);
    } else {
      titleEl && (titleEl.textContent = "Add Triage Record");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Triage Record`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🌐 DOM References
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const triageTypeSelect = document.getElementById("triageTypeSelect");
  const registrationLogSelect = document.getElementById("registrationLogSelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const doctorInput = document.getElementById("doctorInput");
  const doctorHidden = document.getElementById("doctorId");
  const doctorSuggestions = document.getElementById("doctorSuggestions");

  const nurseInput = document.getElementById("nurseInput");
  const nurseHidden = document.getElementById("nurseId");
  const nurseSuggestions = document.getElementById("nurseSuggestions");

  /* ============================================================
     🧭 Prefill Dropdowns & Suggestions
  ============================================================ */
  let userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  try {
    // 🔹 Org/Facility visibility by role
    if (userRole.includes("super")) {
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
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // ✅ Patient suggestion input
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (selected) => {
        patientHidden.value = selected?.id || "";
        if (selected) {
          patientInput.value =
            selected.label ||
            (selected.pat_no && selected.full_name
              ? `${selected.pat_no} - ${selected.full_name}`
              : selected.full_name || selected.pat_no || "");
        }
      },
      "label"
    );

    // ✅ Doctor suggestion input
    setupSuggestionInputDynamic(
      doctorInput,
      doctorSuggestions,
      "/api/lite/employees",
      (selected) => {
        doctorHidden.value = selected?.id || "";
        if (selected) {
          doctorInput.value =
            selected.full_name ||
            `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
        }
      },
      "full_name"
    );

    // ✅ Nurse suggestion input
    setupSuggestionInputDynamic(
      nurseInput,
      nurseSuggestions,
      "/api/lite/employees",
      (selected) => {
        nurseHidden.value = selected?.id || "";
        if (selected) {
          nurseInput.value =
            selected.full_name ||
            `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
        }
      },
      "full_name"
    );

    // ✅ Triage Types
    const triageTypes = await loadBillableItemsLite({ category: "triage" }, true);
    setupSelectOptions(triageTypeSelect, triageTypes, "id", "name", "-- Select Triage Type --");
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     ✏️ Prefill if Editing
  ============================================================ */
  if (isEdit && triageId) {
    try {
      showLoading();
      const res = await authFetch(`/api/triage-records/${triageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load triage record"));
      const entry = result?.data;
      if (!entry) return;

      // Prefill basic fields
      orgSelect.value = entry.organization_id || "";
      facSelect.value = entry.facility_id || "";
      triageTypeSelect.value = entry.triage_type_id || "";
      registrationLogSelect.value = entry.registration_log_id || "";

      // Patient
      patientHidden.value = entry.patient_id || "";
      if (entry.patient)
        patientInput.value =
          entry.patient.label ||
          (entry.patient.pat_no && entry.patient.full_name
            ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
            : entry.patient.full_name || entry.patient.pat_no || "");

      // Doctor/Nurse
      doctorHidden.value = entry.doctor_id || "";
      if (entry.doctor)
        doctorInput.value =
          entry.doctor.full_name ||
          `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();

      nurseHidden.value = entry.nurse_id || "";
      if (entry.nurse)
        nurseInput.value =
          entry.nurse.full_name ||
          `${entry.nurse.first_name || ""} ${entry.nurse.last_name || ""}`.trim();

      // Metrics
      const ids = [
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
      ];
      ids.forEach((id) => {
        if (entry[id] || entry[id.replace("painScore", "pain_score")])
          document.getElementById(id).value =
            entry[id] || entry[id.replace("painScore", "pain_score")];
      });

      if (entry.recorded_at)
        document.getElementById("recordedAt").value = formatForDate(entry.recorded_at);
      if (entry.symptoms) syncSymptomCheckboxes(entry.symptoms, ".common-symptom");
      document.getElementById("triageNotes").value = entry.triage_notes || "";

      setUI("edit");
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load triage record");
    }
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      organization_id: normalizeUUID(orgSelect?.value),
      facility_id: normalizeUUID(facSelect?.value),
      patient_id: normalizeUUID(patientHidden.value),
      doctor_id: normalizeUUID(doctorHidden.value),
      nurse_id: normalizeUUID(nurseHidden.value),
      triage_type_id: normalizeUUID(triageTypeSelect?.value),
      registration_log_id: normalizeUUID(registrationLogSelect?.value),
      recorded_at: normalizeDate(document.getElementById("recordedAt")?.value),
      symptoms: document.getElementById("symptoms")?.value || null,
      triage_notes: document.getElementById("triageNotes")?.value || null,
      bp: document.getElementById("bp")?.value || null,
      pulse: document.getElementById("pulse")?.value || null,
      rr: document.getElementById("rr")?.value || null,
      temp: document.getElementById("temp")?.value || null,
      oxygen: document.getElementById("oxygen")?.value || null,
      weight: document.getElementById("weight")?.value || null,
      height: document.getElementById("height")?.value || null,
      rbg: document.getElementById("rbg")?.value || null,
      pain_score: document.getElementById("painScore")?.value || null,
      position: document.getElementById("position")?.value || null,
    };

    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (!payload.triage_type_id) return showToast("❌ Triage Type is required");
    if (!payload.recorded_at) return showToast("❌ Recorded At is required");

    try {
      showLoading();
      const url = isEdit ? `/api/triage-records/${triageId}` : `/api/triage-records`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(
        isEdit
          ? "✅ Triage Record updated successfully"
          : "✅ Triage Record created successfully"
      );

      sessionStorage.removeItem("triageRecordEditId");
      sessionStorage.removeItem("triageRecordEditPayload");

      if (isEdit) window.location.href = "/triage-records-list.html";
      else {
        form.reset();
        setUI("add");
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("triageRecordEditId");
    sessionStorage.removeItem("triageRecordEditPayload");
    window.location.href = "/triage-records-list.html";
  });
  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("triageRecordEditId");
    sessionStorage.removeItem("triageRecordEditPayload");
    form.reset();
    setUI("add");
  });
}
