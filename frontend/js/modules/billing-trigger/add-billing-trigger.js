// 📦 add-billing-trigger.js – FULL MASTER FIXED

import { setupBillingTriggerFormSubmission } from "./billing-trigger-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadFeatureModulesLite, // 🔥 NEW
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================ */
initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================ */
const form = document.getElementById("billingTriggerForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.querySelector("button[type=reset]");

const orgSelect = document.getElementById("organizationSelect");
const facSelect = document.getElementById("facilitySelect");

const moduleSelect = document.getElementById("feature_module_id"); // 🔥 NEW
const moduleKeyInput = document.getElementById("module_key"); // 🔥 NEW

/* ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  if (!form) return;

  const roleRaw = (localStorage.getItem("userRole") || "").toLowerCase();
  const isSuper = roleRaw.includes("super");
  const isAdmin = roleRaw.includes("admin") && !isSuper;

  /* ======================================================== */
  const editId =
    sessionStorage.getItem("billingTriggerEditId") ||
    new URLSearchParams(window.location.search).get("id");

  if (editId) {
    sharedState.currentEditIdRef.value = editId;
  }

  /* ========================================================
     🔥 LOAD FEATURE MODULES (NEW)
  ======================================================== */
  let modules = [];
  try {
    modules = await loadFeatureModulesLite();

    setupSelectOptions(
      moduleSelect,
      modules,
      "id",
      "name",
      "-- Select Module --"
    );

    moduleSelect.addEventListener("change", () => {
      const selected = modules.find(
        (m) => m.id === moduleSelect.value
      );
      moduleKeyInput.value = selected?.key || "";
    });
  } catch (err) {
    console.error("❌ Module preload failed:", err);
  }

  /* ======================================================== */
  try {
    if (isSuper) {
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
    } else if (isAdmin) {
      orgSelect?.closest(".mb-3")?.classList.add("hidden");

      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- All Facilities --"
      );
    } else {
      orgSelect?.closest(".mb-3")?.classList.add("hidden");
      facSelect?.closest(".mb-3")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
  }

  /* ======================================================== */
  setupBillingTriggerFormSubmission({
    form,
    sharedState,
  });

  /* ========================================================
     ✏️ PREFILL (FIXED)
  ======================================================== */
  async function applyPrefill(entry) {
    moduleKeyInput.value = entry.module_key || "";
    document.getElementById("trigger_status").value =
      entry.trigger_status || "";

    // 🔥 SET MODULE SELECT
    if (entry.feature_module_id) {
      moduleSelect.value = entry.feature_module_id;

      // 🔥 FORCE UI SYNC (THIS IS WHAT YOU WERE MISSING)
      moduleSelect.dispatchEvent(new Event("change"));
    }
    const statusEl = document.getElementById("is_active");
    if (statusEl) {
      statusEl.value = entry.is_active ? "true" : "false";
    }

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Billing Trigger";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Billing Trigger`;
    }

    if (isSuper && entry.organization_id) {
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

      if (entry.facility_id) facSelect.value = entry.facility_id;
    } else if (isAdmin && entry.facility_id) {
      facSelect.value = entry.facility_id;
    }
  }

  /* ======================================================== */
  if (editId) {
    const cached = sessionStorage.getItem("billingTriggerEditPayload");

    try {
      if (cached) {
        await applyPrefill(JSON.parse(cached));
      } else {
        const res = await authFetch(`/api/billing-triggers/${editId}`);
        const result = await res.json();
        if (res.ok && result?.data) {
          await applyPrefill(result.data);
        }
      }
    } catch (err) {
      console.error("❌ Edit prefill failed:", err);
    }
  }

  /* ======================================================== */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("billingTriggerEditId");
    sessionStorage.removeItem("billingTriggerEditPayload");
    window.location.href = "/billing-triggers-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("billingTriggerEditId");
    sessionStorage.removeItem("billingTriggerEditPayload");
    window.location.reload();
  });
});