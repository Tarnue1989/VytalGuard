// 📦 autoBillingRule-form.js – FULL ENTERPRISE MASTER ORCHESTRATION (FIXED)
// ============================================================================
// 🔥 FIX INCLUDED: CATEGORY → BILLABLE LINK
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
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadBillableItemsLite,
  loadFeatureModulesLite,
  loadMasterItemCategoriesLite, // 🔥 ADDED
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { AUTO_BILLING_RULE_FORM_RULES } from "./autoBillingRule-form-rules.js";

/* ============================================================ */
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

/* ============================================================ */
export async function setupAutoBillingRuleFormSubmission({ form }) {
  initPageGuard(
    autoPagePermissionKey(["auto_billing_rule:create", "auto_billing_rule:edit"])
  );
  initLogoutWatcher();
  enableLiveValidation(form);

  const ruleId =
    sessionStorage.getItem("autoBillingRuleEditId") || getQueryParam("id");
  const isEdit = Boolean(ruleId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit"
          ? "Update Auto Billing Rule"
          : "Add Auto Billing Rule";

    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update`
          : `<i class="ri-add-line me-1"></i> Add Rule`;
  };

  setUI(isEdit ? "edit" : "add");

  /* ================= DOM ================= */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const featureSelect = document.getElementById("featureModuleSelect");
  const triggerInput = document.getElementById("triggerModuleInput");
  const billableSelect = document.getElementById("billableItemSelect");
  const categorySelect = document.getElementById("categorySelect"); // 🔥 ADDED

  const autoGenInput = document.getElementById("autoGenerate");
  const chargeModeInput = document.getElementById("chargeMode");
  const defaultPriceInput = document.getElementById("defaultPrice");

  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ============================================================
     🌐 DROPDOWNS
  ============================================================ */
  try {
    /* ================= CATEGORY ================= */
    setupSelectOptions(
      categorySelect,
      await loadMasterItemCategoriesLite({ status: "active" }, true),
      "id",
      "name",
      "-- Select Category --"
    );

    /* ================= BILLABLE INIT (LOCKED) ================= */
    setupSelectOptions(
      billableSelect,
      [],
      "id",
      "name",
      "-- Select Category First --"
    );
    billableSelect.disabled = true;

    /* ================= CATEGORY → BILLABLE ================= */
    categorySelect.addEventListener("change", async () => {
      const category_id = categorySelect.value;

      setupSelectOptions(
        billableSelect,
        [],
        "id",
        "name",
        "-- Loading... --"
      );
      billableSelect.disabled = true;

      if (!category_id) return;

      const items = await loadBillableItemsLite({
        category_id,
      });

      setupSelectOptions(
        billableSelect,
        items,
        "id",
        "name",
        "-- Select Billable Item --"
      );

      billableSelect.disabled = false;
    });

    /* ================= ORG / FAC ================= */
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
          "-- Select Facility --"
        );
      };

      await reloadFacilities();

      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );

    } else if (userRole.includes("org")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );

    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    /* ================= FEATURE ================= */
    setupSelectOptions(
      featureSelect,
      await loadFeatureModulesLite(),
      "id",
      "name",
      "-- Select Feature Module --"
    );

  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ================= TRIGGER ================= */
  featureSelect?.addEventListener("change", () => {
    const text =
      featureSelect.options[featureSelect.selectedIndex]?.text || "";

    const key = text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");

    triggerInput.value = key;
    triggerInput.dataset.key = key;
  });

  /* ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of AUTO_BILLING_RULE_FORM_RULES) {
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

    const role = (userRole || "").toLowerCase();

    const payload = {
      trigger_feature_module_id: normalizeUUID(featureSelect.value),
      billable_item_id: normalizeUUID(billableSelect.value),
      auto_generate: autoGenInput.checked,
      charge_mode: chargeModeInput.value,
      default_price:
        defaultPriceInput.value !== ""
          ? Number(defaultPriceInput.value)
          : null,

      facility_id: role.includes("org")
        ? normalizeUUID(facSelect?.value) ||
          localStorage.getItem("facility_id")
        : normalizeUUID(facSelect?.value),
    };

    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect.value);
      payload.facility_id = normalizeUUID(facSelect.value);
    }

    try {
      showLoading();

      const res = await authFetch(
        isEdit
          ? `/api/auto-billing-rules/${ruleId}`
          : `/api/auto-billing-rules`,
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
          ? "✅ Auto Billing Rule updated"
          : "✅ Auto Billing Rule created"
      );

      sessionStorage.clear();
      window.location.href = "/autoBillingRules-list.html";

    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };
}