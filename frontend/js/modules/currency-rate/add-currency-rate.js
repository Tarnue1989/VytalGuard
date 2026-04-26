// 📦 add-currency-rate.js – Secure Add/Edit Page Controller for Currency Rates (Enterprise Master)
// ============================================================================
// 🧭 Mirrors add-role.js architecture (1:1)
// 🔹 Unified auth guard + dropdown preload
// 🔹 Delegates ALL business logic to currency-rate-form.js
// 🔹 Handles edit-prefill (cache + API fallback)
// 🔹 Preserves all HTML IDs
// ============================================================================

import { setupCurrencyRateFormSubmission } from "./currency-rate-form.js";

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { authFetch } from "../../authSession.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  const form = document.getElementById("currencyRateForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById("status_active")?.setAttribute("checked", true);

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Currency Rate";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Rate`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("currencyRateForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🏢 Organization / Facility (1:1)
  ============================================================ */
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        orgSelect,
        orgs,
        "id",
        "name",
        "-- Select Organization --"
      );

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(
          facSelect,
          facs,
          "id",
          "name",
          "-- Select Facility (optional) --"
        );
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(
        facSelect,
        facs,
        "id",
        "name",
        "-- Select Facility (optional) --"
      );
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility");
  }

  /* ============================================================
     🧾 Form Setup
  ============================================================ */
  setupCurrencyRateFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("currencyRateEditId");
  const rawPayload = sessionStorage.getItem("currencyRateEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("from_currency").value = entry.from_currency || "";
    document.getElementById("to_currency").value = entry.to_currency || "";
    document.getElementById("rate").value = entry.rate || "";
    document.getElementById("effective_date").value =
      entry.effective_date?.split("T")[0] || "";

    if (entry.organization_id && orgSelect) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
      orgSelect.value = entry.organization_id;
    }

    if (entry.facility_id && facSelect) {
      const facs = await loadFacilitiesLite(
        entry.organization_id
          ? { organization_id: entry.organization_id }
          : {},
        true
      );
      setupSelectOptions(
        facSelect,
        facs,
        "id",
        "name",
        "-- Select Facility (optional) --"
      );
      facSelect.value = entry.facility_id;
    }

    if (entry.status) {
      document
        .getElementById(`status_${entry.status}`)
        ?.setAttribute("checked", true);
    }

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Currency Rate";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Rate`;
  }

  if (editId && rawPayload) {
    try {
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(JSON.parse(rawPayload));
    } catch (err) {
      console.error("❌ Cached load failed:", err);
      showToast("❌ Could not load cached data");
    }
  } else {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/currency-rates/${id}`);
        const result = await res.json();

        if (!res.ok || !result?.data)
          throw new Error(result.message || "Failed to load record");

        await applyPrefill(result.data);
      } catch (err) {
        console.error(err);
        showToast(err.message || "❌ Failed to load currency rate");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("currencyRateEditId");
    sessionStorage.removeItem("currencyRateEditPayload");
    window.location.href = "/currency-rates-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("currencyRateEditId");
    sessionStorage.removeItem("currencyRateEditPayload");
    resetForm();
  });
});