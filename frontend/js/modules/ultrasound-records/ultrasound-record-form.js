// 📁 ultrasound-record-form.js – Secure & Role-Aware Ultrasound Record Form
// ============================================================================
// 🔹 Rule-driven validation (ULTRASOUND_RECORD_FORM_RULES) ✅ ENFORCED
// 🔹 Role-aware org / facility handling (SUPER / ORG ADMIN / USER)
// 🔹 SELECT-based consultation & maternity
// 🔹 Patient + Technician via suggestion input
// 🔹 Auto-reload consultation & maternity by patient
// 🔹 Add + Edit parity (RESOLVED ONCE, EARLY)
// 🔹 Controller-faithful payload (NO silent mapping)
// 🔹 API calls PRESERVED
// 🔹 FULL MASTER PARITY with ekg-record-form.js
// 🔹 PAGE CONTROL DELEGATED TO ultrasound-main.js
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import {
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  loadBillableItemsLite,
  loadConsultationsLite,
  loadMaternityVisitsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { ULTRASOUND_RECORD_FORM_RULES } from "./ultrasound-record.form.rules.js";

/* ============================================================
   🧩 HELPERS
============================================================ */
const qs = (id) => document.getElementById(id);

const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

const normalizeDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const renderPatientLabel = (p) => {
  if (!p) return "";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return `${p.pat_no ? p.pat_no + " - " : ""}${full}`.trim();
};

/* ============================================================
   🛡️ RULE VALIDATION
============================================================ */
function validateUsingRules(form) {
  const errors = [];

  for (const rule of ULTRASOUND_RECORD_FORM_RULES) {
    if (typeof rule.when === "function" && !rule.when()) continue;

    const el =
      document.getElementById(rule.id) ||
      form.querySelector(`[name="${rule.id}"]`);

    if (!el) continue;

    const value = el.type === "checkbox" ? el.checked : el.value;

    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === false
    ) {
      errors.push({ field: rule.id, message: rule.message });
    }
  }

  return errors;
}

/* ============================================================
   🔐 EDIT PREFILL LOCK (PATIENT PARITY)
============================================================ */
let isPrefilling = false;

