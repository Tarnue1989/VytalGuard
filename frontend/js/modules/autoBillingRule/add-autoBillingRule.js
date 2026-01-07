// 📦 add-autoBillingRule.js – Enterprise-Aligned Page Controller (Add/Edit)
// ============================================================================
// 🧭 Master Pattern: billableitem-main.js / vital-main.js
// 🔹 Role-aware dropdown setup (organization/facility)
// 🔹 Secure edit-mode prefill and reset-to-add flow
// 🔹 Auto-filled trigger module from Feature Module (read-only)
// 🔹 100% ID-safe for HTML + linked JS modules
// ============================================================================

import { setupAutoBillingRuleFormSubmission } from "./autoBillingRule-form.js";

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
  loadFacilitiesLite,
  loadOrganizationsLite,
  loadBillableItemsLite,
  loadFeatureModulesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard – secure permission-driven initialization
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🧭 Shared References
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  const form = document.getElementById("autoBillingRuleForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset radio to Active
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // Reset selects & inputs
  [
    "organizationSelect",
    "facilitySelect",
    "featureModuleSelect",
    "billableItemSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const triggerInput = document.getElementById("triggerModuleInput");
  if (triggerInput) {
    triggerInput.value = "";
    delete triggerInput.dataset.key;
    delete triggerInput.dataset.id;
  }

  ["chargeMode", "defaultPrice"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const autoGen = document.getElementById("autoGenerate");
  if (autoGen) autoGen.checked = false;

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Auto Billing Rule";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Rule`;
}

/* ============================================================
   🚀 Main Initialization
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("autoBillingRuleForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const featureSelect = document.getElementById("featureModuleSelect");
  const triggerInput = document.getElementById("triggerModuleInput");
  const billableSelect = document.getElementById("billableItemSelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* --------------------- Organization & Facility --------------------- */
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      orgSelect?.addEventListener("change", async () => {
        const orgId = orgSelect.value;
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      });

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility");
  }

  /* --------------------- Feature Modules Dropdown --------------------- */
  try {
    const modules = await loadFeatureModulesLite(true);
    setupSelectOptions(
      featureSelect,
      modules,
      "id",
      "name",
      "-- Select Feature Module --"
    );

    // 🔹 Auto-fill Trigger Module on change
    featureSelect.addEventListener("change", () => {
      const selectedText =
        featureSelect.options[featureSelect.selectedIndex]?.text || "";
      const key = selectedText
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");
      triggerInput.value = key;
      triggerInput.dataset.key = key;
      triggerInput.dataset.id = featureSelect.value || null;
    });
  } catch (err) {
    console.error("❌ Feature module preload failed:", err);
    showToast("❌ Could not load feature modules");
  }

  /* --------------------- Billable Items Dropdown --------------------- */
  try {
    const billables = await loadBillableItemsLite({}, true);
    setupSelectOptions(
      billableSelect,
      billables,
      "id",
      "name",
      "-- Select Billable Item --"
    );
  } catch (err) {
    console.error("❌ Billable items preload failed:", err);
    showToast("❌ Could not load billable items");
  }

  /* --------------------- Form Setup & Submission --------------------- */
  setupAutoBillingRuleFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("autoBillingRuleEditId");
  const rawPayload = sessionStorage.getItem("autoBillingRuleEditPayload");

  async function applyPrefill(entry) {
    const featureSelect = document.getElementById("featureModuleSelect");
    if (featureSelect) featureSelect.value = entry.trigger_feature_module_id || "";

    const triggerInput = document.getElementById("triggerModuleInput");
    if (triggerInput) {
      triggerInput.value = entry.trigger_module || "";
      triggerInput.dataset.key = entry.trigger_module || "";
    }

    if (entry.billable_item_id && billableSelect) {
      billableSelect.value = entry.billable_item_id;
    }
    document.getElementById("autoGenerate").checked = !!entry.auto_generate;
    document.getElementById("chargeMode").value = entry.charge_mode || "";
    document.getElementById("defaultPrice").value = entry.default_price || "";

    if (entry.status) {
      const statusEl = document.getElementById(`status_${entry.status.toLowerCase()}`);
      if (statusEl) statusEl.checked = true;
    }

    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      if (userRole.includes("super")) {
        const facs = await loadFacilitiesLite(
          { organization_id: entry.organization.id },
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
    }
    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Auto Billing Rule";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Rule`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached rule for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/auto-billing-rules/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch rule");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load rule:", err);
        showToast(err.message || "❌ Failed to load rule for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("autoBillingRuleEditId");
    sessionStorage.removeItem("autoBillingRuleEditPayload");
    window.location.href = "/autoBillingRules-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("autoBillingRuleEditId");
    sessionStorage.removeItem("autoBillingRuleEditPayload");
    resetForm();
  });
});
