// 📁 medical-record-form.js – Secure & Role-Aware Medical Record Form (Upgraded)
// ============================================================================
// 🧭 Master Pattern: Consultation (Central Stock + Clinical Enterprise Pattern)
// Maintains all existing Med Rec HTML IDs for full compatibility.
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
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

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
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/* ============================================================
   🚀 Setup Medical Record Form
============================================================ */
export async function setupMedicalRecordFormSubmission({ form }) {
  // 🔐 Auth Guard + Session
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("medicalRecordEditId");
  const queryId = getQueryParam("id");
  const recordId = sessionId || queryId || null;
  const isEdit = Boolean(recordId && recordId !== "undefined" && recordId !== "null");

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Medical Record");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Medical Record`);
    } else {
      titleEl && (titleEl.textContent = "Add Medical Record");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Medical Record`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📎 DOM References
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const doctorInput = document.getElementById("doctorInput");
  const doctorHidden = document.getElementById("doctorId");
  const doctorSuggestions = document.getElementById("doctorSuggestions");
  const doctorFieldGroup = document.getElementById("doctorFieldGroup");

  const consultationInput = document.getElementById("consultationInput");
  const consultationHidden = document.getElementById("consultationId");
  const consultationSuggestions = document.getElementById("consultationSuggestions");

  const registrationLogInput = document.getElementById("registrationLogInput");
  const registrationLogHidden = document.getElementById("registrationLogId");
  const registrationLogSuggestions = document.getElementById("registrationLogSuggestions");

  const recordedAtInput = document.getElementById("recordedAt");
  const reportFileInput = document.getElementById("reportFile");
  const isEmergencyInput = document.getElementById("isEmergency");

  /* ============================================================
     🧭 Prefill Dropdowns & Suggestions
  ============================================================ */
  let userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  try {
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

    // ✅ Patient suggestions
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

    // ✅ Doctor suggestion (superadmins only)
    if (userRole.includes("super")) {
      doctorFieldGroup?.classList.remove("hidden");
      setupSuggestionInputDynamic(
        doctorInput,
        doctorSuggestions,
        "/api/lite/employees",
        (selected) => {
          doctorHidden.value = selected?.id || "";
          doctorInput.value =
            selected.full_name ||
            `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
        },
        "full_name"
      );
    } else {
      doctorFieldGroup?.classList.add("hidden");
      doctorHidden.value = localStorage.getItem("employeeId") || "";
    }

    // ✅ Consultation & Registration Log
    setupSuggestionInputDynamic(
      consultationInput,
      consultationSuggestions,
      "/api/lite/consultations",
      (selected) => {
        consultationHidden.value = selected?.id || "";
        consultationInput.value =
          selected.label || selected.diagnosis || selected.consultation_date || "";
      },
      "label"
    );

    setupSuggestionInputDynamic(
      registrationLogInput,
      registrationLogSuggestions,
      "/api/lite/registration-logs",
      (selected) => {
        registrationLogHidden.value = selected?.id || "";
        registrationLogInput.value = selected.label || selected.registration_time || "";
      },
      "label"
    );
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     ✏️ Prefill if Editing (Guarded)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();
      const res = await authFetch(`/api/medical-records/${recordId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load medical record"));
      const entry = result?.data;
      if (!entry) return;

      recordedAtInput.value = normalizeDate(entry.recorded_at) || "";
      isEmergencyInput.checked = !!entry.is_emergency;

      if (entry.patient)
        patientInput.value =
          entry.patient.label ||
          (entry.patient.pat_no && entry.patient.full_name
            ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
            : entry.patient.full_name || entry.patient.pat_no || "");
      patientHidden.value = entry.patient_id || "";

      if (userRole.includes("super") && entry.doctor)
        doctorInput.value =
          entry.doctor.full_name ||
          `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();
      doctorHidden.value = entry.doctor_id || "";

      if (entry.consultation) {
        consultationInput.value = entry.consultation.diagnosis || entry.consultation.label || "";
        consultationHidden.value = entry.consultation_id || "";
      }

      if (entry.registrationLog) {
        registrationLogInput.value =
          entry.registrationLog.label || entry.registrationLog.registration_time || "";
        registrationLogHidden.value = entry.registration_log_id || "";
      }

      [
        "cc","hpi","pmh","fh_sh","nut_hx","imm_hx","obs_hx","gyn_hx",
        "pe","resp_ex","cv_ex","abd_ex","pel_ex","ext","neuro_ex",
        "ddx","dx","lab_inv","img_inv","tx_mx","summary_pg"
      ].forEach((f) => {
        if (document.getElementById(f)) {
          document.getElementById(f).value = entry[f] || "";
        }
      });

      setUI("edit");
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load medical record");
    }
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    if (isEdit && !recordId) {
      showToast("⚠️ Missing record ID — please reload the edit page.");
      return;
    }

    const payload = {
      patient_id: normalizeUUID(patientHidden.value),
      doctor_id: normalizeUUID(doctorHidden.value),
      consultation_id: normalizeUUID(consultationHidden.value),
      registration_log_id: normalizeUUID(registrationLogHidden.value),
      organization_id: normalizeUUID(
        orgSelect?.value || localStorage.getItem("organizationId")
      ),
      facility_id: normalizeUUID(facSelect?.value || localStorage.getItem("facilityId")),
      recorded_at: recordedAtInput?.value || null,
      is_emergency: !!isEmergencyInput?.checked,
    };

    [
      "cc","hpi","pmh","fh_sh","nut_hx","imm_hx","obs_hx","gyn_hx",
      "pe","resp_ex","cv_ex","abd_ex","pel_ex","ext","neuro_ex",
      "ddx","dx","lab_inv","img_inv","tx_mx","summary_pg"
    ].forEach((f) => {
      payload[f] = document.getElementById(f)?.value || null;
    });

    // ✅ Validation (doctor required only for superadmin)
    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (userRole.includes("super") && !payload.doctor_id)
      return showToast("❌ Doctor is required for superadmin");
    if (!payload.recorded_at) return showToast("❌ Recorded Date is required");

    const formData = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) formData.append(k, v);
    });
    if (reportFileInput?.files?.[0]) formData.append("report_file", reportFileInput.files[0]);

    try {
      showLoading();
      const url = isEdit ? `/api/medical-records/${recordId}` : `/api/medical-records`;
      const method = isEdit ? "PUT" : "POST";
      const res = await authFetch(url, { method, body: formData });
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(
        isEdit
          ? "✅ Medical record updated successfully"
          : "✅ Medical record created successfully"
      );

      sessionStorage.removeItem("medicalRecordEditId");
      sessionStorage.removeItem("medicalRecordEditPayload");

      if (isEdit) window.location.href = "/medical-records-list.html";
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
    sessionStorage.removeItem("medicalRecordEditId");
    sessionStorage.removeItem("medicalRecordEditPayload");
    window.location.href = "/medical-records-list.html";
  });
  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("medicalRecordEditId");
    sessionStorage.removeItem("medicalRecordEditPayload");
    form.reset();
    setUI("add");
  });
}
