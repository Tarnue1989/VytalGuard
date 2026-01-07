// 📁 maternityVisit-form.js
// ============================================================
// 🧭 Secure & Role-Aware Maternity Visit Form (Enterprise-Aligned)
// ============================================================

import {
  showToast,
  showLoading,
  hideLoading,
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
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function renderPatientLabel(p) {
  if (!p) return "";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return `${p.pat_no ? p.pat_no + " - " : ""}${full || p.full_name || ""}`.trim();
}

function validateRanges(payload) {
  if (payload.blood_pressure) {
    const parts = payload.blood_pressure.split("/");
    if (parts.length !== 2 || parts.some((p) => isNaN(p)))
      return "❌ Blood Pressure must be in format 120/80";
  }
  return null;
}

/* ============================================================
   🚀 Setup Maternity Visit Form
============================================================ */
export async function setupMaternityVisitFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("maternityVisitEditId");
  const queryId = getQueryParam("id");
  const visitId = sessionId || queryId;
  const isEdit = !!visitId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Maternity Visit");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Maternity Visit`);
    } else {
      titleEl && (titleEl.textContent = "Add Maternity Visit");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Maternity Visit`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📎 DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const doctorInput = document.getElementById("doctorInput");
  const doctorHidden = document.getElementById("doctorId");
  const doctorSuggestions = document.getElementById("doctorSuggestions");
  const doctorGroup = document.getElementById("doctorFieldGroup");

  const midwifeInput = document.getElementById("midwifeInput");
  const midwifeHidden = document.getElementById("midwifeId");
  const midwifeSuggestions = document.getElementById("midwifeSuggestions");

  const visitTypeSelect = document.getElementById("visitTypeSelect");
  const regLogSelect = document.getElementById("registrationLogSelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🧭 Dropdowns & Suggestions
  ============================================================ */
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
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (sel) => {
        patientHidden.value = sel?.id || "";
        patientInput.value = renderPatientLabel(sel);
      },
      "label"
    );

    if (userRole.includes("super")) {
      doctorGroup?.classList.remove("hidden");
      setupSuggestionInputDynamic(
        doctorInput,
        doctorSuggestions,
        "/api/lite/employees",
        (sel) => {
          doctorHidden.value = sel?.id || "";
          doctorInput.value =
            sel?.full_name ||
            [sel?.first_name, sel?.last_name].filter(Boolean).join(" ");
        },
        "full_name"
      );
    } else {
      doctorGroup?.classList.add("hidden");
      doctorHidden.value = localStorage.getItem("employeeId") || "";
    }

    setupSuggestionInputDynamic(
      midwifeInput,
      midwifeSuggestions,
      "/api/lite/employees",
      (sel) => {
        midwifeHidden.value = sel?.id || "";
        midwifeInput.value =
          sel?.full_name ||
          [sel?.first_name, sel?.last_name].filter(Boolean).join(" ");
      },
      "full_name"
    );

    const visitTypes = await loadBillableItemsLite({ category: "maternity-visit" }, true);
    setupSelectOptions(visitTypeSelect, visitTypes, "id", "name", "-- Select Visit Type --");
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     ✏️ Prefill (Edit Mode)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();
      const res = await authFetch(`/api/maternity-visits/${visitId}`);
      const result = await res.json();
      if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load visit"));
      const e = result.data;

      document.getElementById("visitDate").value = normalizeDate(e.visit_date);
      document.getElementById("lnmp").value = normalizeDate(e.lnmp);
      document.getElementById("expectedDueDate").value = normalizeDate(e.expected_due_date);
      document.getElementById("estimatedGestAge").value = e.estimated_gestational_age || "";
      document.getElementById("fundusHeight").value = e.fundus_height || "";
      document.getElementById("fetalHeartRate").value = e.fetal_heart_rate || "";
      document.getElementById("presentation").value = e.presentation || "";
      document.getElementById("position").value = e.position || "";
      document.getElementById("complaint").value = e.complaint || "";
      document.getElementById("gravida").value = e.gravida || "";
      document.getElementById("para").value = e.para || "";
      document.getElementById("abortion").value = e.abortion || "";
      document.getElementById("living").value = e.living || "";
      document.getElementById("visitNotes").value = e.visit_notes || "";
      document.getElementById("bloodPressure").value = e.blood_pressure || "";
      document.getElementById("weight").value = e.weight || "";
      document.getElementById("height").value = e.height || "";
      document.getElementById("temperature").value = e.temperature || "";
      document.getElementById("pulseRate").value = e.pulse_rate || "";

      if (e.patient) {
        patientHidden.value = e.patient.id;
        patientInput.value = renderPatientLabel(e.patient);
      }
      if (e.doctor) {
        doctorHidden.value = e.doctor.id;
        doctorInput.value = e.doctor.full_name || "";
      }
      if (e.midwife) {
        midwifeHidden.value = e.midwife.id;
        midwifeInput.value = e.midwife.full_name || "";
      }
      if (e.billable_item_id) visitTypeSelect.value = e.billable_item_id;

      setUI("edit");
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load maternity visit");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💾 Submit
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();

    const payload = {
      patient_id: normalizeUUID(patientHidden.value),
      doctor_id: normalizeUUID(doctorHidden.value),
      midwife_id: normalizeUUID(midwifeHidden.value),
      organization_id: normalizeUUID(orgSelect?.value || localStorage.getItem("organizationId")),
      facility_id: normalizeUUID(facSelect?.value || localStorage.getItem("facilityId")),
      billable_item_id: normalizeUUID(visitTypeSelect?.value),
      visit_date: document.getElementById("visitDate")?.value || null,
      lnmp: document.getElementById("lnmp")?.value || null,
      expected_due_date: document.getElementById("expectedDueDate")?.value || null,
      estimated_gestational_age: document.getElementById("estimatedGestAge")?.value || null,
      fundus_height: document.getElementById("fundusHeight")?.value || null,
      fetal_heart_rate: document.getElementById("fetalHeartRate")?.value || null,
      presentation: document.getElementById("presentation")?.value || null,
      position: document.getElementById("position")?.value || null,
      complaint: document.getElementById("complaint")?.value || null,
      gravida: parseInt(document.getElementById("gravida")?.value || 0, 10) || null,
      para: parseInt(document.getElementById("para")?.value || 0, 10) || null,
      abortion: parseInt(document.getElementById("abortion")?.value || 0, 10) || null,
      living: parseInt(document.getElementById("living")?.value || 0, 10) || null,
      visit_notes: document.getElementById("visitNotes")?.value || null,
      blood_pressure: document.getElementById("bloodPressure")?.value || null,
      weight: parseFloat(document.getElementById("weight")?.value || 0) || null,
      height: parseFloat(document.getElementById("height")?.value || 0) || null,
      temperature: parseFloat(document.getElementById("temperature")?.value || 0) || null,
      pulse_rate: parseInt(document.getElementById("pulseRate")?.value || 0, 10) || null,
      is_emergency: document.getElementById("isEmergency")?.checked || false,
    };

    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (userRole.includes("super")) {
      if (!payload.doctor_id && !payload.midwife_id) {
        return showToast("❌ Doctor or Midwife is required");
      }
    }

    if (!payload.billable_item_id) return showToast("❌ Visit Type is required");
    if (!payload.visit_date) return showToast("❌ Visit Date is required");

    const rangeError = validateRanges(payload);
    if (rangeError) return showToast(rangeError);

    try {
      showLoading();
      const res = await authFetch(
        isEdit ? `/api/maternity-visits/${visitId}` : `/api/maternity-visits`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(normalizeMessage(result, "Submission failed"));

      showToast(isEdit ? "✅ Maternity visit updated" : "✅ Maternity visit created");

      sessionStorage.removeItem("maternityVisitEditId");
      sessionStorage.removeItem("maternityVisitEditPayload");

      if (isEdit) window.location.href = "/maternity-visits-list.html";
      else {
        form.reset();
        setUI("add");
      }
    } catch (err) {
      console.error("❌ Submit error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("maternityVisitEditId");
    sessionStorage.removeItem("maternityVisitEditPayload");
    form.reset();
    setUI("add");
  });

  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("maternityVisitEditId");
    sessionStorage.removeItem("maternityVisitEditPayload");
    window.location.href = "/maternity-visits-list.html";
  });
}
