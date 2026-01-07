// 📦 autoBillingRule-form.js – Secure & Permission-Driven Auto Billing Rule Form (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: billableitem-form.js / vital-form.js
// 🔹 Enterprise submission flow, tenant scoping, and role-aware dropdowns
// 🔹 Auto-filled Trigger Module from Feature Module (read-only)
// 🔹 100% ID-safe for linked HTML + JS
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadBillableItemsLite,
  loadFeatureModulesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔧 Helpers
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

function validateRuleFields({ trigger_feature_module_id, trigger_module, billable_item_id, charge_mode }) {
  if (!trigger_feature_module_id) return showToast("❌ Feature Module is required"), false;
  if (!trigger_module) return showToast("❌ Trigger Module is required"), false;
  if (!billable_item_id) return showToast("❌ Billable Item is required"), false;
  if (!charge_mode) return showToast("❌ Charge Mode is required"), false;
  return true;
}

function resolveTenantScope() {
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
  const userOrg = localStorage.getItem("organization_id") || null;
  const userFac = localStorage.getItem("facility_id") || null;
  return {
    userRole,
    userOrg,
    userFac,
    isSuper: userRole.includes("super"),
    isAdmin: userRole.includes("admin"),
    isFacilityHead:
      userRole.includes("facilityhead") || userRole.includes("manager"),
  };
}

/* ============================================================
   🚀 Main Form Setup
============================================================ */
export async function setupAutoBillingRuleFormSubmission({ form }) {
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const queryId = getQueryParam("id");
  const sessionId = sessionStorage.getItem("autoBillingRuleEditId");
  const ruleId = sessionId || queryId;
  const isEdit = !!ruleId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");

  if (isEdit) {
    titleEl && (titleEl.textContent = "Edit Auto Billing Rule");
    submitBtn && (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Rule`);
  } else {
    titleEl && (titleEl.textContent = "Add Auto Billing Rule");
    submitBtn && (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Rule`);
  }

  // 📋 DOM Refs
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const featureSelect = document.getElementById("featureModuleSelect");
  const triggerInput = document.getElementById("triggerModuleInput");
  const billableSelect = document.getElementById("billableItemSelect");
  const autoGenInput = document.getElementById("autoGenerate");
  const chargeModeInput = document.getElementById("chargeMode");
  const defaultPriceInput = document.getElementById("defaultPrice");

  /* ============================================================
     📥 Prefill Dropdowns
  ============================================================ */
  try {
    const { isSuper, isAdmin, userOrg } = resolveTenantScope();

    if (isSuper) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (isAdmin) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({ organization_id: userOrg }, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    const featureModules = await loadFeatureModulesLite();
    setupSelectOptions(
      featureSelect,
      featureModules,
      "id",
      "name",
      "-- Select Feature Module --"
    );

    const billables = await loadBillableItemsLite({}, true);
    setupSelectOptions(
      billableSelect,
      billables,
      "id",
      "name",
      "-- Select Billable Item --"
    );
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     ⚡ Auto-fill Trigger Module when Feature selected
  ============================================================ */
  featureSelect?.addEventListener("change", function () {
    const selectedText = featureSelect.options[featureSelect.selectedIndex]?.text || "";
    const key = selectedText
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");
    triggerInput.value = key;
    triggerInput.dataset.key = key;
    triggerInput.dataset.id = featureSelect.value || null;
  });

  /* ============================================================
     🧩 Prefill If Editing
  ============================================================ */
  if (isEdit && ruleId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("autoBillingRuleEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/auto-billing-rules/${ruleId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(normalizeMessage(result, `❌ Failed to load rule (${res.status})`));
        entry = result.data;
      }

      orgSelect.value = entry.organization_id || "";
      facSelect.value = entry.facility_id || "";
      featureSelect.value = entry.trigger_feature_module_id || "";
      triggerInput.value = entry.trigger_module || "";
      billableSelect.value = entry.billable_item_id || "";
      autoGenInput.checked = !!entry.auto_generate;
      chargeModeInput.value = entry.charge_mode || "";
      defaultPriceInput.value = entry.default_price || "";

      if (entry.status) {
        const radio = document.getElementById(`status_${entry.status.toLowerCase()}`);
        if (radio) radio.checked = true;
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Could not load Auto Billing Rule");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🧾 Submit
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    try {
      showLoading();

      const payload = {
        trigger_feature_module_id: featureSelect.value || null,
        trigger_module: triggerInput.dataset.key || triggerInput.value.trim(),
        billable_item_id: billableSelect.value || null,
        auto_generate: autoGenInput.checked || false,
        charge_mode: chargeModeInput.value || "",
        default_price: defaultPriceInput.value || null,
        organization_id: orgSelect?.value || null,
        facility_id: facSelect?.value || null,
      };

      if (!validateRuleFields(payload)) return;

      const { isSuper, isAdmin, userOrg, userFac } = resolveTenantScope();

      if (isSuper) {
        payload.organization_id = orgSelect.value || null;
        payload.facility_id = facSelect.value || null;
      } else if (isAdmin) {
        payload.organization_id = userOrg;
        payload.facility_id = facSelect.value || null;
      } else {
        payload.organization_id = userOrg;
        payload.facility_id = userFac;
      }

      delete payload.status;

      const url = isEdit
        ? `/api/auto-billing-rules/${ruleId}`
        : `/api/auto-billing-rules`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ Auto Billing Rule updated successfully");
        sessionStorage.removeItem("autoBillingRuleEditId");
        sessionStorage.removeItem("autoBillingRuleEditPayload");
        window.location.href = "/autoBillingRules-list.html";
        return;
      }

      showToast("✅ Auto Billing Rule added successfully");
      form.reset();
      triggerInput.value = "";
      document.getElementById("status_active")?.setAttribute("checked", true);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🧹 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("autoBillingRuleEditId");
    sessionStorage.removeItem("autoBillingRuleEditPayload");
    window.location.href = "/autoBillingRules-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    form.reset();
    triggerInput.value = "";
    sessionStorage.removeItem("autoBillingRuleEditId");
    sessionStorage.removeItem("autoBillingRuleEditPayload");
    document.getElementById("status_active")?.setAttribute("checked", true);
    titleEl && (titleEl.textContent = "Add Auto Billing Rule");
  });
}
