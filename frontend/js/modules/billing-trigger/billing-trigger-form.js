// 📦 billing-trigger-form.js – Secure & Role-Aware Billing Trigger Form
// ============================================================================
// 🔹 Rule-driven validation (BILLING_TRIGGER_FORM_RULES)
// 🔹 Role-aware org/fac handling
// 🔹 Controller-faithful (NO silent validation)
// 🔹 Preserves ALL DOM IDs
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
} from "../../utils/data-loaders.js";

import { BILLING_TRIGGER_FORM_RULES } from "./billing-trigger.form.rules.js";

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

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupBillingTriggerFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const triggerId =
    sessionStorage.getItem("billingTriggerEditId") || getQueryParam("id");
  const isEdit = Boolean(triggerId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setFormTitle = (txt) => {
    if (titleEl) titleEl.textContent = txt;
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> ${txt}`;
  };

  setFormTitle(isEdit ? "Update Billing Trigger" : "Add Billing Trigger");

  /* ---------------- DOM Refs ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const statusEl = document.getElementById("is_active");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🔐 ROLE-AWARE DROPDOWNS
  ============================================================ */
  try {
    const hideOrg = () =>
      orgSelect?.closest(".mb-3")?.classList.add("hidden");
    const hideFac = () =>
      facSelect?.closest(".mb-3")?.classList.add("hidden");

    if (userRole.includes("super")) {
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- System Default --"
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
          "-- All Facilities --"
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
        "-- All Facilities --"
      );
    } else {
      hideOrg();
      hideFac();
    }
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
        sessionStorage.getItem("billingTriggerEditPayload") || "null"
      );

      if (!entry) {
        const res = await authFetch(`/api/billing-triggers/${triggerId}`);
        const json = await res.json();
        entry = json?.data;
      }

      if (!entry) throw new Error("Billing trigger not found");

      document.getElementById("module_key").value =
        entry.module_key || "";
      document.getElementById("trigger_status").value =
        entry.trigger_status || "";

      if (statusEl) {
        statusEl.value = entry.is_active ? "true" : "false";
      }

      setFormTitle("Update Billing Trigger");
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to load billing trigger");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT — RULE-DRIVEN (CONTROLLER-ALIGNED)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of BILLING_TRIGGER_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || el.value === "" || el.value === null) {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const method = isEdit ? "PUT" : "POST";
    const url = isEdit
      ? `/api/billing-triggers/${triggerId}`
      : `/api/billing-triggers`;

    const payload = {
      module_key: document.getElementById("module_key").value,
      trigger_status: document.getElementById("trigger_status").value,
      is_active: statusEl?.value === "true",
    };

    if (userRole.includes("super")) {
      payload.organization_id = orgSelect?.value || null;
      payload.facility_id = facSelect?.value || null;
    }

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!res.ok) {
        applyServerErrors(form, result?.errors);
        throw new Error(normalizeMessage(result, "Submission failed"));
      }

      showToast(
        isEdit
          ? "✅ Billing trigger updated"
          : "✅ Billing trigger created"
      );

      sessionStorage.clear();
      window.location.href = "/billing-triggers-list.html";
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
    window.location.href = "/billing-triggers-list.html";
  });

  document.querySelector("button[type=reset]")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    if (statusEl) statusEl.value = "true";
    setFormTitle("Add Billing Trigger");
  });
}
