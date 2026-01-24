// 📁 triageRecord-form.js – Secure & Role-Aware Triage Record Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Master Pattern: vital-form.js
// 🔹 Rule-driven validation (TRIAGE_RECORD_FORM_RULES) — SAME ENGINE AS VITAL / EKG
// 🔹 Role-aware org / facility handling (super / org / facility)
// 🔹 Suggestion inputs (patient / doctor / nurse)
// 🔹 Add + Edit parity (SESSION + QUERY)
// 🔹 Controller-faithful payload (NO silent mapping)
// 🔹 EDIT → redirect | CREATE → stay on form (MASTER PARITY)
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
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
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import {
  resolveUserRole,
  getOrganizationId,
  getFacilityId,
} from "../../utils/roleResolver.js";

import { syncSymptomCheckboxes } from "../../utils/symptom-utils.js";
import { TRIAGE_RECORD_FORM_RULES } from "./triage-record.form.rules.js";

/* ============================================================
   🧩 HELPERS (MASTER-ALIGNED)
============================================================ */
const qs = (id) => document.getElementById(id);

const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

const normalizeDateTime = (val) => {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const toLocalInput = (val) =>
  val ? new Date(val).toISOString().slice(0, 16) : "";

/* ============================================================
   🛡️ RULE VALIDATION (MASTER ENGINE)
============================================================ */
function validateUsingRules(form) {
  const errors = [];

  for (const rule of TRIAGE_RECORD_FORM_RULES) {
    if (typeof rule.when === "function" && !rule.when()) continue;

    const el =
      document.getElementById(rule.id) ||
      form.querySelector(`[name="${rule.id}"]`);

    if (!el) continue;

    let value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.type === "radio")
      value = document.querySelector(`input[name="${el.name}"]:checked`);
    else value = el.value;

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
   🚀 MAIN SETUP
============================================================ */
export async function setupTriageRecordFormSubmission({ form }) {
  initPageGuard(
    autoPagePermissionKey(["triage_records:create", "triage_records:edit"])
  );
  initLogoutWatcher();
  enableLiveValidation(form);

  const sessionId = sessionStorage.getItem("triageRecordEditId");
  const sessionPayload = sessionStorage.getItem("triageRecordEditPayload");
  const queryId = new URLSearchParams(window.location.search).get("id");

  const triageId = sessionId || queryId;
  const isEdit = Boolean(triageId || sessionPayload);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = qs("cancelBtn");
  const clearBtn = qs("clearBtn");

  const setUI = (edit) => {
    if (titleEl)
      titleEl.textContent = edit
        ? "Update Triage Record"
        : "Add Triage Record";
    if (submitBtn)
      submitBtn.innerHTML = edit
        ? `<i class="ri-save-3-line me-1"></i> Update`
        : `<i class="ri-add-line me-1"></i> Submit`;
  };

  setUI(isEdit);

  /* ================= DOM ================= */
  const orgSelect = qs("organizationSelect");
  const facSelect = qs("facilitySelect");
  const triageTypeSelect = qs("triageTypeSelect");
  const registrationLogSelect = qs("registrationLogSelect");

  const patientInput = qs("patientInput");
  const patientId = qs("patientId");
  const patientSuggestions = qs("patientSuggestions");

  const doctorInput = qs("doctorInput");
  const doctorId = qs("doctorId");
  const doctorSuggestions = qs("doctorSuggestions");

  const nurseInput = qs("nurseInput");
  const nurseId = qs("nurseId");
  const nurseSuggestions = qs("nurseSuggestions");

  /* ================= ROLE ================= */
  const role = resolveUserRole();
  const isSuper = role === "superadmin";
  const isOrgAdmin =
    role === "organization_admin" || role === "admin";

  /* ================= VISIBILITY ================= */
  const showOrg = () =>
    orgSelect?.closest(".form-group")?.classList.remove("hidden");
  const hideOrg = () =>
    orgSelect?.closest(".form-group")?.classList.add("hidden");

  const showFac = () =>
    facSelect?.closest(".form-group")?.classList.remove("hidden");
  const hideFac = () =>
    facSelect?.closest(".form-group")?.classList.add("hidden");

  /* ============================================================
    🌐 DROPDOWNS & SUGGESTIONS (MASTER-SAFE)
  ============================================================ */
  try {
    /* ================= ORGANIZATION ================= */
    if (isSuper) {
      showOrg();
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
      );
    } else {
      hideOrg();
    }

    /* ================= FACILITY ================= */
    if (isSuper || isOrgAdmin) {
      showFac();
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite(
          { organization_id: getOrganizationId() },
          true
        ),
        "id",
        "name",
        "-- Select Facility --"
      );

      if (getFacilityId()) facSelect.value = getFacilityId();
    } else {
      hideFac();
    }

    /* ================= PATIENT SUGGESTION ================= */
    if (patientInput && patientSuggestions && patientId) {
      setupSuggestionInputDynamic(
        patientInput,
        patientSuggestions,
        "/api/lite/patients",
        (selected) => {
          patientId.value = selected?.id || "";
          patientInput.value =
            selected?.label ||
            selected?.full_name ||
            "";
        },
        "label"
      );

      patientInput.addEventListener("input", () => {
        if (!patientInput.value.trim()) {
          patientId.value = "";
        }
      });
    }

    /* ================= DOCTOR SUGGESTION ================= */
    if (doctorInput && doctorSuggestions && doctorId) {
      setupSuggestionInputDynamic(
        doctorInput,
        doctorSuggestions,
        "/api/lite/employees",
        (selected) => {
          doctorId.value = selected?.id || "";
          doctorInput.value =
            selected?.full_name || "";
        },
        "full_name"
      );

      doctorInput.addEventListener("input", () => {
        if (!doctorInput.value.trim()) {
          doctorId.value = "";
        }
      });
    }

    /* ================= NURSE SUGGESTION ================= */
    if (nurseInput && nurseSuggestions && nurseId) {
      setupSuggestionInputDynamic(
        nurseInput,
        nurseSuggestions,
        "/api/lite/employees",
        (selected) => {
          nurseId.value = selected?.id || "";
          nurseInput.value =
            selected?.full_name || "";
        },
        "full_name"
      );

      nurseInput.addEventListener("input", () => {
        if (!nurseInput.value.trim()) {
          nurseId.value = "";
        }
      });
    }

    /* ================= TRIAGE TYPE ================= */
    if (triageTypeSelect) {
      setupSelectOptions(
        triageTypeSelect,
        await loadBillableItemsLite({ category: "triage" }, true),
        "id",
        "name",
        "-- Select Triage Type --"
      );
    }

  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE — MASTER PARITY)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      let entry =
        JSON.parse(
          sessionStorage.getItem("triageRecordEditPayload") || "null"
        ) ||
        (await (await authFetch(`/api/triage-records/${triageId}`)).json())
          .data;

      if (!entry) throw new Error("Triage record not found");

      patientId.value = entry.patient_id || "";
      patientInput.value = entry.patient?.label || entry.patient?.full_name || "";

      doctorId.value = entry.doctor_id || "";
      doctorInput.value = entry.doctor?.full_name || "";

      nurseId.value = entry.nurse_id || "";
      nurseInput.value = entry.nurse?.full_name || "";

      if (isSuper && entry.organization_id)
        orgSelect.value = entry.organization_id;

      if ((isSuper || isOrgAdmin) && entry.facility_id)
        facSelect.value = entry.facility_id;

      triageTypeSelect.value = entry.triage_type_id || "";
      registrationLogSelect.value = entry.registration_log_id || "";

      qs("recordedAt").value = toLocalInput(entry.recorded_at);

      const map = {
        bp: "bp",
        pulse: "pulse",
        rr: "rr",
        temp: "temp",
        oxygen: "oxygen",
        weight: "weight",
        height: "height",
        rbg: "rbg",
        painScore: "pain_score",
        position: "position",
      };

      Object.entries(map).forEach(([id, key]) => {
        if (entry[key] !== undefined && qs(id))
          qs(id).value = entry[key] ?? "";
      });

      if (entry.symptoms)
        syncSymptomCheckboxes(entry.symptoms, ".common-symptom");

      qs("triageNotes").value = entry.triage_notes || "";

      setUI(true);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to load triage record");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT (RULE-DRIVEN — MASTER ENGINE)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const ruleErrors = validateUsingRules(form);
    if (ruleErrors.length) {
      applyServerErrors(form, ruleErrors);
      return showToast("❌ Fix highlighted fields");
    }

    const payload = {
      organization_id: isSuper ? normalizeUUID(orgSelect?.value) : null,
      facility_id: normalizeUUID(facSelect?.value),
      patient_id: normalizeUUID(patientId.value),
      doctor_id: normalizeUUID(doctorId.value),
      nurse_id: normalizeUUID(nurseId.value),
      triage_type_id: normalizeUUID(triageTypeSelect?.value),
      registration_log_id: normalizeUUID(registrationLogSelect?.value),
      recorded_at: normalizeDateTime(qs("recordedAt")?.value),
      symptoms: qs("symptoms")?.value || null,
      triage_notes: qs("triageNotes")?.value || null,
      bp: qs("bp")?.value || null,
      pulse: qs("pulse")?.value || null,
      rr: qs("rr")?.value || null,
      temp: qs("temp")?.value || null,
      oxygen: qs("oxygen")?.value || null,
      weight: qs("weight")?.value || null,
      height: qs("height")?.value || null,
      rbg: qs("rbg")?.value || null,
      pain_score: qs("painScore")?.value || null,
      position: qs("position")?.value || null,
    };

    try {
      showLoading();

      const res = await authFetch(
        isEdit ? `/api/triage-records/${triageId}` : `/api/triage-records`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Submission failed");

      showToast(isEdit ? "✅ Updated" : "✅ Created");

      if (isEdit) {
        sessionStorage.clear();
        window.location.href = "/triage-records-list.html";
      } else {
        sessionStorage.removeItem("triageRecordEditId");
        sessionStorage.removeItem("triageRecordEditPayload");
        clearFormErrors(form);
        form.reset();
        patientId.value = "";
        doctorId.value = "";
        nurseId.value = "";
        setUI(false);
      }
    } catch (err) {
      console.error(err);
      showToast("❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/triage-records-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    form.reset();
    setUI(false);
  });
}
