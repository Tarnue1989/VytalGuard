// 📦 registrationLog-form.js – Secure & Role-Aware Registration Log Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 Rule-driven validation (REGISTRATION_LOG_FORM_RULES)
// 🔹 Role-aware org/fac handling
// 🔹 Suggestion inputs (patient / registrar)
// 🔹 Add + Edit parity
// 🔹 Controller-faithful (no silent mapping)
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

import { REGISTRATION_LOG_FORM_RULES } from "./registration-log.form.rules.js";

/* ============================================================
   🧩 Helpers
============================================================ */
const qs = (id) => document.getElementById(id);

const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

const normalizeSelectValue = (v) =>
  typeof v === "string" ? v.replace("_", "-").toLowerCase() : "";

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupRegistrationLogFormSubmission({ form }) {
  initPageGuard(
    autoPagePermissionKey(["registration_logs:create", "registration_logs:edit"])
  );
  initLogoutWatcher();
  enableLiveValidation(form);

  const sessionId = sessionStorage.getItem("registrationLogEditId");
  const queryId = new URLSearchParams(window.location.search).get("id");
  const logId = sessionId || queryId;
  const isEdit = Boolean(logId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = qs("cancelBtn");
  const clearBtn = qs("clearBtn");

  const setUI = (edit) => {
    if (titleEl)
      titleEl.textContent = edit
        ? "Update Registration Log"
        : "Add Registration Log";

    if (submitBtn)
      submitBtn.innerHTML = edit
        ? `<i class="ri-save-3-line me-1"></i> Update`
        : `<i class="ri-add-line me-1"></i> Submit`;
  };

  setUI(isEdit);

  /* ================= DOM ================= */
  const orgSelect = qs("organizationSelect");
  const facSelect = qs("facilitySelect");
  const typeSelect = qs("registrationTypeSelect");

  const patientInput = qs("patientInput");
  const patientId = qs("patientId");
  const patientSuggestions = qs("patientSuggestions");

  const registrarInput = qs("registrarInput");
  const registrarId = qs("registrarId");
  const registrarSuggestions = qs("registrarSuggestions");

  /* ================= ROLE ================= */
  const role = resolveUserRole();
  const isSuper = role === "superadmin";
  const isOrgAdmin = role === "organization_admin" || role === "admin";

  /* ================= VISIBILITY HELPERS ================= */
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

    setupSelectOptions(
      typeSelect,
      await loadBillableItemsLite({ category: "registration" }, true),
      "id",
      "name",
      "-- Select Registration Type --"
    );

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (p) => {
        patientId.value = p?.id || "";
        patientInput.value = p
          ? `${p.pat_no} - ${p.first_name} ${p.last_name}`
          : "";
      }
    );

    setupSuggestionInputDynamic(
      registrarInput,
      registrarSuggestions,
      "/api/lite/employees",
      (r) => {
        registrarId.value = r?.id || "";
        registrarInput.value = r?.full_name || "";
      }
    );
  } catch (e) {
    console.error(e);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      let entry =
        JSON.parse(
          sessionStorage.getItem("registrationLogEditPayload") || "null"
        ) ||
        (await (await authFetch(`/api/registration-logs/${logId}`)).json()).data;

      if (!entry) throw new Error("Registration Log not found");

      patientId.value = entry.patient_id || "";
      patientInput.value = entry.patient
        ? `${entry.patient.pat_no} - ${entry.patient.first_name} ${entry.patient.last_name}`
        : "";

      registrarId.value = entry.registrar_id || "";
      registrarInput.value = entry.registrar?.full_name || "";

      qs("registrationMethod").value = normalizeSelectValue(
        entry.registration_method
      );
      qs("patientCategory").value = normalizeSelectValue(
        entry.patient_category
      );
      qs("visitReason").value = entry.visit_reason || "";
      qs("registrationSource").value = entry.registration_source || "";
      qs("notes").value = entry.notes || "";
      qs("isEmergency").checked = !!entry.is_emergency;

      if (isSuper && entry.organization_id) {
        showOrg();
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

      if ((isSuper || isOrgAdmin) && entry.facility_id) {
        showFac();
        facSelect.value = entry.facility_id;
      }

      if (entry.registration_type_id)
        typeSelect.value = entry.registration_type_id;

      setUI(true);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to load registration log");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of REGISTRATION_LOG_FORM_RULES) {
      if (rule.when && !rule.when()) continue;
      const el = qs(rule.id);
      if (!el || !el.value) errors.push(rule);
    }

    if (!patientId.value)
      errors.push({ field: "patientInput", message: "Patient is required" });

    if (errors.length) {
      applyServerErrors(form, errors);
      return showToast("❌ Fix highlighted fields");
    }

    const payload = {
      organization_id: isSuper ? normalizeUUID(orgSelect.value) : null,
      facility_id: normalizeUUID(facSelect.value),
      patient_id: normalizeUUID(patientId.value),
      registrar_id: normalizeUUID(registrarId.value),
      registration_type_id: normalizeUUID(typeSelect.value),
      registration_method: qs("registrationMethod").value,
      patient_category: qs("patientCategory").value,
      visit_reason: qs("visitReason").value || null,
      registration_source: qs("registrationSource").value || null,
      notes: qs("notes").value || null,
      is_emergency: qs("isEmergency").checked,
    };

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

      if (!res.ok) throw new Error("Submission failed");

      showToast(isEdit ? "✅ Updated" : "✅ Created");
      sessionStorage.clear();
      window.location.href = "/registration-logs-list.html";
    } catch (err) {
      console.error(err);
      showToast("❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/registration-logs-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    form.reset();
    setUI(false);
  });
}
