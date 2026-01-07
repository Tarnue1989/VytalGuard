// 📁 vital-form.js – Secure & Role-Aware Vital Form (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: consultation-form.js
// 🔹 Same structure, permission logic, and submission flow
// 🔹 Keeps all original HTML IDs intact (safe for your current HTML)
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
function normalizeDateTime(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function formatForDateTimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toISOString().slice(0, 16);
}

/* ============================================================
   🚀 Setup Vital Form
============================================================ */
export async function setupVitalFormSubmission({ form }) {
  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("vitalEditId");
  const queryId = getQueryParam("id");
  const vitalId = sessionId || queryId;
  const isEdit = !!vitalId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Vital");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Vital`);
    } else {
      titleEl && (titleEl.textContent = "Add Vital");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Vital`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🌐 DOM References
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const nurseInput = document.getElementById("nurseInput");
  const nurseHidden = document.getElementById("nurseId");
  const nurseSuggestions = document.getElementById("nurseSuggestions");

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

    // ✅ Nurse (employee) suggestions
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
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     ✏️ Prefill if Editing
  ============================================================ */
  if (isEdit && vitalId) {
    try {
      showLoading();
      const res = await authFetch(`/api/vitals/${vitalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load vital"));
      const entry = result?.data;
      if (!entry) return;

      patientHidden.value = entry.patient_id || "";
      if (entry.patient)
        patientInput.value =
          entry.patient.label ||
          (entry.patient.pat_no && entry.patient.full_name
            ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
            : entry.patient.full_name || entry.patient.pat_no || "");

      nurseHidden.value = entry.nurse_id || "";
      if (entry.nurse)
        nurseInput.value =
          entry.nurse.full_name ||
          `${entry.nurse.first_name || ""} ${entry.nurse.last_name || ""}`.trim();

      orgSelect.value = entry.organization_id || "";
      facSelect.value = entry.facility_id || "";

      // Prefill vital metrics
      const ids = [
        "bp", "pulse", "rr", "temp", "oxygen", "weight",
        "height", "rbg", "painScore", "position",
      ];
      ids.forEach((id) => {
        if (entry[id] || entry[id.replace("painScore", "pain_score")])
          document.getElementById(id).value =
            entry[id] || entry[id.replace("painScore", "pain_score")];
      });

      if (entry.recorded_at)
        document.getElementById("recordedAt").value = formatForDateTimeLocal(entry.recorded_at);
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load vital");
    }
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      patient_id: normalizeUUID(patientHidden.value),
      nurse_id: normalizeUUID(nurseHidden.value),
      organization_id: normalizeUUID(orgSelect?.value),
      facility_id: normalizeUUID(facSelect?.value),
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
      recorded_at: normalizeDateTime(document.getElementById("recordedAt")?.value),
    };

    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (!payload.bp) return showToast("❌ Blood Pressure is required");
    if (!payload.pulse) return showToast("❌ Pulse is required");
    if (!payload.rr) return showToast("❌ Respiration Rate is required");
    if (!payload.temp) return showToast("❌ Temperature is required");
    if (!payload.recorded_at) return showToast("❌ Recorded At is required");

    try {
      showLoading();
      const url = isEdit ? `/api/vitals/${vitalId}` : `/api/vitals`;
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
        isEdit ? "✅ Vital updated successfully" : "✅ Vital created successfully"
      );

      sessionStorage.removeItem("vitalEditId");
      sessionStorage.removeItem("vitalEditPayload");

      if (isEdit) window.location.href = "/vitals-list.html";
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
    sessionStorage.removeItem("vitalEditId");
    sessionStorage.removeItem("vitalEditPayload");
    window.location.href = "/vitals-list.html";
  });
  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("vitalEditId");
    sessionStorage.removeItem("vitalEditPayload");
    form.reset();
    setUI("add");
  });
}
