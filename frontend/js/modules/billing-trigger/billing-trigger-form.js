// 📦 billing-trigger-form.js – Enterprise-Final (FULLY FIXED)

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
  loadFeatureModulesLite, // 🔥 NEW
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { BILLING_TRIGGER_FORM_RULES } from "./billing-trigger.form.rules.js";

/* ============================================================ */
const getQueryParam = (k) =>
  new URLSearchParams(window.location.search).get(k);

const normalizeMessage = (res, fallback) => {
  if (!res) return fallback;
  const msg = res.message ?? res.error ?? res.msg;
  return typeof msg === "string" ? msg : fallback;
};

/* ============================================================ */
async function applyBillingTriggerPrefill(entry, {
  userRole,
  orgSelect,
  facSelect,
  statusEl,
  setTitle,
  moduleSelect,
}) {
  document.getElementById("module_key").value =
    entry.module_key || "";

  document.getElementById("trigger_status").value =
    entry.trigger_status || "";

  if (statusEl) {
    statusEl.value = entry.is_active ? "true" : "false";
  }

  // 🔥 set module id
  if (entry.feature_module_id && moduleSelect) {
    moduleSelect.value = entry.feature_module_id;
  }

  if (userRole.includes("super") && entry.organization_id) {
    orgSelect.value = entry.organization_id;

    setupSelectOptions(
      facSelect,
      await loadFacilitiesLite(
        { organization_id: entry.organization_id },
        true
      ),
      "id",
      "name",
      "-- All Facilities --"
    );

    if (entry.facility_id) {
      facSelect.value = entry.facility_id;
    }
  } else if (userRole.includes("admin") && entry.facility_id) {
    facSelect.value = entry.facility_id;
  }

  setTitle("Update Billing Trigger");
}

/* ============================================================ */
export async function setupBillingTriggerFormSubmission({
  form,
  sharedState,
}) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const triggerId =
    sharedState?.currentEditIdRef?.value ||
    sessionStorage.getItem("billingTriggerEditId") ||
    getQueryParam("id");

  const isEdit = Boolean(triggerId);
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ---------------- DOM ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const moduleSelect = document.getElementById("feature_module_id"); // 🔥 NEW
  const moduleKeyInput = document.getElementById("module_key"); // 🔥 NEW
  const statusEl = document.getElementById("is_active");
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setTitle = (txt) => {
    if (titleEl) titleEl.textContent = txt;
    if (submitBtn) {
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> ${txt}`;
    }
  };

  setTitle(isEdit ? "Update Billing Trigger" : "Add Billing Trigger");

  /* ============================================================
     🔥 LOAD FEATURE MODULES
  ============================================================ */
  try {
    const modules = await loadFeatureModulesLite();

    setupSelectOptions(
      moduleSelect,
      modules,
      "id",
      "name",
      "-- Select Module --"
    );

    moduleSelect.addEventListener("change", () => {
      const selected =
        modules.find((m) => m.id === moduleSelect.value);

      moduleKeyInput.value = selected?.key || "";
    });
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load feature modules");
  }

  /* ============================================================
     🔐 ORG / FACILITY
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
    showToast("❌ Failed to load organization/facility data");
  }

  /* ============================================================
     ✏️ PREFILL
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

      await applyBillingTriggerPrefill(entry, {
        userRole,
        orgSelect,
        facSelect,
        statusEl,
        setTitle,
        moduleSelect,
      });
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to load billing trigger");
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

    for (const rule of BILLING_TRIGGER_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el) continue;

      // ✅ SKIP HIDDEN FIELDS (CRITICAL)
      if (el.closest(".hidden")) continue;

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
      feature_module_id: moduleSelect.value, // 🔥 REQUIRED
      module_key: moduleKeyInput.value.trim(), // 🔥 AUTO
      trigger_status: document
        .getElementById("trigger_status")
        .value.trim(),
      is_active: statusEl?.value === "true",
    };

    if (userRole.includes("super")) {
      payload.organization_id = orgSelect?.value || null;
      if (facSelect && facSelect.value) {
        payload.facility_id = facSelect.value;
      }

    } else if (userRole.includes("admin")) {
      // ✅ SEND FACILITY FOR ORG ADMIN
      if (facSelect && facSelect.value) {
        payload.facility_id = facSelect.value;
      }
    }

    const method = isEdit ? "PUT" : "POST";
    const url = isEdit
      ? `/api/billing-triggers/${triggerId}`
      : `/api/billing-triggers`;

    try {
      showLoading();

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        applyServerErrors(form, result?.errors);
        throw new Error(
          normalizeMessage(result, "❌ Submission failed")
        );
      }

      showToast(
        isEdit
          ? "✅ Billing trigger updated"
          : "✅ Billing trigger created"
      );

      sessionStorage.removeItem("billingTriggerEditId");
      sessionStorage.removeItem("billingTriggerEditPayload");
      window.location.href = "/billing-triggers-list.html";
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     ⏮️ CANCEL / RESET
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("billingTriggerEditId");
    sessionStorage.removeItem("billingTriggerEditPayload");
    window.location.href = "/billing-triggers-list.html";
  });

  form.addEventListener("reset", () => {
    clearFormErrors(form);
    form.reset();
    if (statusEl) statusEl.value = "true";
    setTitle("Add Billing Trigger");
  });
}