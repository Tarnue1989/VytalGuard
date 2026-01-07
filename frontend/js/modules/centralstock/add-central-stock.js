// 📦 centralstock-main.js – Pill-based Central Stock Form (Add/Edit) Page Controller

import {
  setupCentralStockFormSubmission,
  getCentralStockFormState,
} from "./centralstock-form.js";

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
  loadSuppliersLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – automatically resolve correct permission (add/edit)
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference for consistent module handling
const sharedState = {
  currentEditIdRef: { value: null },
};

// 🧹 Reset form helper → back to Add mode
function resetForm() {
  const form = document.getElementById("centralStockForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset status
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // Reset dropdowns
  ["organizationSelect", "facilitySelect", "supplierSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset pills
  const pillsContainer = document.getElementById("itemPillsContainer");
  if (pillsContainer) {
    pillsContainer.innerHTML = `<p class="text-muted">No items added yet.</p>`;
  }

  // Reset UI state
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Central Stock";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit All`;
}

/* ============================================================
   🚀 Main Init
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("centralStockForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const supplierSelect = document.getElementById("supplierSelect");
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

  /* --------------------------- Suppliers --------------------------- */
  try {
    const suppliers = await loadSuppliersLite({}, true);
    setupSelectOptions(supplierSelect, suppliers, "id", "name", "-- Select Supplier --");
  } catch (err) {
    console.error("❌ Suppliers preload failed:", err);
    showToast("❌ Failed to load suppliers");
  }

  /* -------------------- Form setup & submission -------------------- */
  setupCentralStockFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* --------------------------- Edit Mode --------------------------- */
  const editId = sessionStorage.getItem("centralStockEditId");
  const rawPayload = sessionStorage.getItem("centralStockEditPayload");

  async function applyPrefill(entry) {
    const { selectedItems, renderItemPills } = getCentralStockFormState();
    selectedItems.length = 0;
    selectedItems.push({
      master_item_id: entry.master_item_id,
      itemName: entry.masterItem?.name || "",
      supplier_id: entry.supplier?.id || null,
      quantity: entry.quantity,
      received_date: entry.received_date?.split("T")[0] || "",
      expiry_date: entry.expiry_date?.split("T")[0] || "",
      batch_number: entry.batch_number,
      notes: entry.notes || "",
    });
    renderItemPills();

    // Prefill inputs
    document.getElementById("itemSearch").dataset.value = entry.master_item_id;
    document.getElementById("itemSearch").value = entry.masterItem?.name || "";
    document.getElementById("supplierSelect").value = entry.supplier?.id || "";
    document.getElementById("quantity").value = entry.quantity || "";
    document.getElementById("receivedDate").value =
      entry.received_date?.split("T")[0] || "";
    document.getElementById("expiryDate").value =
      entry.expiry_date?.split("T")[0] || "";
    document.getElementById("batchNumber").value = entry.batch_number || "";
    document.getElementById("notes").value = entry.notes || "";

    // Org + Facility
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

    // Status
    if (entry.status) {
      const statusEl = document.getElementById(`status_${entry.status.toLowerCase()}`);
      if (statusEl) statusEl.checked = true;
    }

    // Switch to edit mode UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Central Stock";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Stock`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached stock entry for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/central-stocks/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch stock entry");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load stock entry:", err);
        showToast(err.message || "❌ Failed to load stock entry for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ------------------------- Cancel & Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("centralStockEditId");
    sessionStorage.removeItem("centralStockEditPayload");
    window.location.href = "/centralstocks-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("centralStockEditId");
    sessionStorage.removeItem("centralStockEditPayload");
    resetForm();
  });
});
