// 📦 autoBillingRule-form.js – FINAL ENTERPRISE MASTER (CLEAN + COMPLETE)
// ============================================================================
// ✔ Org only visible for superadmin
// ✔ Category → API preserved
// ✔ Pills (multi-select)
// ✔ Add-all by category
// ✔ Validation fixed (pills aware)
// ✔ Backend aligned
// ✔ 🔥 FIX: Pills reset correctly (MASTER role-style)
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
  loadMasterItemCategoriesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
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
// ✅ FIX: no global
let selectedItems = [];
let pillsContainer = null;
let currentCategoryItems = [];

/* ============================================================ */
function renderPills() {
  if (!pillsContainer) return;

  pillsContainer.innerHTML = "";

  if (!selectedItems.length) {
    pillsContainer.innerHTML =
      `<p class="text-muted">No billable items added yet.</p>`;
    return;
  }

  selectedItems.forEach((item, idx) => {
    const pill = document.createElement("div");
    pill.className = "pill";

    pill.innerHTML = `
      ${item.name}
      <button type="button" class="pill-remove" data-idx="${idx}">
        <i class="ri-close-line"></i>
      </button>
    `;

    pillsContainer.appendChild(pill);
  });

  pillsContainer.querySelectorAll(".pill-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      selectedItems.splice(idx, 1);
      renderPills();
    });
  });
}

/* ============================================================ */
function addItem(item) {
  if (!item?.id) return;

  if (selectedItems.some(i => i.id === item.id)) {
    showToast("⚠️ Item already added");
    return;
  }

  selectedItems.push({ id: item.id, name: item.name });
  renderPills();
}

/* ============================================================ */
// ✅ FIX: MASTER ROLE-STYLE STATE EXPORT
export function getAutoBillingFormState() {
  return {
    resetPills: () => {
      selectedItems.length = 0;
      renderPills();
    }
  };
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

  if (titleEl)
    titleEl.textContent = isEdit
      ? "Update Auto Billing Rule"
      : "Add Auto Billing Rule";

  if (submitBtn)
    submitBtn.innerHTML = isEdit
      ? `<i class="ri-save-3-line me-1"></i> Update`
      : `<i class="ri-add-line me-1"></i> Add Rule`;

  /* ================= DOM ================= */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const featureSelect = document.getElementById("featureModuleSelect");
  const triggerInput = document.getElementById("triggerModuleInput");
  const categorySelect = document.getElementById("categorySelect");

  const billableInput = document.getElementById("billableSearch");
  const billableSuggestions = document.getElementById("billableSearchSuggestions");
  const addCategoryBtn = document.getElementById("addCategoryItemsBtn");

  pillsContainer = document.getElementById("billablePillsContainer");

  const autoGenInput = document.getElementById("autoGenerate");
  const chargeModeInput = document.getElementById("chargeMode");
  const defaultPriceInput = document.getElementById("defaultPrice");

  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ============================================================
    DROPDOWNS (ENTERPRISE MASTER – ROLE AWARE)
  ============================================================ */
  try {
    /* ---------------- CATEGORY ---------------- */
    setupSelectOptions(
      categorySelect,
      await loadMasterItemCategoriesLite({ status: "active" }, true),
      "id",
      "name",
      "-- Select Category --"
    );

    /* ---------------- FEATURE MODULE ---------------- */
    setupSelectOptions(
      featureSelect,
      await loadFeatureModulesLite(),
      "id",
      "name",
      "-- Select Feature Module --"
    );

    /* ---------------- ROLE DETECTION ---------------- */
    const role = (userRole || "").toLowerCase();
    const isSuperAdmin = role.includes("super");
    const isOrgUser = role.includes("org");

    let reloadFacilities = null;

    /* ============================================================
      🟢 SUPER ADMIN FLOW
    ============================================================ */
    if (isSuperAdmin) {
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
      );

      reloadFacilities = async (orgId = null) => {
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

      // initial load
      await reloadFacilities();

      // org → facilities
      orgSelect?.addEventListener("change", async () => {
        const orgId = orgSelect.value || null;
        await reloadFacilities(orgId);

        // reset facility selection
        if (facSelect) facSelect.value = "";
      });
    }

    /* ============================================================
      🔵 NON-SUPER FLOW
    ============================================================ */
    else {
      // hide org ALWAYS
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      /* ---------------- ORG LEVEL USER ---------------- */
      if (isOrgUser) {
        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite({}, true),
          "id",
          "name",
          "-- Select Facility --"
        );
      }

      /* ---------------- FACILITY LEVEL USER ---------------- */
      else {
        // hide facility too
        facSelect?.closest(".form-group")?.classList.add("hidden");
      }
    }

  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     CATEGORY → API
  ============================================================ */
  categorySelect.addEventListener("change", async () => {
    const category_id = categorySelect.value;
    currentCategoryItems = [];

    if (!category_id) return;

    try {
      currentCategoryItems = await loadBillableItemsLite({ category_id });
    } catch {
      showToast("❌ Failed to load billable items");
    }
  });

  /* ============================================================
     SEARCH
  ============================================================ */
  setupSuggestionInputDynamic(
    billableInput,
    billableSuggestions,
    "/api/lite/billable-items",
    (item) => addItem(item),
    "name",
    {
      extraParams: () => {
        const category_id = categorySelect?.value;
        return category_id ? { category_id } : {};
      },
    }
  );

  /* ============================================================
     ADD ALL
  ============================================================ */
  addCategoryBtn?.addEventListener("click", () => {
    if (!categorySelect.value) {
      showToast("⚠️ Select category first");
      return;
    }

    if (!currentCategoryItems.length) {
      showToast("⚠️ No items found for this category");
      return;
    }

    currentCategoryItems.forEach(addItem);
  });

  /* ============================================================
     TRIGGER
  ============================================================ */
  featureSelect?.addEventListener("change", () => {
    const text =
      featureSelect.options[featureSelect.selectedIndex]?.text || "";

    const key = text.toLowerCase().replace(/\s+/g, "-");
    triggerInput.value = key;
  });

  /* ============================================================
     SUBMIT
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of AUTO_BILLING_RULE_FORM_RULES) {
      if (rule.id === "billablePillsContainer") {
        if (!selectedItems.length) {
          errors.push({ field: rule.id, message: rule.message });
        }
        continue;
      }

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
      billable_item_ids: selectedItems.map(i => i.id),
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
        throw new Error(normalizeMessage(result, "❌ Server error"));

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