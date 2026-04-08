// 📦 billableitem-main.js – Billable Item Form Page Controller (ENTERPRISE FINAL - UPDATED)
// ============================================================================
// 🔹 SAME STRUCTURE
// 🔹 MULTI-CREATE SAFE
// 🔹 EDIT PREFILL FIXED (payer_type added)
// 🔹 NOTHING REMOVED
// ============================================================================

import {
  setupBillableItemFormSubmission,
  getBillableItemFormState,
} from "./billableitem-form.js";

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

import { resolveUserRole } from "../../utils/roleResolver.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("billableItemForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

const orgSelect = document.getElementById("organizationSelect");
const facSelect = document.getElementById("facilitySelect");

/* ============================================================
   🚀 INIT
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  if (!form) return;

  const role = resolveUserRole();
  const isSuper = role === "superadmin";
  const isOrgAdmin = role === "organization_admin";

  /* ========================================================
     🔑 EDIT MODE DETECTION
  ======================================================== */
  const editId =
    sessionStorage.getItem("billableItemEditId") ||
    new URLSearchParams(window.location.search).get("id");

  if (editId) {
    sharedState.currentEditIdRef.value = editId;
  }

  /* ========================================================
     🌐 ORGANIZATION / FACILITY
  ======================================================== */
  try {
    if (isSuper) {
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
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
          "-- Select Facility --"
        );
      };

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
    } else if (isOrgAdmin) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
  }

  /* ========================================================
     🔗 FORM WIRING
  ======================================================== */
  setupBillableItemFormSubmission({
    form,
    sharedState,
  });

  /* ========================================================
     ✏️ EDIT PREFILL (UPDATED)
  ======================================================== */
  const rawPayload = sessionStorage.getItem("billableItemEditPayload");

  async function applyPrefill(entry) {
    const { selectedItems, renderItemPills } =
      getBillableItemFormState();

    selectedItems.length = 0;

    selectedItems.push({
      master_item_id: entry.master_item_id,
      itemName: entry.masterItem?.name || "",
      name: entry.name || "",
      code: entry.code || "",
      price: entry.price,
      currency: entry.currency || "USD",
      payer_type: entry.payer_type || "cash", // 🔥 FIXED
      department_id: entry.department_id || null,
      category_id: entry.category_id || null,
      category_name: entry.category?.name || "",
      taxable: !!entry.taxable,
      discountable: !!entry.discountable,
      override_allowed: !!entry.override_allowed,
    });

    renderItemPills();

    /* ---------------- UI LABELS ---------------- */
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Billable Item";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Billable Item`;
    }

    /* ---------------- ORG / FAC ---------------- */
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
        "-- Select Facility --"
      );

      if (entry.facility_id) facSelect.value = entry.facility_id;
    } else if (isOrgAdmin && entry.facility_id) {
      facSelect.value = entry.facility_id;
    }
  }

  /* ========================================================
     📦 LOAD EDIT DATA
  ======================================================== */
  if (editId && rawPayload) {
    try {
      await applyPrefill(JSON.parse(rawPayload));
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
    }
  } else if (editId) {
    try {
      const res = await authFetch(`/api/billable-items/${editId}`);
      const result = await res.json();
      if (res.ok && result?.data) {
        await applyPrefill(result.data);
      }
    } catch (err) {
      console.error("❌ Remote edit load failed:", err);
    }
  }

  /* ========================================================
     🔘 BUTTONS
  ======================================================== */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("billableItemEditId");
    sessionStorage.removeItem("billableItemEditPayload");
    window.location.href = "/billableitems-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("billableItemEditId");
    sessionStorage.removeItem("billableItemEditPayload");
    window.location.reload();
  });
});