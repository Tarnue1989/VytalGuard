// 📁 vital-form.js – Secure & Role-Aware Vital Form (Enterprise Master Pattern)
// ============================================================================
// 🔹 Rule-driven validation (VITAL_FORM_RULES)
// 🔹 Role-aware org/fac handling (super / org / facility)
// 🔹 Clean payload normalization
// 🔹 Controller-faithful (no inline required checks)
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
} from "../../utils/roleResolver.js";

import { VITAL_FORM_RULES } from "./vital.form.rules.js";

/* ============================================================
   Helpers
============================================================ */
const qp = (k) => new URLSearchParams(window.location.search).get(k);
const normUUID = (v) => (typeof v === "string" && v.trim() ? v : null);
const normDT = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const fmtDTLocal = (v) => (v ? new Date(v).toISOString().slice(0, 16) : "");
const normMsg = (r, f) => {
  const m = r?.message ?? r?.error ?? r?.msg;
  if (typeof m === "string") return m;
  if (m?.detail) return m.detail;
  try { return JSON.stringify(m); } catch { return f; }
};

/* ============================================================
   Main Setup
============================================================ */
export async function setupVitalFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const vitalId = sessionStorage.getItem("vitalEditId") || qp("id");
  const isEdit = Boolean(vitalId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (m = "add") => {
    if (titleEl) titleEl.textContent = m === "edit" ? "Edit Vital" : "Add Vital";
    if (submitBtn)
      submitBtn.innerHTML =
        m === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Vital`
          : `<i class="ri-add-line me-1"></i> Add Vital`;
  };
  setUI(isEdit ? "edit" : "add");

  /* ---------------- DOM Refs ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const nurseInput = document.getElementById("nurseInput");
  const nurseHidden = document.getElementById("nurseId");
  const nurseSuggestions = document.getElementById("nurseSuggestions");

  /* ---------------- Role ---------------- */
  const role = resolveUserRole();
  const isSuper = role === "superadmin";
  const isOrgAdmin = role === "organization_admin";

  /* ============================================================
     Dropdowns & Suggestions
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

      const reloadFac = async (orgId = null) => {
        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite(
            { organization_id: orgId ?? getOrganizationId() },
            true
          ),
          "id",
          "name",
          "-- Select Facility --"
        );
      };

      await reloadFac();
      orgSelect?.addEventListener("change", () =>
        reloadFac(orgSelect.value || null)
      );
    } else if (isOrgAdmin) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
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
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (s) => {
        patientHidden.value = s?.id || "";
        patientInput.value = s?.label || s?.full_name || "";
      },
      "label"
    );

    setupSuggestionInputDynamic(
      nurseInput,
      nurseSuggestions,
      "/api/lite/employees",
      (s) => {
        nurseHidden.value = s?.id || "";
        nurseInput.value = s?.full_name || "";
      },
      "full_name"
    );
  } catch {
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     PREFILL (EDIT)
  ============================================================ */
  if (isEdit && vitalId) {
    try {
      showLoading();
      const res = await authFetch(`/api/vitals/${vitalId}`);
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(normMsg(result, "Failed to load vital"));

      const e = result?.data;
      if (!e) return;

      patientHidden.value = e.patient_id || "";
      if (e.patient) patientInput.value = e.patient.label || e.patient.full_name || "";

      nurseHidden.value = e.nurse_id || "";
      if (e.nurse) nurseInput.value = e.nurse.full_name || "";

      if (isSuper && e.organization_id) orgSelect.value = e.organization_id;
      if ((isSuper || isOrgAdmin) && e.facility_id) facSelect.value = e.facility_id;

      [
        "bp","pulse","rr","temp","oxygen","weight","height","rbg","painScore","position"
      ].forEach((id) => {
        const k = id === "painScore" ? "pain_score" : id;
        if (e[k] != null) document.getElementById(id).value = e[k];
      });

      if (e.recorded_at)
        document.getElementById("recordedAt").value = fmtDTLocal(e.recorded_at);

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load vital");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     SUBMIT — RULE-DRIVEN (MASTER PARITY)
  ============================================================ */
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    clearFormErrors(form);

    const errors = [];
    for (const rule of VITAL_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;
      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);
      if (!el || !el.value || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      patient_id: normUUID(patientHidden.value),
      nurse_id: normUUID(nurseHidden.value),
      organization_id: isSuper ? normUUID(orgSelect?.value) : null,
      facility_id: normUUID(facSelect?.value),
      bp: document.getElementById("bp")?.value || null,
      pulse: document.getElementById("pulse")?.value || null,
      rr: document.getElementById("rr")?.value || null,
      temp: document.getElementById("temp")?.value || null,
      oxygen: document.getElementById("oxygen")?.value || null,
      weight: document.getElementById("weight")?.value || null,
      height: document.getElementById("height")?.value || null,
      rbg: document.getElementById("rbg")?.value || null,
      pain_score: document.getElementById("painScore")?.value || null,
      position: document.getElementById("position")?.value || null,
      recorded_at: normDT(document.getElementById("recordedAt")?.value),
    };

    try {
      showLoading();
      const url = isEdit ? `/api/vitals/${vitalId}` : `/api/vitals`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normMsg(result, `❌ Server error (${res.status})`));

      showToast(isEdit ? "✅ Vital updated" : "✅ Vital created");
      sessionStorage.clear();
      window.location.href = "/vitals-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     CANCEL / CLEAR
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/vitals-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI("add");
  });
}
