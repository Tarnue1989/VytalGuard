// 📦 add-insurance-provider.js – Secure Add/Edit Page Controller (INSURANCE PROVIDER)
// ============================================================================
// 🔹 Converted from add-role.js (MASTER PARITY)
// 🔹 Delegates ALL logic to insurance-provider-form.js
// 🔹 Handles edit-prefill (cache + API fallback)
// ============================================================================

import { setupInsuranceProviderFormSubmission } from "./insurance-provider-form.js";

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
   🧹 Reset Form
============================================================ */
function resetForm() {
  const form = document.getElementById("insuranceProviderForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById("status_active")?.setAttribute("checked", true);

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Insurance Provider";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Provider`;
}

/* ============================================================
   🚀 INIT
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("insuranceProviderForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🏢 Org / Facility
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
    console.error(err);
    showToast("❌ Could not load organization/facility");
  }

  /* ============================================================
     🧾 Form Setup
  ============================================================ */
  setupInsuranceProviderFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Prefill (EDIT)
  ============================================================ */
  const editId = sessionStorage.getItem("insuranceProviderEditId");
  const rawPayload = sessionStorage.getItem("insuranceProviderEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("name").value = entry.name || "";
    document.getElementById("contact_info").value = entry.contact_info || "";
    document.getElementById("address").value = entry.address || "";
    document.getElementById("phone").value = entry.phone || "";
    document.getElementById("email").value = entry.email || "";

    if (entry.organization_id && orgSelect) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name");
      orgSelect.value = entry.organization_id;
    }

    if (entry.facility_id && facSelect) {
      const facs = await loadFacilitiesLite(
        entry.organization_id
          ? { organization_id: entry.organization_id }
          : {},
        true
      );
      setupSelectOptions(facSelect, facs, "id", "name");
      facSelect.value = entry.facility_id;
    }

    if (entry.status) {
      document
        .getElementById(`status_${entry.status}`)
        ?.setAttribute("checked", true);
    }

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Insurance Provider";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Provider`;
  }

  if (editId && rawPayload) {
    try {
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(JSON.parse(rawPayload));
    } catch {
      showToast("❌ Could not load cached provider");
    }
  } else {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/insurance-providers/${id}`);
        const result = await res.json();

        if (!res.ok || !result?.data)
          throw new Error(result.message || "Failed to load provider");

        await applyPrefill(result.data);
      } catch (err) {
        console.error(err);
        showToast(err.message || "❌ Failed to load provider");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("insuranceProviderEditId");
    sessionStorage.removeItem("insuranceProviderEditPayload");
    window.location.href = "/insurance-providers-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("insuranceProviderEditId");
    sessionStorage.removeItem("insuranceProviderEditPayload");
    resetForm();
  });
});