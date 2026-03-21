// 📦 autoBillingRule-form.js – FULL ENTERPRISE MASTER ORCHESTRATION
// ============================================================================
// 🔹 Rule-driven validation (AUTO_BILLING_RULE_FORM_RULES)
// 🔹 RegistrationLog parity (validation, UX, flow)
// 🔹 Role-aware scope enforcement
// 🔹 Clean payload normalization
// 🔹 NO API changes
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
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { AUTO_BILLING_RULE_FORM_RULES } from "./autoBillingRule-form-rules.js";

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
   🚀 MAIN
============================================================ */
export async function setupAutoBillingRuleFormSubmission({ form }) {
  initPageGuard(
    autoPagePermissionKey(["auto_billing_rule:create", "auto_billing_rule:edit"])
  );
  initLogoutWatcher();
  enableLiveValidation(form);

  const ruleId =
    sessionStorage.getItem("autoBillingRuleEditId") || getQueryParam("id");
  const isEdit = Boolean(ruleId);

  /* ================= UI ================= */
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
  const autoGenInput = document.getElementById("autoGenerate");
  const chargeModeInput = document.getElementById("chargeMode");
  const defaultPriceInput = document.getElementById("defaultPrice");

  /* ================= ROLE ================= */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ============================================================
    🌐 DROPDOWNS (MASTER — FIXED)
  ============================================================ */
  try {
    if (isSuper) {
      // ================= SUPER ADMIN =================
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

    } else if (userRole === "orgadmin" || userRole.includes("org")) {
      // ================= ORG ADMIN (FIXED) =================
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );

    } else {
      // ================= FACILITY / STAFF =================
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // ================= FEATURE MODULE =================
    setupSelectOptions(
      featureSelect,
      await loadFeatureModulesLite(),
      "id",
      "name",
      "-- Select Feature Module --"
    );

    // ================= BILLABLE ITEM =================
    setupSelectOptions(
      billableSelect,
      await loadBillableItemsLite({}, true),
      "id",
      "name",
      "-- Select Billable Item --"
    );

  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }
  /* ============================================================
     ⚡ AUTO-FILL TRIGGER MODULE
  ============================================================ */
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

  /* ============================================================
     ✏️ PREFILL
  ============================================================ */
  if (isEdit && ruleId) {
    try {
      showLoading();

      let entry = JSON.parse(
        sessionStorage.getItem("autoBillingRuleEditPayload") || "null"
      );

      if (!entry) {
        const res = await authFetch(`/api/auto-billing-rules/${ruleId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            normalizeMessage(json, "Failed to load rule")
          );
        entry = json?.data;
      }

      if (!entry) throw new Error("Rule not found");

      featureSelect.value = entry.trigger_feature_module_id || "";
      triggerInput.value = entry.trigger_module || "";
      billableSelect.value = entry.billable_item_id || "";
      autoGenInput.checked = !!entry.auto_generate;
      chargeModeInput.value = entry.charge_mode || "";
      defaultPriceInput.value = entry.default_price || "";

      if (isSuper) {
        orgSelect.value = entry.organization_id || "";
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

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load rule");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
    🛡️ SUBMIT (RULE ENGINE — MASTER FIXED)
  ============================================================ */
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

    /* ========================================================
      📦 PAYLOAD (MASTER PARITY)
    ======================================================== */
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

      // 🔥 KEY FIX — ROLE-AWARE FACILITY
      facility_id: role.includes("org")
        ? normalizeUUID(facSelect?.value) ||
          localStorage.getItem("facility_id")
        : normalizeUUID(facSelect?.value),
    };

    // 🔓 SUPER ADMIN EXTRA
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
  /* ================= Cancel / Clear ================= */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/autoBillingRules-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI("add");
  });
}