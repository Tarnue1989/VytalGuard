// 📁 ultrasoundRecord-form.js
// ============================================================
// 🧭 Secure & Role-Aware Ultrasound Record Form (Enterprise-Aligned)
// ============================================================

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
  loadDepartmentsLite,
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
function renderPatientLabel(p) {
  if (!p) return "";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return `${p.pat_no ? p.pat_no + " - " : ""}${full || p.full_name || ""}`.trim();
}

/* ============================================================
   🚀 Setup Ultrasound Record Form
============================================================ */
export async function setupUltrasoundFormSubmission({ form }) {
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("ultrasoundEditId");
  const queryId = getQueryParam("id");
  const recordId = sessionId || queryId;
  const isEdit = !!recordId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Ultrasound Record");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Ultrasound`);
    } else {
      titleEl && (titleEl.textContent = "Add Ultrasound Record");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Ultrasound`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🧭 Prefill Dropdowns & Suggestions
  ============================================================ */
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const billableSelect = document.getElementById("billableItemSelect");
  const regLogSelect = document.getElementById("registrationLogSelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const consultationInput = document.getElementById("consultationInput");
  const consultationHidden = document.getElementById("consultationId");
  const consultationSuggestions = document.getElementById("consultationSuggestions");

  const maternityInput = document.getElementById("maternityVisitInput");
  const maternityHidden = document.getElementById("maternityVisitId");
  const maternitySuggestions = document.getElementById("maternitySuggestions");

  const technicianInput = document.getElementById("technicianInput");
  const technicianHidden = document.getElementById("technicianId");
  const technicianSuggestions = document.getElementById("technicianSuggestions");

  try {
    // 🏢 Org + Facility
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      if (orgSelect) setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        if (facSelect)
          setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      if (facSelect)
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // 🧭 Departments
    if (deptSelect) {
      const depts = await loadDepartmentsLite({}, true);
      setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");
    }

    // 💲 Billable Items (Ultrasound scan types)
    const billables = await loadBillableItemsLite({ category: "ultrasound" }, true);
    if (billableSelect)
      setupSelectOptions(billableSelect, billables, "id", "name", "-- Select Ultrasound Type --");

    // 🧍 Patient suggestion
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (sel) => {
        patientHidden.value = sel?.id || "";
        patientInput.value =
          renderPatientLabel(sel) ||
          (sel?.label ||
            sel?.pat_no ||
            [sel?.first_name, sel?.last_name].filter(Boolean).join(" "));
      },
      "label"
    );

    // 📋 Consultation suggestion
    setupSuggestionInputDynamic(
      consultationInput,
      consultationSuggestions,
      "/api/lite/consultations",
      (sel) => {
        consultationHidden.value = sel?.id || "";
        consultationInput.value =
          sel?.label ||
          `Consultation (${sel?.status || "—"}) on ${normalizeDate(sel?.consultation_date) || "—"}`;
      },
      "label"
    );

    // 🤰 Maternity Visit suggestion
    setupSuggestionInputDynamic(
      maternityInput,
      maternitySuggestions,
      "/api/lite/maternity-visits",
      (sel) => {
        maternityHidden.value = sel?.id || "";
        maternityInput.value =
          sel?.label || `Visit on ${normalizeDate(sel?.visit_date) || "—"}`;
      },
      "label"
    );

    // 🧑‍⚕️ Technician suggestion
    setupSuggestionInputDynamic(
      technicianInput,
      technicianSuggestions,
      "/api/lite/employees",
      (sel) => {
        technicianHidden.value = sel?.id || "";
        technicianInput.value =
          sel?.full_name ||
          [sel?.first_name, sel?.last_name].filter(Boolean).join(" ");
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
  if (isEdit && recordId) {
    try {
      showLoading();
      const res = await authFetch(`/api/ultrasound-records/${recordId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();
      if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load record"));
      const entry = result?.data;
      if (!entry) return;

      // 🔹 Basic fields
      document.getElementById("scanDate").value = normalizeDate(entry.scan_date) || "";
      document.getElementById("scanLocation").value = entry.scan_location || "";
      document.getElementById("ultraFindings").value = entry.ultra_findings || "";
      document.getElementById("note").value = entry.note || "";
      document.getElementById("numberOfFetus").value = entry.number_of_fetus || "";
      document.getElementById("biparietalDiameter").value = entry.biparietal_diameter || "";
      document.getElementById("presentation").value = entry.presentation || "";
      document.getElementById("lie").value = entry.lie || "";
      document.getElementById("position").value = entry.position || "";
      document.getElementById("amnioticVolume").value = entry.amniotic_volume || "";
      document.getElementById("fetalHeartRate").value = entry.fetal_heart_rate || "";
      document.getElementById("gender").value = entry.gender || "";
      document.getElementById("previousCesarean").checked = !!entry.previous_cesarean;
      document.getElementById("prevCesDate").value = normalizeDate(entry.prev_ces_date) || "";
      document.getElementById("prevCesLocation").value = entry.prev_ces_location || "";
      document.getElementById("cesareanDate").value = normalizeDate(entry.cesarean_date) || "";
      document.getElementById("indication").value = entry.indication || "";
      document.getElementById("nextOfKin").value = entry.next_of_kin || "";
      document.getElementById("isEmergency").checked = !!entry.is_emergency;

      if (orgSelect && entry.organization_id) orgSelect.value = entry.organization_id;
      if (facSelect && entry.facility_id) facSelect.value = entry.facility_id;
      if (billableSelect && entry.billable_item_id)
        billableSelect.value = entry.billable_item_id;

      // 🔹 Prefill linked relations (with proper label + name)
      if (entry.patient) {
        patientHidden.value = entry.patient.id || "";
        patientInput.value = renderPatientLabel(entry.patient);
      }
      if (entry.consultation) {
        consultationHidden.value = entry.consultation.id || "";
        consultationInput.value =
          `Consultation (${entry.consultation.status || "—"}) on ${
            normalizeDate(entry.consultation.consultation_date) || "—"
          }`;
      }
      if (entry.maternityVisit) {
        maternityHidden.value = entry.maternityVisit.id || "";
        maternityInput.value =
          `Visit on ${normalizeDate(entry.maternityVisit.visit_date) || "—"}`;
      }
      if (entry.technician) {
        technicianHidden.value = entry.technician.id || "";
        technicianInput.value =
          [entry.technician.first_name, entry.technician.last_name].filter(Boolean).join(" ") ||
          entry.technician.full_name ||
          "";
      }

      setUI("edit");
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load ultrasound record");
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
      consultation_id: normalizeUUID(consultationHidden.value),
      maternity_visit_id: normalizeUUID(maternityHidden.value),
      technician_id: normalizeUUID(technicianHidden.value),
      organization_id: normalizeUUID(orgSelect?.value || localStorage.getItem("organizationId")),
      facility_id: normalizeUUID(facSelect?.value || localStorage.getItem("facilityId")),
      billable_item_id: normalizeUUID(billableSelect?.value),
      registration_log_id: normalizeUUID(regLogSelect?.value),
      scan_date: document.getElementById("scanDate")?.value || null,
      scan_location: document.getElementById("scanLocation")?.value || null,
      ultra_findings: document.getElementById("ultraFindings")?.value || null,
      note: document.getElementById("note")?.value || null,
      number_of_fetus:
        parseInt(document.getElementById("numberOfFetus")?.value || 0, 10) || null,
      biparietal_diameter:
        parseFloat(document.getElementById("biparietalDiameter")?.value || 0) || null,
      presentation: document.getElementById("presentation")?.value || null,
      lie: document.getElementById("lie")?.value || null,
      position: document.getElementById("position")?.value || null,
      amniotic_volume:
        parseFloat(document.getElementById("amnioticVolume")?.value || 0) || null,
      fetal_heart_rate:
        parseInt(document.getElementById("fetalHeartRate")?.value || 0, 10) || null,
      gender: document.getElementById("gender")?.value || null,
      previous_cesarean: document.getElementById("previousCesarean")?.checked || false,
      prev_ces_date: document.getElementById("prevCesDate")?.value || null,
      prev_ces_location: document.getElementById("prevCesLocation")?.value || null,
      cesarean_date: document.getElementById("cesareanDate")?.value || null,
      indication: document.getElementById("indication")?.value || null,
      next_of_kin: document.getElementById("nextOfKin")?.value || null,
      is_emergency: document.getElementById("isEmergency")?.checked || false,
    };

    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (!payload.billable_item_id) return showToast("❌ Scan Type is required");
    if (!payload.scan_date) return showToast("❌ Scan Date is required");

    try {
      showLoading();
      const url = isEdit
        ? `/api/ultrasound-records/${recordId}`
        : `/api/ultrasound-records`;
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
          ? "✅ Ultrasound record updated successfully"
          : "✅ Ultrasound record created successfully"
      );

      sessionStorage.removeItem("ultrasoundEditId");
      sessionStorage.removeItem("ultrasoundEditPayload");

      if (isEdit) window.location.href = "/ultrasound-records-list.html";
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
    sessionStorage.removeItem("ultrasoundEditId");
    sessionStorage.removeItem("ultrasoundEditPayload");
    window.location.href = "/ultrasound-records-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("ultrasoundEditId");
    sessionStorage.removeItem("ultrasoundEditPayload");
    form.reset();
    setUI("add");
  });
}

/* ============================================================
   🧭 DOM Ready Wrapper
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("ultrasoundRecordForm");
  if (form) await setupUltrasoundFormSubmission({ form });
});
