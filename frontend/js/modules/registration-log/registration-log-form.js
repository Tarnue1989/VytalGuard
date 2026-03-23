// 📦 registrationLog-form.js – Secure & Role-Aware Registration Log Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 Rule-driven validation (REGISTRATION_LOG_FORM_RULES)
// 🔹 SUPERADMIN-only org/fac (HIDDEN for all other roles)
// 🔹 Suggestion inputs (patient / registrar)
// 🔹 Add + Edit parity (sessionStorage + query fallback)
// 🔹 Clean payload normalization (UUID | null)
// 🔹 Controller-faithful (no HTML validation, no silent rules)
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

import { resolveUserRole } from "../../utils/roleResolver.js";
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

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupRegistrationLogFormSubmission({ form }) {
  initPageGuard(
    autoPagePermissionKey(["registration_logs:create", "registration_logs:edit"])
  );
  initLogoutWatcher();
  enableLiveValidation(form);

  const logId =
    sessionStorage.getItem("registrationLogEditId") || getQueryParam("id");
  const isEdit = Boolean(logId);

  /* ================= UI ================= */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Update Registration Log" : "Add Registration Log";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update`
          : `<i class="ri-add-line me-1"></i> Submit`;
  };
  setUI(isEdit ? "edit" : "add");

  /* ================= DOM ================= */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const typeSelect = document.getElementById("registrationTypeSelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const registrarInput = document.getElementById("registrarInput");
  const registrarHidden = document.getElementById("registrarId");
  const registrarSuggestions = document.getElementById("registrarSuggestions");

  /* ================= Role ================= */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ============================================================
     🌐 Dropdowns & Suggestions (MASTER)
  ============================================================ */
  try {
    if (isSuper) {
      // SUPERADMIN ONLY — org & facility visible
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
    } else {
      // 🔒 ALL OTHER ROLES — HIDDEN
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // Registration Type
    setupSelectOptions(
      typeSelect,
      await loadBillableItemsLite({ category: "registration" }, true),
      "id",
      "name",
      "-- Select Registration Type --"
    );

    // Patient suggestion
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

    // Registrar suggestion
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
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit && logId) {
    try {
      showLoading();

      let entry = JSON.parse(
        sessionStorage.getItem("registrationLogEditPayload") || "null"
      );

      if (!entry) {
        const res = await authFetch(`/api/registration-logs/${logId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            normalizeMessage(json, "Failed to load registration log")
          );
        entry = json?.data;
      }

      if (!entry) throw new Error("Registration Log not found");

      patientHidden.value = entry.patient_id || "";
      patientInput.value = entry.patient
        ? `${entry.patient.pat_no} - ${entry.patient.first_name} ${entry.patient.last_name}`.trim()
        : "";

      registrarHidden.value = entry.registrar_id || "";
      registrarInput.value = entry.registrar
        ? `${entry.registrar.first_name} ${entry.registrar.last_name}`.trim()
        : "";

      [
        ["registrationMethod", entry.registration_method],
        ["patientCategory", entry.patient_category],
        ["visitReason", entry.visit_reason],
        ["registrationSource", entry.registration_source],
        ["notes", entry.notes],
      ].forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val ?? "";
      });

      const emergencyEl = document.getElementById("isEmergency");
      if (emergencyEl) emergencyEl.checked = !!entry.is_emergency;

      if (isSuper && entry.organization_id) {
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
        facSelect.value = entry.facility_id || "";
      }

      if (entry.registration_type_id)
        typeSelect.value = entry.registration_type_id;

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load registration log");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT — MASTER PARITY
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

  const errors = [];

  for (const rule of REGISTRATION_LOG_FORM_RULES) {
    // Skip if condition not met
    if (typeof rule.when === "function" && !rule.when()) continue;

    // Skip if not required
    if (!rule.required) continue;

    const el =
      document.getElementById(rule.id) ||
      form.querySelector(`[name="${rule.id}"]`);

    const value = el?.value?.toString().trim();

    if (!value) {
      errors.push({ field: rule.id, message: rule.message });
    }
  }
    if (!patientHidden.value) {
      errors.push({ field: "patientInput", message: "Patient is required" });
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
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

    // 🔒 SUPERADMIN ONLY
    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();

      const res = await authFetch(
        isEdit
          ? `/api/registration-logs/${logId}`
          : `/api/registration-logs`,
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

      showToast(
        isEdit
          ? "✅ Registration Log updated"
          : "✅ Registration Log created"
      );

      sessionStorage.clear();
      window.location.href = "/registration-logs-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ================= Cancel / Clear ================= */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/registration-logs-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI("add");
  });
}
