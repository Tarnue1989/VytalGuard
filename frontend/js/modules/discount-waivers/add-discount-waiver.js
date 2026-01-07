// 📁 add-discount-waiver.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors add-discount.js for unified lifecycle & RBAC consistency
// 🔹 Maintains all waiver-specific IDs, logic, and API endpoints intact
// 🔹 Adds role-aware org/facility cascade, tooltips, and safe guards
// ============================================================================

import { setupDiscountWaiverFormSubmission } from "./discount-waiver-form.js";
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
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Session Watch
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["discount-waivers:create", "discount-waivers:edit"])
);
initLogoutWatcher();

/* ============================================================
   🧩 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  const form = document.getElementById("discountWaiverForm");
  if (!form) return;
  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden IDs
  ["invoiceId", "patientId", "organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI to Add mode
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Discount Waiver";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Waiver`;

  toggleWaiverFields();
}

/* ============================================================
   🔄 Toggle Waiver Fields (percentage vs fixed)
============================================================ */
function toggleWaiverFields() {
  const typeSelect = document.getElementById("typeSelect");
  const percField = document.getElementById("percentage");
  const amtField = document.getElementById("amount");
  if (!typeSelect || !percField || !amtField) return;

  const percWrap = percField.closest(".col-xxl-4");
  const amtWrap = amtField.closest(".col-xxl-4");
  if (!percWrap || !amtWrap) return;

  if (typeSelect.value === "percentage") {
    percWrap.style.display = "";
    amtWrap.style.display = "none";
    amtField.value = "";
  } else if (typeSelect.value === "fixed") {
    amtWrap.style.display = "";
    percWrap.style.display = "none";
    percField.value = "";
  } else {
    percWrap.style.display = "none";
    amtWrap.style.display = "none";
    percField.value = "";
    amtField.value = "";
  }
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("discountWaiverForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const invoiceInput = document.getElementById("invoiceInput");
  const invoiceHidden = document.getElementById("invoiceId");
  const invoiceSuggestions = document.getElementById("invoiceSuggestions");
  const patientHidden = document.getElementById("patientId");
  const typeSelect = document.getElementById("typeSelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  // 🔁 Hook toggle
  typeSelect?.addEventListener("change", toggleWaiverFields);
  toggleWaiverFields();

  /* ============================================================
     🏢 Organization / Facility Setup
  ============================================================ */
  async function reloadFacilities(orgId = null) {
    try {
      const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } catch (err) {
      console.error("❌ Facilities preload failed", err);
      showToast("❌ Could not load facilities");
    }
  }

  if (userRole.includes("super")) {
    try {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
      await reloadFacilities();
    } catch (err) {
      console.error("❌ Organizations preload failed", err);
      showToast("❌ Could not load organizations");
    }
  } else if (userRole.includes("admin")) {
    orgSelect?.closest(".form-group")?.classList.add("hidden");
    await reloadFacilities();
  } else {
    orgSelect?.closest(".form-group")?.classList.add("hidden");
    facSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
     💳 Invoice Suggestion + Patient Auto-Fill
  ============================================================ */
  setupSuggestionInputDynamic(
    invoiceInput,
    invoiceSuggestions,
    "/api/lite/invoices",
    (selected) => {
      invoiceHidden.value = selected?.id || "";
      if (selected) {
        invoiceInput.value = `${selected.invoice_number || ""} · ${
          selected.patient?.code || ""
        } - ${selected.patient?.full_name || ""} · Balance ${selected.balance || ""}`;
        if (selected.patient && typeof selected.patient === "object") {
          patientHidden.value = selected.patient.id || "";
        } else if (selected.patient_id) {
          patientHidden.value = selected.patient_id;
        } else {
          patientHidden.value = "";
        }
      } else {
        invoiceHidden.value = "";
        patientHidden.value = "";
      }
    },
    "label"
  );

  /* ============================================================
     💾 Form Submission Integration
  ============================================================ */
  setupDiscountWaiverFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill (cached or fetch)
  ============================================================ */
  const editId = sessionStorage.getItem("discountWaiverEditId");
  const rawPayload = sessionStorage.getItem("discountWaiverEditPayload");

  async function applyPrefill(entry) {
    if (entry.type) {
      typeSelect.value = entry.type;
      toggleWaiverFields();
    }
    if (entry.percentage != null)
      document.getElementById("percentage").value = entry.percentage;
    if (entry.amount != null)
      document.getElementById("amount").value = entry.amount;
    if (entry.applied_total != null)
      document.getElementById("appliedTotal").value = entry.applied_total;
    if (entry.reason)
      document.getElementById("reason").value = entry.reason;

    // 🏢 Org/facility
    const orgId = entry.organization?.id || entry.organization_id;
    const facId = entry.facility?.id || entry.facility_id;
    if (orgId && orgSelect) {
      orgSelect.value = orgId;
      await reloadFacilities(orgId);
    }
    if (facId && facSelect) facSelect.value = facId;

    // 💳 Invoice + patient
    if (entry.invoice) {
      invoiceHidden.value = entry.invoice.id;
      invoiceInput.value = `${entry.invoice.invoice_number} · ${
        entry.invoice.patient?.code || ""
      } - ${entry.invoice.patient?.full_name || ""}`;
    }
    if (entry.patient) {
      patientHidden.value =
        typeof entry.patient === "object" ? entry.patient.id || "" : entry.patient;
    }

    // 🧭 UI update
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Discount Waiver";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Waiver`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached waiver for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/discount-waivers/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch waiver");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load waiver:", err);
        showToast(err.message || "❌ Failed to load waiver for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear Buttons
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountWaiverEditId");
    sessionStorage.removeItem("discountWaiverEditPayload");
    window.location.href = "/discount-waivers-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountWaiverEditId");
    sessionStorage.removeItem("discountWaiverEditPayload");
    resetForm();
  });
});
