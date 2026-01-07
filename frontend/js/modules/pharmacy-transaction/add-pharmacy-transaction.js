// 📦 pharmacy-transaction-main.js – Enterprise Master Pattern Aligned (Add/Edit Pharmacy Transactions)
// ============================================================================
// 🔹 Mirrors add-payment.js structure for unified RBAC + lifecycle handling
// 🔹 Preserves all pharmacy-specific IDs, logic, and API calls intact
// 🔹 Adds role-aware org/facility cascade, cached/live edit prefill, and safe resets
// ============================================================================

import { setupPharmacyTransactionFormSubmission } from "./pharmacy-transaction-form.js";
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
   🔐 Auth Guard + Session Watch
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["pharmacy_transactions:create", "pharmacy_transactions:edit"])
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
  const form = document.getElementById("pharmacyTransactionForm");
  if (!form) return;
  form.reset();
  sharedState.currentEditIdRef.value = null;

  ["organizationSelect", "facilitySelect", "prescriptionRequestSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const itemsContainer = document.getElementById("transactionItemsContainer");
  if (itemsContainer)
    itemsContainer.innerHTML = `<p class="text-muted">No items selected.</p>`;

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "New Pharmacy Transaction";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit Transaction`;
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("pharmacyTransactionForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const prescriptionSelect = document.getElementById("prescriptionRequestSelect");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🏢 Organizations
  ============================================================ */
  if (userRole.includes("super")) {
    try {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
    } catch (err) {
      console.error("❌ Organizations preload failed", err);
      showToast("❌ Could not load organizations");
    }
  } else {
    orgSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
     🏭 Facilities
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
    orgSelect?.addEventListener("change", async () => {
      await reloadFacilities(orgSelect.value || null);
    });
    await reloadFacilities();
  } else if (userRole.includes("admin")) {
    await reloadFacilities();
  } else {
    facSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
     💾 Form Submission Integration
  ============================================================ */
  setupPharmacyTransactionFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("pharmacyTransactionEditId");
  const rawPayload = sessionStorage.getItem("pharmacyTransactionEditPayload");

  async function applyPrefill(entry) {
    const patientInput = document.getElementById("patientSearch");
    const prescriptionSelect = document.getElementById("prescriptionRequestSelect");

    if (patientInput) {
      patientInput.dataset.value = entry.patient_id || "";
      patientInput.value =
        entry.patient?.full_name ||
        `${entry.patient?.pat_no || ""} - ${entry.patient?.full_name || ""}`.trim();
    }

    if (prescriptionSelect && entry.prescription_id) {
      prescriptionSelect.value = entry.prescription_id;
    }

    if (userRole.includes("super") && entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      const facs = await loadFacilitiesLite({ organization_id: entry.organization.id }, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }

    if ((userRole.includes("super") || userRole.includes("admin")) && entry.facility?.id && facSelect) {
      facSelect.value = entry.facility.id;
    }

    // Transaction items prefill
    window.transactionItems = (entry.items || []).map((i) => ({
      prescription_item_id: i.prescription_item_id,
      medication_name: i.medication?.name || i.billableItem?.name || "—",
      prescribed_qty: i.prescribed_qty,
      already_dispensed: i.already_dispensed,
      stock_available: i.stock_available,
      stocks: i.department_stocks || [],
      department_stock_id: i.department_stock_id || null,
      dispense_now: i.quantity_dispensed,
      notes: i.notes || "",
    }));

    if (window.renderItemsTable) window.renderItemsTable();

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Pharmacy Transaction";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Transaction`;

    sessionStorage.removeItem("pharmacyTransactionEditPayload");
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached transaction for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/pharmacy-transactions/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch transaction");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load transaction:", err);
        showToast(err.message || "❌ Failed to load transaction for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear Buttons
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("pharmacyTransactionEditId");
    sessionStorage.removeItem("pharmacyTransactionEditPayload");
    window.location.href = "/pharmacy-transactions-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    const isEdit = !!sharedState.currentEditIdRef.value;
    sessionStorage.removeItem("pharmacyTransactionEditId");
    sessionStorage.removeItem("pharmacyTransactionEditPayload");
    if (isEdit) {
      window.location.href = "/pharmacy-transactions-list.html";
    } else {
      resetForm();
    }
  });
});
