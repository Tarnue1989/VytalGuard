// 📦 stockrequest-main.js – Stock Request Form (Add/Edit) Page Controller (master-aligned)

import { setupStockRequestFormSubmission, getStockRequestFormState } from "./stockrequest-form.js";
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
  loadDepartmentsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🧭 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  const form = document.getElementById("stockRequestForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset pills
  const pillsContainer = document.getElementById("itemPillsContainer");
  if (pillsContainer) {
    pillsContainer.innerHTML = `<p class="text-muted">No items added yet.</p>`;
  }

  // Reset dropdowns
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Stock Request";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit Request`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("stockRequestForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");

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
    showToast("❌ Could not load departments");
  }

  /* -------------------- Form setup & submission -------------------- */
  setupStockRequestFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Apply Prefill (for Edit Mode)
  ============================================================ */
  async function applyPrefill(entry) {
    const { selectedItems, renderItemPills } = getStockRequestFormState();
    selectedItems.length = 0;

    // Prefill pills
    (entry.items || []).forEach((i) => {
      selectedItems.push({
        master_item_id: i.master_item_id,
        itemName: i.masterItem?.name || "",
        quantity: i.quantity,
        remarks: i.remarks || "",
      });
    });
    renderItemPills();

    // Prefill org → facility → department cascade
    if (entry.organization?.id && orgSelect) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
      orgSelect.value = entry.organization.id;

      const facs = await loadFacilitiesLite({ organization_id: entry.organization.id }, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }

    if (entry.facility?.id && facSelect) {
      facSelect.value = entry.facility.id;

      const depts = await loadDepartmentsLite(
        { facility_id: entry.facility.id, organization_id: entry.organization?.id },
        true
      );
      setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

      if (entry.department?.id && deptSelect) {
        deptSelect.value = entry.department.id;
      }
    }

    // Prefill text fields
    document.getElementById("referenceNumber").value = entry.reference_number || "";
    document.getElementById("notes").value = entry.notes || "";

    // Switch to edit mode UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Stock Request";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Request`;
  }

  /* ============================================================
     🧩 Edit Mode Handling (Session + Query Param)
  ============================================================ */
  const editId = sessionStorage.getItem("stockRequestEditId");
  const rawPayload = sessionStorage.getItem("stockRequestEditPayload");

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached stock request");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/stock-requests/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch stock request");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load stock request:", err);
        showToast(err.message || "❌ Failed to load stock request for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("stockRequestEditId");
    sessionStorage.removeItem("stockRequestEditPayload");
    window.location.href = "/stockrequests-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("stockRequestEditId");
    sessionStorage.removeItem("stockRequestEditPayload");
    resetForm();
  });
});
