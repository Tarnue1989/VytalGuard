// 📦 registrationLog-form.js – Rule-Driven Registration Log Form (Enterprise Pattern)
// ============================================================================
// 🔹 Rule-driven validation (REGISTRATION_LOG_FORM_RULES)
// 🔹 Role-aware org/fac handling
// 🔹 Suggestion inputs (patient / registrar)
// 🔹 Add + Edit parity
// 🔹 Controller-faithful (no silent validation)
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
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

import { REGISTRATION_LOG_FORM_RULES } from "./registration-log.form.rules.js";

/* ============================================================
   🧩 Helpers
============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupRegistrationLogFormSubmission({ form }) {
  initPageGuard(
    autoPagePermissionKey(["registration_logs:create", "registration_logs:edit"])
  );
  enableLiveValidation(form);

  const sessionId = sessionStorage.getItem("registrationLogEditId");
  const queryId = getQueryParam("id");
  const logId = sessionId || queryId;
  const isEdit = Boolean(logId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  const setFormTitle = (txt, icon) => {
    if (titleEl) titleEl.textContent = txt;
    if (submitBtn)
      submitBtn.innerHTML = `<i class="${icon} me-1"></i> ${txt}`;
  };

  setFormTitle(
    isEdit ? "Update" : "Submit",
    "ri-save-3-line"
  );

  /* ---------------- DOM Refs ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const typeSelect = document.getElementById("registrationTypeSelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const registrarInput = document.getElementById("registrarInput");
  const registrarHidden = document.getElementById("registrarId");
  const registrarSuggestions = document.getElementById("registrarSuggestions");

  /* ============================================================
     🔐 ROLE-AWARE DROPDOWNS (PATIENT PARITY)
  ============================================================ */
  try {
    const hideOrg = () =>
      orgSelect?.closest(".form-group")?.classList.add("hidden");
    const hideFac = () =>
      facSelect?.closest(".form-group")?.classList.add("hidden");

    if (userRole.includes("super")) {
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
      );

      const reloadFacilities = async (orgId = null) => {
        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite(
            orgId ? { organization_id: orgId } : {},
            true
          ),
          "id",
          "name",
          "-- Select Facility --"
        );
      };

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
    } else if (userRole.includes("admin")) {
      hideOrg();
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );
    } else {
      hideOrg();
      hideFac();
    }

    /* -------- Registration Type -------- */
    setupSelectOptions(
      typeSelect,
      await loadBillableItemsLite({ category: "registration" }, true),
      "id",
      "name",
      "-- Select Registration Type --"
    );

    /* -------- Patient Suggestion -------- */
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value = selected?.label || "";
      },
      "label"
    );

    /* -------- Registrar Suggestion -------- */
    setupSuggestionInputDynamic(
      registrarInput,
      registrarSuggestions,
      "/api/lite/employees",
      (selected) => {
        registrarHidden.value = selected?.id || "";
        registrarInput.value = selected?.full_name || "";
      },
      "full_name"
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load dropdown data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      let entry = JSON.parse(
        sessionStorage.getItem("registrationLogEditPayload") || "null"
      );

      if (!entry) {
        const res = await authFetch(`/api/registration-logs/${logId}`);
        const json = await res.json();
        entry = json?.data;
      }

      if (!entry) throw new Error("Registration Log not found");

      patientHidden.value = entry.patient_id || "";
      registrarHidden.value = entry.registrar_id || "";

      if (entry.patient)
        patientInput.value = entry.patient.label || "";
      if (entry.registrar)
        registrarInput.value = entry.registrar.full_name || "";

      [
        ["registrationMethod", entry.registration_method],
        ["patientCategory", entry.patient_category],
        ["visitReason", entry.visit_reason],
        ["registrationSource", entry.registration_source],
        ["notes", entry.notes],
      ].forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val || "";
      });

      document.getElementById("isEmergency").checked =
        !!entry.is_emergency;

      if (entry.organization_id && orgSelect) {
        orgSelect.value = entry.organization_id;
        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite(
            { organization_id: entry.organization_id },
            true
          ),
          "id",
          "name",
          "-- Select Facility --"
        );
      }
      if (entry.facility_id) facSelect.value = entry.facility_id;
      if (entry.registration_type_id)
        typeSelect.value = entry.registration_type_id;

      setFormTitle("Update Registration Log", "ri-save-3-line");
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to load registration log");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT — RULE-DRIVEN (PATIENT PARITY)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of REGISTRATION_LOG_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || !el.value || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (!patientHidden.value) {
      errors.push({
        field: "patientInput",
        message: "Patient is required",
      });
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      organization_id: normalizeUUID(orgSelect?.value),
      facility_id: normalizeUUID(facSelect?.value),
      patient_id: normalizeUUID(patientHidden.value),
      registrar_id: normalizeUUID(registrarHidden.value),
      registration_type_id: normalizeUUID(typeSelect?.value),
      registration_method:
        document.getElementById("registrationMethod").value,
      patient_category:
        document.getElementById("patientCategory").value,
      visit_reason:
        document.getElementById("visitReason").value || null,
      registration_source:
        document.getElementById("registrationSource").value || null,
      notes: document.getElementById("notes").value || null,
      is_emergency:
        document.getElementById("isEmergency").checked,
    };

    const method = isEdit ? "PUT" : "POST";
    const url = isEdit
      ? `/api/registration-logs/${logId}`
      : `/api/registration-logs`;

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, "Submission failed")
        );

      showToast(
        isEdit
          ? "✅ Registration Log updated"
          : "✅ Registration Log created"
      );

      sessionStorage.clear();
      window.location.href = "/registration-logs-list.html";
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     ⏮️ CANCEL / CLEAR
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/registration-logs-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setFormTitle("Submit", "ri-add-line");
  });
}
