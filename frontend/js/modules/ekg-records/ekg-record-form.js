// 📦 ekg-record-form.js – Secure & Role-Aware EKG Record Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 Rule-driven validation (EKG_RECORD_FORM_RULES)
// 🔹 Role-aware org / facility handling
// 🔹 Suggestion inputs (patient / technician)
// 🔹 Add + Edit parity
// 🔹 Controller-faithful (no silent mapping)
// 🔹 FULL parity with registrationLog-form.js + centralstock-form.js
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

import { EKG_RECORD_FORM_RULES } from "./ekg-record.form.rules.js";

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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ============================================================
   🛡️ RULE VALIDATION (CENTRAL STOCK PARITY)
============================================================ */
function validateUsingRules(form) {
  const errors = [];

  for (const rule of EKG_RECORD_FORM_RULES) {
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
export async function setupEKGRecordFormSubmission({ form }) {
  initPageGuard(
    autoPagePermissionKey(["ekg_records:create", "ekg_records:edit"])
  );
  initLogoutWatcher();
  enableLiveValidation(form);

  const sessionId = sessionStorage.getItem("ekgRecordEditId");
  const payload = sessionStorage.getItem("ekgRecordEditPayload");
  const queryId = new URLSearchParams(window.location.search).get("id");

  const ekgId = sessionId || queryId;
  const isEdit = Boolean(ekgId || payload);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = qs("cancelBtn");
  const clearBtn = qs("clearBtn");

  const setUI = (edit) => {
    if (titleEl)
      titleEl.textContent = edit ? "Update EKG Record" : "Add EKG Record";
    if (submitBtn)
      submitBtn.innerHTML = edit
        ? `<i class="ri-save-3-line me-1"></i> Update`
        : `<i class="ri-add-line me-1"></i> Submit`;
  };

  setUI(isEdit);

  /* ================= DOM ================= */
  const orgSelect = qs("organizationSelect");
  const facSelect = qs("facilitySelect");
  const billableSelect = qs("billableItemSelect");

  const patientInput = qs("patientInput");
  const patientId = qs("patientId");
  const patientSuggestions = qs("patientSuggestions");

  const technicianInput = qs("technicianInput");
  const technicianId = qs("technicianId");
  const technicianSuggestions = qs("technicianSuggestions");

  const registrationLogSelect = qs("registrationLogSelect");
  const consultationSelect = qs("consultationSelect");

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

    // 🔒 clear stale values
    if (orgSelect) orgSelect.value = "";
    if (facSelect) facSelect.value = "";
  }

  /* ================= BILLABLE ITEMS ================= */
  setupSelectOptions(
    billableSelect,
    await loadBillableItemsLite({ category: "ekg" }, true),
    "id",
    "name",
    "-- Select EKG Item --"
  );

  /* ================= PATIENT ================= */
  setupSuggestionInputDynamic(
    patientInput,
    patientSuggestions,
    "/api/lite/patients",
    (selected) => {
      patientId.value = selected?.id || "";
      patientInput.value = selected?.label || "";
    },
    "label"
  );

  /* ================= TECHNICIAN ================= */
  setupSuggestionInputDynamic(
    technicianInput,
    technicianSuggestions,
    "/api/lite/employees",
    (t) => {
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
    ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      let entry =
        JSON.parse(
          sessionStorage.getItem("ekgRecordEditPayload") || "null"
        ) ||
        (await (await authFetch(`/api/ekg-records/${ekgId}`)).json()).data;

      if (!entry) throw new Error("EKG Record not found");

      /* ---------- Patient ---------- */
      patientId.value = entry.patient_id || "";

      if (entry.patient) {
        const name =
          entry.patient.label ||
          `${entry.patient.first_name} ${entry.patient.last_name}`;

        const patNo = entry.patient.pat_no
          ? ` (${entry.patient.pat_no})`
          : "";

        patientInput.value = `${name}${patNo}`;
      } else {
        patientInput.value = "";
      }

      /* ---------- Technician ---------- */
      technicianId.value = entry.technician_id || "";
      technicianInput.value = entry.technician?.label || "";

      /* ---------- Core Fields ---------- */
      qs("recordedDate").value = normalizeDate(entry.recorded_date);
      qs("heartRate").value = entry.heart_rate ?? "";
      qs("prInterval").value = entry.pr_interval ?? "";
      qs("qrsDuration").value = entry.qrs_duration ?? "";
      qs("qtInterval").value = entry.qt_interval ?? "";
      qs("axis").value = entry.axis ?? "";
      qs("rhythm").value = entry.rhythm ?? "";
      qs("interpretation").value = entry.interpretation ?? "";
      qs("recommendation").value = entry.recommendation ?? "";
      qs("note").value = entry.note ?? "";
      qs("isEmergency").checked = !!entry.is_emergency;

      /* ---------- Tenant ---------- */
      if (isSuper && entry.organization_id) {
        orgSelect.value = entry.organization_id;
      }
      if (isSuper && entry.facility_id) {
        facSelect.value = entry.facility_id;
      }
      /* ---------- Billing ---------- */
      if (entry.billable_item_id) {
        billableSelect.value = entry.billable_item_id;
      }

      setUI(true);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to load EKG record");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
    🛡️ SUBMIT (CENTRAL-STOCK VALIDATION PARITY)
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
      patient_id: normalizeUUID(patientId.value),
      technician_id: normalizeUUID(technicianId.value),
      billable_item_id: normalizeUUID(billableSelect.value),
      registration_log_id: normalizeUUID(registrationLogSelect?.value),
      consultation_id: normalizeUUID(consultationSelect?.value),

      recorded_date: qs("recordedDate").value,
      heart_rate: qs("heartRate").value || null,
      pr_interval: qs("prInterval").value || null,
      qrs_duration: qs("qrsDuration").value || null,
      qt_interval: qs("qtInterval").value || null,
      axis: qs("axis").value || null,
      rhythm: qs("rhythm").value || null,
      interpretation: qs("interpretation").value || null,
      recommendation: qs("recommendation").value || null,
      note: qs("note").value || null,
      is_emergency: qs("isEmergency").checked,
    };

    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect.value);
      payload.facility_id = normalizeUUID(facSelect.value);
    }
    try {
      showLoading();

      const res = await authFetch(
        isEdit ? `/api/ekg-records/${ekgId}` : `/api/ekg-records`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Submission failed");

      showToast(isEdit ? "✅ Updated" : "✅ Created");

      if (isEdit) {
        // EDIT → go back to list
        sessionStorage.clear();
        window.location.href = "/ekg-records-list.html";
      } else {
        // CREATE → stay on form (clean state)
        sessionStorage.removeItem("ekgRecordEditId");
        sessionStorage.removeItem("ekgRecordEditPayload");
        clearFormErrors(form);
        form.reset();
        patientId.value = "";
        technicianId.value = "";
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
    window.location.href = "/ekg-records-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    form.reset();
    setUI(false);
  });
}
