// 📦 surgery-form.js – Enterprise Role-Aware Surgery Form (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors centralstock-form.js for secure, role-aware behavior
// 🔹 Keeps all working logic and IDs intact
// 🔹 Adds auth guard, logout watcher, consistent helpers, and visibility logic
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
  loadConsultationsLite,
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

function formatForDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

/* ============================================================
   🚀 Main Form Setup
============================================================ */
export async function setupSurgeryFormSubmission({ form }) {
  // 🔐 Auth Guard + Logout Watcher
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("surgeryEditId");
  const queryId = getQueryParam("id");
  const recordId = sessionId || queryId;
  const isEdit = !!recordId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");

  const setAddModeUI = () => {
    if (titleEl) titleEl.textContent = "Add Surgery";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Surgery`;
  };
  const setEditModeUI = () => {
    if (titleEl) titleEl.textContent = "Edit Surgery";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Surgery`;
  };
  isEdit ? setEditModeUI() : setAddModeUI();

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const consultationSelect = document.getElementById("consultationSelect");

  const surgeonInput = document.getElementById("surgeonInput");
  const surgeonHidden = document.getElementById("surgeonId");
  const surgeonSuggestions = document.getElementById("surgeonSuggestions");

  const billableSelect = document.getElementById("billableItemSelect");
  const deptSelect = document.getElementById("departmentSelect");
  const anesthesiaSelect = document.getElementById("anesthesiaType");

  /* ============================================================
     📦 Load Reference Data (Role-Aware)
  ============================================================ */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    if (userRole.includes("super")) {
      // 🏢 Super Admin → can select org & facility
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
      // 🧑‍💼 Admin → facility only (org auto)
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else if (userRole.includes("facilityhead")) {
      // 👨‍🏫 Facility Head → both hidden
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    } else if (userRole.includes("orgowner")) {
      // 🏛 Org Owner → hide org & facility
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    } else {
      // 👨‍⚕️ Doctor/nurse/staff → hide both
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // 🧠 Patient suggestion + consultation reload
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (sel) => {
        patientHidden.value = sel?.id || "";
        patientInput.value = sel?.label || "";
        if (sel?.id) await reloadConsultations(sel.id);
        else setupSelectOptions(consultationSelect, [], "id", "g_code", "-- Select Consultation --");
      },
      "label"
    );

    // 🧑‍⚕️ Surgeon suggestion
    setupSuggestionInputDynamic(
      surgeonInput,
      surgeonSuggestions,
      "/api/lite/employees",
      (sel) => {
        surgeonHidden.value = sel?.id || "";
        surgeonInput.value = sel?.full_name || "";
      },
      "full_name"
    );

    // 💰 Billable items (surgery category)
    const billables = await loadBillableItemsLite({ category: "surgery" }, true);
    setupSelectOptions(billableSelect, billables, "id", "name", "-- Select Surgery Type --");

    // 💉 Anesthesia Types
    const anesthesiaTypes = [
      { id: "general", name: "General" },
      { id: "regional", name: "Regional" },
      { id: "local", name: "Local" },
      { id: "sedation", name: "Sedation / Monitored" },
      { id: "other", name: "Other" },
    ];
    setupSelectOptions(anesthesiaSelect, anesthesiaTypes, "id", "name", "-- Select Anesthesia --");
  } catch (err) {
    console.error("❌ Dropdown load error:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     🔁 Helper – Reload Consultations by Patient
  ============================================================ */
  async function reloadConsultations(patientId) {
    if (!consultationSelect) return;
    if (!patientId) {
      setupSelectOptions(consultationSelect, [], "id", "g_code", "-- Select Consultation --");
      return;
    }
    try {
      const records = await loadConsultationsLite({
        patient_id: patientId,
        status: "open,in_progress",
      });
      setupSelectOptions(records, records, "id", "label", "-- Select Consultation --");
    } catch (err) {
      console.error("❌ Consultation load error:", err);
      showToast("❌ Failed to load consultations");
    }
  }

  /* ============================================================
     ✏️ Prefill (Edit Mode)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();
      let entry = null;
      const raw = sessionStorage.getItem("surgeryEditPayload");
      if (raw) entry = JSON.parse(raw);
      if (!entry) {
        const res = await authFetch(`/api/surgeries/${recordId}`);
        const result = await res.json();
        entry = result?.data;
        if (!res.ok || !entry) throw new Error(normalizeMessage(result, "❌ Failed to load surgery"));
      }

      // Prefill linked entities
      if (entry.patient?.id) {
        patientHidden.value = entry.patient.id;
        patientInput.value =
          (entry.patient.pat_no ? entry.patient.pat_no + " - " : "") +
          [entry.patient.first_name, entry.patient.last_name].filter(Boolean).join(" ");
        await reloadConsultations(entry.patient.id);
      }

      if (entry.surgeon?.id) {
        surgeonHidden.value = entry.surgeon.id;
        surgeonInput.value =
          [entry.surgeon.first_name, entry.surgeon.last_name].filter(Boolean).join(" ");
      }

      if (entry.consultation?.id) consultationSelect.value = entry.consultation.id;

      // Prefill simple fields
      document.getElementById("scheduledDate").value = entry.scheduled_date
        ? formatForDate(entry.scheduled_date)
        : "";
      document.getElementById("durationMinutes").value = entry.duration_minutes || "";
      if (entry.anesthesia_type && anesthesiaSelect)
        anesthesiaSelect.value = entry.anesthesia_type;
      document.getElementById("complications").value = entry.complications || "";
      document.getElementById("notes").value = entry.notes || "";
      document.getElementById("isEmergency").checked = entry.is_emergency || false;

      if (entry.organization_id && orgSelect) orgSelect.value = entry.organization_id;
      if (entry.facility_id && facSelect) facSelect.value = entry.facility_id;
      if (entry.billable_item_id && billableSelect) billableSelect.value = entry.billable_item_id;
      if (entry.department_id && deptSelect) deptSelect.value = entry.department_id;

      setEditModeUI();
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load surgery record");
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
      consultation_id: normalizeUUID(consultationSelect?.value),
      surgeon_id: normalizeUUID(surgeonHidden.value),
      organization_id: normalizeUUID(orgSelect?.value || localStorage.getItem("organizationId")),
      facility_id: normalizeUUID(facSelect?.value || localStorage.getItem("facilityId")),
      billable_item_id: normalizeUUID(billableSelect?.value),
      department_id: normalizeUUID(deptSelect?.value),
      scheduled_date: document.getElementById("scheduledDate")?.value || null,
      duration_minutes:
        parseInt(document.getElementById("durationMinutes")?.value || 0, 10) || null,
      anesthesia_type: anesthesiaSelect?.value || null,
      complications: document.getElementById("complications")?.value || null,
      notes: document.getElementById("notes")?.value || null,
      is_emergency: document.getElementById("isEmergency")?.checked || false,
    };

    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (!payload.surgeon_id) return showToast("❌ Surgeon is required");
    if (!payload.billable_item_id) return showToast("❌ Surgery Type is required");
    if (!payload.scheduled_date) return showToast("❌ Scheduled Date is required");

    const url = isEdit ? `/api/surgeries/${recordId}` : `/api/surgeries`;
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
        showToast("✅ Surgery updated successfully");
        sessionStorage.removeItem("surgeryEditId");
        sessionStorage.removeItem("surgeryEditPayload");
        window.location.href = "/surgeries-list.html";
      } else {
        showToast("✅ Surgery created successfully");
        form.reset();
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
     ❌ Clear + Cancel
  ============================================================ */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("surgeryEditId");
    sessionStorage.removeItem("surgeryEditPayload");
    form.reset();
    patientHidden.value = "";
    consultationSelect.value = "";
    surgeonHidden.value = "";
    if (anesthesiaSelect) anesthesiaSelect.value = "";
    setAddModeUI();
  });

  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("surgeryEditId");
    sessionStorage.removeItem("surgeryEditPayload");
    window.location.href = "/surgeries-list.html";
  });
}
