// 📦 ekg-record-form.js – Secure + Role-Aware EKG Record Form (Master Pattern)

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
   🚀 Main Form Setup
============================================================ */
export async function setupEKGRecordFormSubmission({ form }) {
  // 🔐 Auth Guard + Logout Watcher
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("ekgRecordEditId");
  const queryId = getQueryParam("id");
  const ekgId = sessionId || queryId;
  const isEdit = !!ekgId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");

  function setAddModeUI() {
    if (titleEl) titleEl.textContent = "Add EKG Record";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit`;
  }
  function setEditModeUI() {
    if (titleEl) titleEl.textContent = "Edit EKG Record";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Record`;
  }
  isEdit ? setEditModeUI() : setAddModeUI();

  // 📋 DOM Refs
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");
  const technicianInput = document.getElementById("technicianInput");
  const technicianHidden = document.getElementById("technicianId");
  const technicianSuggestions = document.getElementById("technicianSuggestions");
  const registrationLogSelect = document.getElementById("registrationLogSelect");
  const consultationSelect = document.getElementById("consultationSelect");
  const billableSelect = document.getElementById("billableItemSelect");

  /* ============================================================
     📡 Helper → Load Registration Logs for Patient
  ============================================================ */
  async function reloadRegistrationLogs(patientId, preselectId = null) {
    if (!patientId) {
      setupSelectOptions(registrationLogSelect, [], "id", "label", "-- Select Registration Log --");
      return;
    }
    try {
      const res = await authFetch(`/api/lite/registration-logs?patient_id=${patientId}&status=active`);
      const regLogs = await res.json();
      const logs = regLogs?.data?.records || regLogs?.data || [];
      const logOptions = logs.map((l) => {
        const d = l.registration_time ? new Date(l.registration_time) : null;
        const dateLabel = d
          ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
          : "";
        return {
          id: l.id,
          label: [l.patient || "", dateLabel].filter(Boolean).join(" | "),
        };
      });
      setupSelectOptions(registrationLogSelect, logOptions, "id", "label", "-- Select Registration Log --");
      if (preselectId) registrationLogSelect.value = preselectId;
    } catch (err) {
      console.error("❌ Failed to load registration logs:", err);
      setupSelectOptions(registrationLogSelect, [], "id", "label", "-- Select Registration Log --");
    }
  }

  /* ============================================================
     🧭 Prefill Dropdowns (Role-Aware)
  ============================================================ */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    if (userRole.includes("super")) {
      // 🏢 Super Admin → can select any org/facility
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
      // 🧑‍💼 Admin → facility only (org auto, hidden)
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else if (userRole.includes("facilityhead")) {
      // 👨‍🏫 Facility Head → both hidden
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    } else if (userRole.includes("orgowner")) {
      // 🏛 Org Owner → both hidden
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    } else {
      // 👨‍⚕️ Doctor, nurse, staff → both hidden
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // 👩‍⚕️ Patient suggestions
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
        reloadRegistrationLogs(patientHidden.value);
      },
      "label"
    );

    // 🧑‍🔬 Technician suggestions
    setupSuggestionInputDynamic(
      technicianInput,
      technicianSuggestions,
      "/api/lite/employees",
      (selected) => {
        technicianHidden.value = selected?.id || "";
        if (selected)
          technicianInput.value =
            selected.full_name ||
            `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
      },
      "full_name"
    );

    // 💓 Billable EKG items
    const ekgItems = await loadBillableItemsLite({ category: "ekg" }, true);
    setupSelectOptions(billableSelect, ekgItems, "id", "name", "-- Select EKG Item --");
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     ✏️ Prefill if Editing
  ============================================================ */
  if (isEdit && ekgId) {
    try {
      showLoading();
      const raw = sessionStorage.getItem("ekgRecordEditPayload");
      let entry = raw ? JSON.parse(raw) : null;

      if (!entry) {
        const res = await authFetch(`/api/ekg-records/${ekgId}`);
        const result = await res.json();
        entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(normalizeMessage(result, "❌ Failed to load EKG record"));
      }

      // 🔁 Fill inputs
      document.getElementById("recordedDate").value = entry.recorded_date ? normalizeDate(entry.recorded_date) : "";
      document.getElementById("heartRate").value = entry.heart_rate || "";
      document.getElementById("prInterval").value = entry.pr_interval || "";
      document.getElementById("qrsDuration").value = entry.qrs_duration || "";
      document.getElementById("qtInterval").value = entry.qt_interval || "";
      document.getElementById("axis").value = entry.axis || "";
      document.getElementById("rhythm").value = entry.rhythm || "";
      document.getElementById("interpretation").value = entry.interpretation || "";
      document.getElementById("recommendation").value = entry.recommendation || "";
      document.getElementById("note").value = entry.note || "";

      if (entry.organization_id && orgSelect) orgSelect.value = entry.organization_id;
      if (entry.facility_id && facSelect) facSelect.value = entry.facility_id;
      if (entry.billable_item_id) billableSelect.value = entry.billable_item_id;
      if (entry.registration_log_id) await reloadRegistrationLogs(entry.patient_id, entry.registration_log_id);

      if (entry.patient) {
        patientHidden.value = entry.patient.id;
        patientInput.value =
          entry.patient.label ||
          `${entry.patient.pat_no || ""} ${entry.patient.full_name || ""}`.trim();
      }
      if (entry.technician) {
        technicianHidden.value = entry.technician.id;
        technicianInput.value =
          entry.technician.full_name ||
          `${entry.technician.first_name || ""} ${entry.technician.last_name || ""}`.trim();
      }

      setEditModeUI();
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load EKG record");
    } finally {
      hideLoading();
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
      technician_id: normalizeUUID(technicianHidden.value),
      organization_id: normalizeUUID(orgSelect?.value || localStorage.getItem("organizationId")),
      facility_id: normalizeUUID(facSelect?.value || localStorage.getItem("facilityId")),
      billable_item_id: normalizeUUID(billableSelect?.value),
      registration_log_id: normalizeUUID(registrationLogSelect?.value),
      consultation_id: normalizeUUID(consultationSelect?.value),
      recorded_date: document.getElementById("recordedDate")?.value || null,
      heart_rate: document.getElementById("heartRate")?.value || null,
      pr_interval: document.getElementById("prInterval")?.value || null,
      qrs_duration: document.getElementById("qrsDuration")?.value || null,
      qt_interval: document.getElementById("qtInterval")?.value || null,
      axis: document.getElementById("axis")?.value || null,
      rhythm: document.getElementById("rhythm")?.value || null,
      interpretation: document.getElementById("interpretation")?.value || null,
      recommendation: document.getElementById("recommendation")?.value || null,
      note: document.getElementById("note")?.value || null,
      is_emergency: document.getElementById("isEmergency")?.checked || false,
    };

    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (!payload.billable_item_id) return showToast("❌ Billable Item is required");
    if (!payload.recorded_date) return showToast("❌ Recorded Date is required");

    const url = isEdit ? `/api/ekg-records/${ekgId}` : `/api/ekg-records`;
    const method = isEdit ? "PUT" : "POST";

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ EKG Record updated successfully");
        sessionStorage.removeItem("ekgRecordEditId");
        sessionStorage.removeItem("ekgRecordEditPayload");
        window.location.href = "/ekg-records-list.html";
      } else {
        showToast("✅ EKG Record created successfully");
        form.reset();
        setupSelectOptions(registrationLogSelect, [], "id", "label", "-- Select Registration Log --");
        setAddModeUI();
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🔙 Cancel / Clear Handlers
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("ekgRecordEditId");
    sessionStorage.removeItem("ekgRecordEditPayload");
    window.location.href = "/ekg-records-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("ekgRecordEditId");
    sessionStorage.removeItem("ekgRecordEditPayload");
    form.reset();
    patientHidden.value = "";
    technicianHidden.value = "";
    setupSelectOptions(registrationLogSelect, [], "id", "label", "-- Select Registration Log --");
    setAddModeUI();
  });
}
