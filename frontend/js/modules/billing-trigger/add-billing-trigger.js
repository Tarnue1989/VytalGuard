// 📦 add-billing-trigger.js – Secure Add/Edit Page Controller for Billing Triggers
// ============================================================================
// 🔹 Converted 1:1 from add-patient.js
// 🔹 Fully aligned with BillingTrigger controller & routes
// 🔹 100% ID retention for linked HTML
// ============================================================================

import { setupBillingTriggerFormSubmission } from "./billing-trigger-form.js";
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
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  const form = document.getElementById("billingTriggerForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const statusEl = document.getElementById("is_active");
  if (statusEl) statusEl.value = "true";

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Billing Trigger";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML =
      `<i class="ri-save-3-line me-1"></i> Save Trigger`;
  }
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("billingTriggerForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ---------------- Organization / Facility ---------------- */
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        orgSelect,
        orgs,
        "id",
        "name",
        "-- System Default --"
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
          "-- All Facilities --"
        );
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".mb-3")?.classList.add("hidden");

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(
        facSelect,
        facs,
        "id",
        "name",
        "-- All Facilities --"
      );
    } else {
      orgSelect?.closest(".mb-3")?.classList.add("hidden");
      facSelect?.closest(".mb-3")?.classList.add("hidden");
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Could not load organization/facility");
  }

  /* ---------------- Form Submission ---------------- */
  setupBillingTriggerFormSubmission({
    form,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("billingTriggerEditId");
  const rawPayload = sessionStorage.getItem("billingTriggerEditPayload");

  async function applyPrefill(entry) {
    const fill = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };

    fill("module_key", entry.module_key);
    fill("trigger_status", entry.trigger_status);

    const statusEl = document.getElementById("is_active");
    if (statusEl) {
      statusEl.value = entry.is_active ? "true" : "false";
    }

    const orgId = entry.organization_id || entry.organization?.id;
    const facId = entry.facility_id || entry.facility?.id;

    if (orgId && orgSelect) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        orgSelect,
        orgs,
        "id",
        "name",
        "-- System Default --"
      );
      orgSelect.value = orgId;
    }

    if (facId && facSelect) {
      const facs = await loadFacilitiesLite(
        orgId ? { organization_id: orgId } : {}
      );
      setupSelectOptions(
        facSelect,
        facs,
        "id",
        "name",
        "-- All Facilities --"
      );
      facSelect.value = facId;
    }

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Billing Trigger";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Billing Trigger`;
    }
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch {
      showToast("❌ Failed to load cached billing trigger");
    }
  } else {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/billing-triggers/${id}`);
        const data = await res.json();
        if (!res.ok || !data?.data)
          throw new Error("Failed to load billing trigger");
        await applyPrefill(data.data);
      } catch (err) {
        showToast(err.message);
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("billingTriggerEditId");
    sessionStorage.removeItem("billingTriggerEditPayload");
    window.location.href = "/billing-triggers-list.html";
  });

  document.querySelector("button[type=reset]")?.addEventListener("click", () => {
    sessionStorage.removeItem("billingTriggerEditId");
    sessionStorage.removeItem("billingTriggerEditPayload");
    resetForm();
  });
});