/* ============================================================
   🚀 MAIN FORM LOGIC (NO PAGE CONTROL)
============================================================ */
export async function setupUltrasoundFormSubmission({
  form,
  sharedState,
  resetForm,
}) {
  enableLiveValidation(form);

  /* ============================================================
     🔐 RESOLVE EDIT MODE ONCE (MASTER RULE)
  ============================================================ */
  const params = new URLSearchParams(window.location.search);

  const sessionId = sessionStorage.getItem("ultrasoundEditId");
  const payload = sessionStorage.getItem("ultrasoundEditPayload");

  const queryId =
    params.get("id") ||
    params.get("ultrasound_id") ||
    params.get("recordId");

  const recordId = sessionId || queryId;
  const isEdit = Boolean(recordId || payload);

  console.log("ULTRASOUND EDIT MODE:", {
    recordId,
    payloadExists: Boolean(payload),
    isEdit,
  });

  if (isEdit) {
    sharedState.currentEditIdRef.value = recordId;
  }

  /* ================= DOM ================= */
  const orgSelect = qs("organizationSelect");
  const facSelect = qs("facilitySelect");
  const deptSelect = qs("departmentSelect");
  const billableSelect = qs("billableItemSelect");

  const consultationSelect = qs("consultationSelect");
  const maternityVisitSelect = qs("maternityVisitSelect");

  const patientInput = qs("patientInput");
  const patientId = qs("patientId");
  const patientSuggestions = qs("patientSuggestions");

  const technicianInput = qs("technicianInput");
  const technicianId = qs("technicianId");
  const technicianSuggestions = qs("technicianSuggestions");

  /* ================= ROLE ================= */
  const role = (localStorage.getItem("userRole") || "").toLowerCase();
  const isSuper = role.includes("super");
  const isAdmin = role.includes("admin");

  /* ============================================================
     📥 LOAD REFERENCE DATA
  ============================================================ */
  try {
    if (isSuper) {
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
      );

      const reloadFacilities = async () => {
        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite(
            orgSelect.value ? { organization_id: orgSelect.value } : {},
            true
          ),
          "id",
          "name",
          "-- Select Facility --"
        );
      };

      await reloadFacilities();
      orgSelect?.addEventListener("change", reloadFacilities);
    } else if (isAdmin) {
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );
    }

    setupSelectOptions(
      deptSelect,
      await loadDepartmentsLite({}, true),
      "id",
      "name",
      "-- Select Department --"
    );

    setupSelectOptions(
      billableSelect,
      await loadBillableItemsLite({ category: "ultrasound" }, true),
      "id",
      "name",
      "-- Select Ultrasound Type --"
    );

    setupSelectOptions(
      consultationSelect,
      [],
      "id",
      "label",
      "-- Select Consultation --"
    );

    setupSelectOptions(
      maternityVisitSelect,
      [],
      "id",
      "visit_type",
      "-- Select Maternity Visit --"
    );

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (p) => {
        if (isPrefilling) return;

        patientId.value = p?.id || "";
        patientInput.value = p?.label || "";

        setupSelectOptions(
          consultationSelect,
          await loadConsultationsLite({ patient_id: p?.id }, true),
          "id",
          "label",
          "-- Select Consultation --"
        );

        setupSelectOptions(
          maternityVisitSelect,
          await loadMaternityVisitsLite({ patient_id: p?.id }, true),
          "id",
          "visit_type",
          "-- Select Maternity Visit --"
        );
      },
      "label"
    );

    setupSuggestionInputDynamic(
      technicianInput,
      technicianSuggestions,
      "/api/lite/employees",
      (t) => {
        if (isPrefilling) return;

        technicianId.value = t?.id || "";
        technicianInput.value = t?.full_name || "";
      },
      "full_name"
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE — PATIENT SAFE)
  ============================================================ */
  if (isEdit && recordId) {
    try {
      showLoading();
      isPrefilling = true;

      let entry =
        JSON.parse(
          sessionStorage.getItem("ultrasoundEditPayload") || "null"
        ) ||
        (await (await authFetch(`/api/ultrasound-records/${recordId}`)).json())
          .data;

      if (!entry) throw new Error();

      if (isSuper && entry.organization_id)
        orgSelect.value = entry.organization_id;

      if ((isSuper || isAdmin) && entry.facility_id)
        facSelect.value = entry.facility_id;

      setupSelectOptions(
        deptSelect,
        await loadDepartmentsLite({}, true),
        "id",
        "name",
        "-- Select Department --"
      );
      deptSelect.value = entry.department_id || "";

      setupSelectOptions(
        billableSelect,
        await loadBillableItemsLite({ category: "ultrasound" }, true),
        "id",
        "name",
        "-- Select Ultrasound Type --"
      );
      billableSelect.value = entry.billable_item_id || "";

      patientId.value = entry.patient_id || "";
      patientInput.value =
        entry.patient?.label || renderPatientLabel(entry.patient);

      setupSelectOptions(
        consultationSelect,
        await loadConsultationsLite({ patient_id: entry.patient_id }, true),
        "id",
        "label",
        "-- Select Consultation --"
      );
      consultationSelect.value = entry.consultation_id || "";

      setupSelectOptions(
        maternityVisitSelect,
        await loadMaternityVisitsLite({ patient_id: entry.patient_id }, true),
        "id",
        "visit_type",
        "-- Select Maternity Visit --"
      );
      maternityVisitSelect.value = entry.maternity_visit_id || "";

      technicianId.value = entry.technician_id || "";
      technicianInput.value = entry.technician?.full_name || "";

      qs("scanDate").value = normalizeDate(entry.scan_date);
      qs("scanLocation").value = entry.scan_location || "";
      qs("ultraFindings").value = entry.ultra_findings || "";
      qs("note").value = entry.note || "";
      qs("numberOfFetus").value = entry.number_of_fetus ?? "";
      qs("biparietalDiameter").value = entry.biparietal_diameter ?? "";
      qs("presentation").value = entry.presentation ?? "";
      qs("lie").value = entry.lie ?? "";
      qs("position").value = entry.position ?? "";
      qs("amnioticVolume").value = entry.amniotic_volume ?? "";
      qs("fetalHeartRate").value = entry.fetal_heart_rate ?? "";
      qs("gender").value = entry.gender ?? "";
      qs("previousCesarean").checked = !!entry.previous_cesarean;
      qs("prevCesDate").value = normalizeDate(entry.prev_ces_date);
      qs("prevCesLocation").value = entry.prev_ces_location || "";
      qs("cesareanDate").value = normalizeDate(entry.cesarean_date);
      qs("indication").value = entry.indication || "";
      qs("nextOfKin").value = entry.next_of_kin || "";
      qs("isEmergency").checked = !!entry.is_emergency;
    } catch {
      showToast("❌ Failed to load ultrasound record");
    } finally {
      isPrefilling = false;
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT — MASTER TENANT PARITY
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = validateUsingRules(form);
    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const url = isEdit
      ? `/api/ultrasound-records/${recordId}`
      : `/api/ultrasound-records`;

    const formData = new FormData(form);

    const orgId = normalizeUUID(
      isSuper
        ? orgSelect?.value
        : localStorage.getItem("organizationId")
    );

    const facId = normalizeUUID(
      isSuper || isAdmin
        ? facSelect?.value
        : localStorage.getItem("facilityId")
    );

    if (orgId) formData.set("organization_id", orgId);
    if (facId) formData.set("facility_id", facId);

    for (const [k, v] of formData.entries()) {
      if (v === "") formData.delete(k);
    }

    try {
      showLoading();

      const res = await authFetch(url, {
        method: isEdit ? "PUT" : "POST",
        body: formData,
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        applyServerErrors(form, result?.errors);
        throw new Error(result?.message || "Submission failed");
      }

      showToast(
        isEdit
          ? "✅ Ultrasound record updated"
          : "✅ Ultrasound record created"
      );

      sessionStorage.removeItem("ultrasoundEditId");
      sessionStorage.removeItem("ultrasoundEditPayload");

      if (isEdit) {
        window.location.href = "/ultrasound-records-list.html";
      } else {
        resetForm?.();
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };
}
