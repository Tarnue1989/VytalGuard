// 📦 vital-form.js – Secure & Role-Aware Vital Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 Rule-driven validation (VITAL_FORM_RULES) — SAME ENGINE AS EKG MASTER
// 🔹 Role-aware org / facility handling (super / org / facility)
// 🔹 Suggestion inputs (patient / nurse)
// 🔹 Add + Edit parity (SESSION + QUERY)
// 🔹 Controller-faithful payload (NO silent mapping)
// 🔹 EDIT → redirect | CREATE → stay on form (EKG parity)
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
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import {
  resolveUserRole,
  getOrganizationId,
  getFacilityId,
} from "../../utils/roleResolver.js";

import { VITAL_FORM_RULES } from "./vital.form.rules.js";

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
   🛡️ RULE VALIDATION (EKG MASTER PARITY)
============================================================ */
function validateUsingRules(form) {
  const errors = [];

  for (const rule of VITAL_FORM_RULES) {
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
export async function setupVitalFormSubmission({ form }) {
  initPageGuard(
    autoPagePermissionKey(["vitals:create", "vitals:edit"])
  );
  initLogoutWatcher();
  enableLiveValidation(form);

  const sessionId = sessionStorage.getItem("vitalEditId");
  const sessionPayload = sessionStorage.getItem("vitalEditPayload");
  const queryId = new URLSearchParams(window.location.search).get("id");

  const vitalId = sessionId || queryId;
  const isEdit = Boolean(vitalId || sessionPayload);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = qs("cancelBtn");
  const clearBtn = qs("clearBtn");

  const setUI = (edit) => {
    if (titleEl)
      titleEl.textContent = edit ? "Update Vital" : "Add Vital";
    if (submitBtn)
      submitBtn.innerHTML = edit
        ? `<i class="ri-save-3-line me-1"></i> Update`
        : `<i class="ri-add-line me-1"></i> Submit`;
  };

  setUI(isEdit);

  /* ================= DOM ================= */
  const orgSelect = qs("organizationSelect");
  const facSelect = qs("facilitySelect");

  const patientInput = qs("patientInput");
  const patientId = qs("patientId");
  const patientSuggestions = qs("patientSuggestions");

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
     🌐 DROPDOWNS & SUGGESTIONS
  ============================================================ */
  try {
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
          sessionStorage.getItem("vitalEditPayload") || "null"
        ) ||
        (await (await authFetch(`/api/vitals/${vitalId}`)).json())
          .data;

      if (!entry) throw new Error("Vital not found");

      /* ---------- Patient ---------- */
      patientId.value = entry.patient_id || "";
      if (entry.patient) {
        patientInput.value =
          entry.patient.label ||
          entry.patient.full_name ||
          "";
      }

      /* ---------- Nurse ---------- */
      nurseId.value = entry.nurse_id || "";
      nurseInput.value = entry.nurse?.full_name || "";

      /* ---------- Tenant ---------- */
      if (isSuper && entry.organization_id)
        orgSelect.value = entry.organization_id;

      if ((isSuper || isOrgAdmin) && entry.facility_id)
        facSelect.value = entry.facility_id;

      /* ---------- Core Fields ---------- */
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

      setUI(true);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to load vital");
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
      nurse_id: normalizeUUID(nurseId.value),
      recorded_at: normalizeDateTime(qs("recordedAt")?.value),
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
        isEdit ? `/api/vitals/${vitalId}` : `/api/vitals`,
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
        window.location.href = "/vitals-list.html";
      } else {
        sessionStorage.removeItem("vitalEditId");
        sessionStorage.removeItem("vitalEditPayload");
        clearFormErrors(form);
        form.reset();
        patientId.value = "";
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
    window.location.href = "/vitals-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    form.reset();
    setUI(false);
  });
}
