// 📁 currency-rate-form.js – Secure & Role-Aware Currency Rate Form (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-form.js (1:1)
// 🔹 Rule-driven validation (CURRENCY_RATE_FORM_RULES)
// 🔹 ONLY superadmin can see/select organization
// 🔹 Org admin has implicit org (never selectable)
// 🔹 Facility optional (superadmin + org admin)
// 🔹 Backend remains authority
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import {
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { CURRENCY_RATE_FORM_RULES } from "./currency-rate.form.rules.js";

/* ============================================================
   Helpers
============================================================ */
const getQueryParam = (k) =>
  new URLSearchParams(window.location.search).get(k);

const normalizeMessage = (r, fb) =>
  r?.message || r?.error || r?.msg || fb;

const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

/* ============================================================
   Setup Currency Rate Form
============================================================ */
export async function setupCurrencyRateFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";
  const isOrgAdmin = userRole === "organization_admin";

  const recordId =
    sessionStorage.getItem("currencyRateEditId") || getQueryParam("id");
  const isEdit = Boolean(recordId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setUI = (edit) => {
    titleEl.textContent = edit ? "Edit Currency Rate" : "Add Currency Rate";
    submitBtn.innerHTML = edit
      ? `<i class="ri-save-3-line me-1"></i> Update Rate`
      : `<i class="ri-add-line me-1"></i> Add Rate`;
  };
  setUI(isEdit);

  /* ---------------- DOM ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const hideOrg = () =>
    orgSelect?.closest(".mb-3")?.classList.add("hidden");
  const showOrg = () =>
    orgSelect?.closest(".mb-3")?.classList.remove("hidden");
  const hideFac = () =>
    facSelect?.closest(".mb-3")?.classList.add("hidden");
  const showFac = () =>
    facSelect?.closest(".mb-3")?.classList.remove("hidden");

  /* ============================================================
     Role / Scope Visibility
  ============================================================ */
  if (isSuper) {
    showOrg();
    showFac();
  } else if (isOrgAdmin) {
    hideOrg();
    showFac();
  } else {
    hideOrg();
    hideFac();
  }

  /* ============================================================
     Load dropdowns
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

      const reloadFacilities = async (orgId = null) => {
        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite(
            orgId ? { organization_id: orgId } : {},
            true
          ),
          "id",
          "name",
          "-- Select Facility (optional) --"
        );
      };

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
    } else if (isOrgAdmin) {
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility (optional) --"
      );
    }
  } catch {
    showToast("❌ Failed to load organization/facility lists");
  }

  /* ============================================================
     Submit — RULE-DRIVEN
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of CURRENCY_RATE_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || !el.value || el.value.toString().trim() === "") {
        errors.push({
          field: rule.id,
          message: rule.message,
        });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      from_currency: document.getElementById("from_currency").value.trim(),
      to_currency: document.getElementById("to_currency").value.trim(),
      rate: Number(document.getElementById("rate").value),
      effective_date: document.getElementById("effective_date").value,
      status:
        document.querySelector("input[name='status']:checked")?.value ||
        "active",
    };

    if (isSuper) payload.organization_id = normalizeUUID(orgSelect.value);
    payload.facility_id = normalizeUUID(facSelect?.value);

    try {
      showLoading();
      const res = await authFetch(
        isEdit
          ? `/api/currency-rates/${recordId}`
          : `/api/currency-rates`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (!res.ok)
        throw new Error(normalizeMessage(json, "Submission failed"));

      showToast(isEdit ? "✅ Currency rate updated" : "✅ Currency rate created");
      sessionStorage.clear();
      window.location.href = "/currency-rates-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/currency-rates-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI(false);
  });
}