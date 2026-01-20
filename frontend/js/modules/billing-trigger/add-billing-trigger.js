// 📦 add-billing-trigger.js – Billing Trigger Form Page Controller (ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL PARITY WITH billableitem-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Role-aware org/fac loading ONLY
// 🔹 Edit session coordination (sessionStorage + URL)
// 🔹 Delegates ALL business logic to billing-trigger-form.js
// 🔹 ❌ Never builds payloads
// 🔹 ❌ Never validates fields
// ============================================================================

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
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State (SINGLE SOURCE OF TRUTH)
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("billingTriggerForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.querySelector("button[type=reset]");

const orgSelect = document.getElementById("organizationSelect");
const facSelect = document.getElementById("facilitySelect");

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  if (!form) return;

  const roleRaw = (localStorage.getItem("userRole") || "").toLowerCase();
  const isSuper = roleRaw.includes("super");
  const isAdmin = roleRaw.includes("admin") && !isSuper;

  /* ========================================================
     🔑 EDIT MODE DETECTION (FIRST — MASTER RULE)
  ======================================================== */
  const editId =
    sessionStorage.getItem("billingTriggerEditId") ||
    new URLSearchParams(window.location.search).get("id");

  if (editId) {
    sharedState.currentEditIdRef.value = editId;
  }

  /* ========================================================
     🌐 ORGANIZATION / FACILITY (ROLE-OWNED)
  ======================================================== */
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

  /* ========================================================
     🔗 Wire Form (AFTER editId is known)
  ======================================================== */
  setupBillingTriggerFormSubmission({
    form,
    sharedState,
  });

  /* ========================================================
     ✏️ EDIT PREFILL (UI SEED ONLY)
  ======================================================== */
  async function applyPrefill(entry) {
    document.getElementById("module_key").value =
      entry.module_key || "";

    document.getElementById("trigger_status").value =
      entry.trigger_status || "";

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

  /* ========================================================
     🧠 EDIT LOAD STRATEGY (ENTERPRISE STANDARD)
     1️⃣ sessionStorage (fast path)
     2️⃣ API GET /:id (source of truth)
  ======================================================== */
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

  /* ========================================================
     🔘 Buttons
  ======================================================== */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("billingTriggerEditId");
    sessionStorage.removeItem("billingTriggerEditPayload");
    window.location.href = "/billing-triggers-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("billingTriggerEditId");
    sessionStorage.removeItem("billingTriggerEditPayload");
    window.location.reload(); // clean ADD mode
  });
});
