// 📦 ultrasound-main.js – Ultrasound Record Form (Add/Edit) Page Controller (Enterprise-Aligned)

import { setupUltrasoundFormSubmission } from "./ultrasound-record-form.js";
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
   🔐 Auth Guard – Secure Session
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧩 Helper
============================================================ */
function renderPatientLabel(p) {
  if (!p) return "";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return `${p.pat_no ? p.pat_no + " - " : ""}${full || p.full_name || ""}`.trim();
}

/* ============================================================
   🧹 Reset Form (Safe Default)
============================================================ */
function resetForm() {
  const form = document.getElementById("ultrasoundRecordForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Hidden fields reset
  ["patientId", "consultationId", "maternityVisitId", "technicianId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Dropdowns reset
  ["organizationSelect", "facilitySelect", "billableItemSelect", "registrationLogSelect"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
  );

  // UI reset
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Ultrasound Record";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Ultrasound`;
}

/* ============================================================
   🚀 Main Init (DOM Ready)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("ultrasoundRecordForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const billableSelect = document.getElementById("billableItemSelect");
  const regLogSelect = document.getElementById("registrationLogSelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* --------------------- Organization & Facility --------------------- */
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      if (orgSelect)
        setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      orgSelect?.addEventListener("change", async () => {
        const orgId = orgSelect.value;
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        if (facSelect)
          setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      });

      const facs = await loadFacilitiesLite({}, true);
      if (facSelect)
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      if (facSelect)
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility");
  }

  /* --------------------------- Billable Items --------------------------- */
  try {
    const billables = await loadBillableItemsLite({ category: "ultrasound" }, true);
    if (billableSelect)
      setupSelectOptions(billableSelect, billables, "id", "name", "-- Select Ultrasound Type --");
  } catch (err) {
    console.error("❌ Billable items preload failed:", err);
  }

  /* -------------------- Suggestion Inputs -------------------- */
  setupSuggestionInputDynamic(
    document.getElementById("patientInput"),
    document.getElementById("patientSuggestions"),
    "/api/lite/patients",
    (sel) => {
      const idEl = document.getElementById("patientId");
      const inputEl = document.getElementById("patientInput");
      if (!idEl || !inputEl) return;
      idEl.value = sel?.id || "";
      inputEl.value = renderPatientLabel(sel);
    },
    "label"
  );

  setupSuggestionInputDynamic(
    document.getElementById("consultationInput"),
    document.getElementById("consultationSuggestions"),
    "/api/lite/consultations",
    (sel) => {
      const idEl = document.getElementById("consultationId");
      const inputEl = document.getElementById("consultationInput");
      if (idEl) idEl.value = sel?.id || "";
      if (inputEl)
        inputEl.value =
          sel?.label ||
          `Consultation (${sel?.status || "—"}) on ${
            sel?.consultation_date?.split("T")[0] || "—"
          }`;
    },
    "label"
  );

  setupSuggestionInputDynamic(
    document.getElementById("maternityVisitInput"),
    document.getElementById("maternitySuggestions"),
    "/api/lite/maternity-visits",
    (sel) => {
      const idEl = document.getElementById("maternityVisitId");
      const inputEl = document.getElementById("maternityVisitInput");
      if (idEl) idEl.value = sel?.id || "";
      if (inputEl)
        inputEl.value = sel?.label || `Visit on ${sel?.visit_date?.split("T")[0] || "—"}`;
    },
    "label"
  );

  setupSuggestionInputDynamic(
    document.getElementById("technicianInput"),
    document.getElementById("technicianSuggestions"),
    "/api/lite/employees",
    (sel) => {
      const idEl = document.getElementById("technicianId");
      const inputEl = document.getElementById("technicianInput");
      if (idEl) idEl.value = sel?.id || "";
      if (inputEl)
        inputEl.value =
          sel?.full_name || [sel?.first_name, sel?.last_name].filter(Boolean).join(" ");
    },
    "full_name"
  );

  /* -------------------- Form Setup & Submission -------------------- */
  await setupUltrasoundFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* --------------------------- Edit Mode --------------------------- */
  const editId = sessionStorage.getItem("ultrasoundEditId");
  const rawPayload = sessionStorage.getItem("ultrasoundEditPayload");

  async function applyPrefill(entry) {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
    const setDate = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v.split("T")[0]; };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

    // 🩻 Basic fields
    setDate("scanDate", entry.scan_date);
    setVal("scanLocation", entry.scan_location);
    setVal("ultraFindings", entry.ultra_findings);
    setVal("note", entry.note);
    setVal("numberOfFetus", entry.number_of_fetus);
    setVal("biparietalDiameter", entry.biparietal_diameter);
    setVal("presentation", entry.presentation);
    setVal("lie", entry.lie);
    setVal("position", entry.position);
    setVal("amnioticVolume", entry.amniotic_volume);
    setVal("fetalHeartRate", entry.fetal_heart_rate);
    setVal("gender", entry.gender);
    setChk("previousCesarean", entry.previous_cesarean);
    setDate("prevCesDate", entry.prev_ces_date);
    setVal("prevCesLocation", entry.prev_ces_location);
    setDate("cesareanDate", entry.cesarean_date);
    setVal("indication", entry.indication);
    setVal("nextOfKin", entry.next_of_kin);
    setChk("isEmergency", entry.is_emergency);

    // 🏢 Linked dropdowns
    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      const facs = await loadFacilitiesLite({ organization_id: entry.organization.id }, true);
      if (facSelect) setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }
    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;
    if (entry.billableItem?.id && billableSelect) billableSelect.value = entry.billableItem.id;
    if (entry.registrationLog?.id && regLogSelect) regLogSelect.value = entry.registrationLog.id;

    // 🧍‍♂️ Linked entities
    if (entry.patient) {
      const i = document.getElementById("patientInput");
      const h = document.getElementById("patientId");
      h.value = entry.patient.id || "";
      i.value = renderPatientLabel(entry.patient);
    }
    if (entry.consultation) {
      const i = document.getElementById("consultationInput");
      const h = document.getElementById("consultationId");
      h.value = entry.consultation.id || "";
      i.value = `Consultation (${entry.consultation.status || "—"}) on ${
        entry.consultation.consultation_date?.split("T")[0] || "—"
      }`;
    }
    if (entry.maternityVisit) {
      const i = document.getElementById("maternityVisitInput");
      const h = document.getElementById("maternityVisitId");
      h.value = entry.maternityVisit.id || "";
      i.value = `Visit on ${entry.maternityVisit.visit_date?.split("T")[0] || "—"}`;
    }
    if (entry.technician) {
      const i = document.getElementById("technicianInput");
      const h = document.getElementById("technicianId");
      h.value = entry.technician.id || "";
      i.value =
        [entry.technician.first_name, entry.technician.last_name].filter(Boolean).join(" ") ||
        entry.technician.full_name ||
        "";
    }

    // 🧭 UI mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Ultrasound Record";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Ultrasound`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached ultrasound record for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/ultrasound-records/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch ultrasound record");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load ultrasound record:", err);
        showToast(err.message || "❌ Failed to load ultrasound record for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ------------------------- Cancel & Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("ultrasoundEditId");
    sessionStorage.removeItem("ultrasoundEditPayload");
    window.location.href = "/ultrasound-records-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("ultrasoundEditId");
    sessionStorage.removeItem("ultrasoundEditPayload");
    resetForm();
  });
});
