// 📦 billableitem-main.js – Pill-based Billable Item Form (Add/Edit) Page Controller

import {
  setupBillableItemFormSubmission,
  getBillableItemFormState,
} from "./billableitem-form.js";

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
  loadDepartmentsLite,
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
  const form = document.getElementById("billableItemForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset status radio
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // Reset dropdowns
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset category
  const categoryIdInput = document.getElementById("category_id");
  const categoryNameInput = document.getElementById("categoryName");
  if (categoryIdInput) categoryIdInput.value = "";
  if (categoryNameInput) categoryNameInput.value = "";

  // Reset pills
  const pillsContainer = document.getElementById("itemPillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML = `<p class="text-muted">No billables added yet.</p>`;

  // Reset UI state
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Billable Item";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit All`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("billableItemForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");

  const categoryIdInput = document.getElementById("category_id");
  const categoryNameInput = document.getElementById("categoryName");

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

  /* --------------------------- Departments --------------------------- */
  try {
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");
  } catch (err) {
    console.error("❌ Departments preload failed:", err);
    showToast("❌ Failed to load departments");
  }

  /* -------------------- Form setup & submission -------------------- */
  setupBillableItemFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* --------------------------- Edit Mode --------------------------- */
  const editId = sessionStorage.getItem("billableItemEditId");
  const rawPayload = sessionStorage.getItem("billableItemEditPayload");

  async function applyPrefill(entry) {
    const { selectedItems, renderItemPills } = getBillableItemFormState();

    // Clear pills
    selectedItems.length = 0;
    selectedItems.push({
      master_item_id: entry.master_item_id,
      itemName: entry.masterItem?.name || "",
      name: entry.name || "",
      code: entry.code || "",
      price: entry.price,
      currency: entry.currency || "USD",
      department_id: entry.department?.id || null,
      category_id: entry.category_id || null,
      category_name: entry.category?.name || "",
      taxable: !!entry.taxable,
      discountable: !!entry.discountable,
      override_allowed: !!entry.override_allowed,
    });
    renderItemPills();

    // Prefill form inputs
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";
    document.getElementById("price").value = entry.price || "";
    document.getElementById("currency").value = entry.currency || "USD";
    document.getElementById("taxable").checked = !!entry.taxable;
    document.getElementById("discountable").checked = !!entry.discountable;
    document.getElementById("overrideAllowed").checked = !!entry.override_allowed;

    if (categoryIdInput) categoryIdInput.value = entry.category_id || "";
    if (categoryNameInput) categoryNameInput.value = entry.category?.name || "";

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
    if (entry.department?.id && deptSelect) deptSelect.value = entry.department.id;

    // Status
    if (entry.status) {
      const statusEl = document.getElementById(`status_${entry.status.toLowerCase()}`);
      if (statusEl) statusEl.checked = true;
    }

    // Switch UI to edit mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Billable Item";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Billable Item`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached billable item for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/billable-items/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch billable item");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load billable item:", err);
        showToast(err.message || "❌ Failed to load billable item for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ------------------------- Cancel & Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("billableItemEditId");
    sessionStorage.removeItem("billableItemEditPayload");
    window.location.href = "/billableitems-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("billableItemEditId");
    sessionStorage.removeItem("billableItemEditPayload");
    resetForm();
  });
});
