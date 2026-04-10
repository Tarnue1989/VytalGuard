// 📦 billableitem-main.js – Billable Item Form Page Controller (ENTERPRISE FINAL - MULTI-PRICE READY)
// ============================================================================
// 🔹 MULTI-CREATE SAFE
// 🔹 MULTI-PRICE SUPPORT (prices[] UI rows)
// 🔹 EDIT PREFILL FULLY FIXED
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

/* ============================================================ */
initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================ */
const form = document.getElementById("billableItemForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

const orgSelect = document.getElementById("organizationSelect");
const facSelect = document.getElementById("facilitySelect");

/* ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  if (!form) return;

  const role = resolveUserRole();
  const isSuper = role === "superadmin";
  const isOrgAdmin = role === "organization_admin";

  /* ================= EDIT DETECTION ================= */
  const editId =
    sessionStorage.getItem("billableItemEditId") ||
    new URLSearchParams(window.location.search).get("id");

  if (editId) {
    sharedState.currentEditIdRef.value = editId;
  }

  /* ================= ORG / FAC ================= */
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

  /* ================= FORM ================= */
  setupBillableItemFormSubmission({
    form,
    sharedState,
  });

  /* ============================================================
     ✏️ EDIT PREFILL (🔥 FULL MULTI-PRICE SUPPORT)
  ============================================================ */
  const rawPayload = sessionStorage.getItem("billableItemEditPayload");

  function createPriceRow(p = {}) {
    const container = document.getElementById("priceRowsContainer");

    const row = document.createElement("div");
    row.className = "price-row border p-3 mb-3 rounded";

    row.innerHTML = `
      <div class="row">

        <div class="col-md-3">
          <label>Payer Type</label>
          <select class="form-control payer_type">
            <option value="cash">Cash</option>
            <option value="insurance">Insurance</option>
            <option value="corporate">Corporate</option>
            <option value="government">Government</option>
            <option value="charity">Charity</option>
          </select>
        </div>

        <div class="col-md-3">
          <label>Price</label>
          <input type="number" class="form-control price" />
        </div>

        <div class="col-md-3">
          <label>Currency</label>
          <select class="form-control currency">
            <option value="USD">USD</option>
            <option value="LRD">LRD</option>
          </select>
        </div>

        <div class="col-md-2 d-flex align-items-end">
          <div class="form-check">
            <input type="checkbox" class="form-check-input is_default" />
            <label class="form-check-label">Default</label>
          </div>
        </div>

        <div class="col-md-1 d-flex align-items-end">
          <button type="button" class="btn btn-danger removeRow">X</button>
        </div>

      </div>
    `;

    container.appendChild(row);

    // Apply values
    row.querySelector(".payer_type").value = p.payer_type || "cash";
    row.querySelector(".price").value = p.price || "";
    row.querySelector(".currency").value = p.currency || "USD";
    row.querySelector(".is_default").checked = !!p.is_default;

    row.querySelector(".removeRow").onclick = () => row.remove();
  }

  async function applyPrefill(entry) {
    const { selectedItems, renderItemPills } =
      getBillableItemFormState();

    selectedItems.length = 0;

    selectedItems.push({
      master_item_id: entry.master_item_id,
      itemName: entry.masterItem?.name || "",
      name: entry.name || "",
      code: entry.code || "",
      prices: entry.prices || [],
      department_id: entry.department_id || null,
      category_id: entry.category_id || null,
      category_name: entry.category?.name || "",
      taxable: !!entry.taxable,
      discountable: !!entry.discountable,
      override_allowed: !!entry.override_allowed,
    });

    renderItemPills();

    // 🔥 CLEAR DEFAULT ROWS
    const container = document.getElementById("priceRowsContainer");
    container.innerHTML = "";

    // 🔥 BUILD MULTI PRICE ROWS
    (entry.prices || []).forEach((p) => createPriceRow(p));

    /* UI LABEL */
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Billable Item";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Billable Item`;
    }

    /* ORG / FAC */
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

  /* ================= LOAD EDIT ================= */
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

  /* ================= BUTTONS ================= */
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