// 📁 patient-insurance-form.js – FINAL (FULL FIXED MASTER PARITY)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { loadInsuranceProvidersLite } from "../../utils/data-loaders.js";

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

import { resolveUserRole } from "../../utils/roleResolver.js";
import { PATIENT_INSURANCE_FORM_RULES } from "./patient-insurance-form-rules.js";

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
  if (msg?.detail) return msg.detail;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

function normalizeUUID(val) {
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

function normalizeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/* ============================================================
   🚀 MAIN (ENTERPRISE FLOW)
============================================================ */
export async function setupPatientInsuranceFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const recordId =
    sessionStorage.getItem("patientInsuranceEditId") || getQueryParam("id");

  const isEdit = Boolean(recordId);

  /* ================= UI MODE ================= */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit"
          ? "Edit Patient Insurance"
          : "Add Patient Insurance";

    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update`
          : `<i class="ri-add-line me-1"></i> Add`;
  };

  setUI(isEdit ? "edit" : "add");

  /* ================= DOM ================= */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const providerInput = document.getElementById("providerInput");
  const providerHidden = document.getElementById("providerId");
  const providerSuggestions = document.getElementById("providerSuggestions");

  const policyNumberInput = document.getElementById("policyNumber");
  const planNameInput = document.getElementById("planName");
  const coverageLimitInput = document.getElementById("coverageLimit");
  const currencySelect = document.getElementById("currencySelect");

  const validFromInput = document.getElementById("validFrom");
  const validToInput = document.getElementById("validTo");

  const isPrimaryInput = document.getElementById("isPrimary");
  const notesInput = document.getElementById("notes");

  /* ================= ROLE ================= */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ================= LOADERS ================= */
  try {
    if (isSuper) {
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite({}, true),
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
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    /* ================= PATIENT ================= */
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

    /* ================= PROVIDER ================= */
    setupSuggestionInputDynamic(
      providerInput,
      providerSuggestions,
      "/api/lite/insurance-providers",
      (selected) => {
        providerHidden.value = selected?.id || "";
        providerInput.value = selected?.label || "";
      },
      "label"
    );

    /* ================= CLEAR ================= */
    patientInput.oninput = () => {
      if (!patientInput.value) {
        patientHidden.value = "";
      }
    };

    providerInput.oninput = () => {
      if (!providerInput.value) {
        providerHidden.value = "";
      }
    };

  } catch {
    showToast("❌ Failed to load reference data");
  }

  /* ================= EDIT PREFILL ================= */
  if (isEdit && recordId) {
    try {
      showLoading();

      const res = await authFetch(`/api/patient-insurances/${recordId}`);
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(normalizeMessage(result, "Failed to load record"));

      const entry = result?.data;
      if (!entry) return;

      /* ================= CORE ================= */
      patientHidden.value = entry.patient_id || "";
      patientInput.value = [
        entry.patient?.first_name,
        entry.patient?.last_name,
      ].filter(Boolean).join(" ");

      providerHidden.value = entry.provider_id || "";
      providerInput.value = entry.provider?.name || "";

      policyNumberInput.value = entry.policy_number || "";
      planNameInput.value = entry.plan_name || "";
      coverageLimitInput.value = entry.coverage_limit || "";
      currencySelect.value = entry.currency || "USD";

      validFromInput.value = entry.valid_from || "";
      validToInput.value = entry.valid_to || "";

      isPrimaryInput.checked = !!entry.is_primary;
      notesInput.value = entry.notes || "";

      /* ================= SUPERADMIN PREFILL ================= */
      if (isSuper) {
        if (orgSelect && entry.organization_id) {
          orgSelect.value = entry.organization_id;
        }

        if (entry.organization_id) {
          const facilities = await loadFacilitiesLite(
            { organization_id: entry.organization_id },
            true
          );

          setupSelectOptions(
            facSelect,
            facilities,
            "id",
            "name",
            "-- Select Facility --"
          );

          if (entry.facility_id) {
            facSelect.value = entry.facility_id;
          }
        }
      }

      setUI("edit");

    } catch (err) {
      showToast(err.message || "❌ Could not load record");
    } finally {
      hideLoading();
    }
  }

  /* ================= SUBMIT ================= */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of PATIENT_INSURANCE_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || el.closest(".hidden")) continue;

      if (!el.value || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      patient_id: normalizeUUID(patientHidden.value),
      provider_id: normalizeUUID(providerHidden.value),
      policy_number: policyNumberInput.value || null,
      plan_name: planNameInput.value || null,
      coverage_limit: normalizeNumber(coverageLimitInput.value),
      currency: currencySelect.value || "USD",
      valid_from: validFromInput.value || null,
      valid_to: validToInput.value || null,
      is_primary: !!isPrimaryInput.checked,
      notes: notesInput.value || null,
    };

    if (isSuper) {
      const orgId = normalizeUUID(orgSelect?.value);
      const facId = normalizeUUID(facSelect?.value);
      if (orgId) payload.organization_id = orgId;
      if (facId) payload.facility_id = facId;
    }

    try {
      showLoading();

      const res = await authFetch(
        isEdit
          ? `/api/patient-insurances/${recordId}`
          : `/api/patient-insurances`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      showToast(isEdit ? "✅ Updated" : "✅ Created");

      sessionStorage.removeItem("patientInsuranceEditId");
      window.location.href = "/patient-insurance-list.html";

    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ================= CANCEL / CLEAR ================= */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/patient-insurance-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    currencySelect.value = "USD";
    patientHidden.value = "";
    providerHidden.value = "";
    setUI("add");
  });
}