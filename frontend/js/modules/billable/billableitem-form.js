// 📦 billableitem-form.js – Pill-based Billable Item Form (secure + permission-driven)

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
  loadMasterItemsLite,
  loadMasterItemCategoriesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔧 Helpers
============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
  if (msg?.detail) return msg.detail;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

function validateBillableFields({ master_item_id, name, price }) {
  if (!master_item_id) return showToast("❌ Master Item is required"), false;
  if (!name || !name.trim()) return showToast("❌ Name is required"), false;
  if (!price || Number(price) <= 0)
    return showToast("❌ Price must be greater than 0"), false;
  return true;
}

// 🔹 Resolve tenant + role
function resolveTenantScope() {
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
  const userOrg = localStorage.getItem("organization_id") || null;
  const userFac = localStorage.getItem("facility_id") || null;

  return {
    userRole,
    userOrg,
    userFac,
    isSuper: userRole.includes("super"),
    isAdmin: userRole.includes("admin"),
    isFacilityHead:
      userRole.includes("facilityhead") || userRole.includes("manager"),
  };
}

/* ============================================================
   🚀 Main Form Setup
============================================================ */
let selectedItems = [];
let editingIndex = null;
let pillsContainer = null;

function renderItemPills() {
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  if (!selectedItems.length) {
    pillsContainer.innerHTML = `<p class="text-muted">No billables added yet.</p>`;
  } else {
    selectedItems.forEach((item, idx) => {
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.innerHTML = `
        ${item.name || item.masterItem?.name || "—"} – $${item.price} ${item.currency || ""}
        ${item.category_name ? `(${item.category_name})` : ""}
        <button type="button" class="btn btn-sm btn-link pill-edit" data-idx="${idx}" title="Edit">
          <i class="ri-pencil-line"></i>
        </button>
        <button type="button" class="btn btn-sm btn-link text-danger pill-remove" data-idx="${idx}" title="Remove">
          <i class="ri-close-line"></i>
        </button>
      `;
      pillsContainer.appendChild(pill);
    });

    pillsContainer.querySelectorAll(".pill-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = btn.dataset.idx;
        const item = selectedItems[idx];
        document.getElementById("masterItemSearch").dataset.value = item.master_item_id;
        document.getElementById("masterItemSearch").value =
          item.itemName || item.masterItem?.name || "";
        document.getElementById("name").value = item.name;
        document.getElementById("code").value = item.code || "";
        document.getElementById("price").value = item.price;
        document.getElementById("currency").value = item.currency || "USD";
        document.getElementById("departmentSelect").value = item.department_id || "";
        document.getElementById("category_id").value = item.category_id || "";
        document.getElementById("categoryName").value = item.category_name || "";
        document.getElementById("description").value = item.description || "";
        document.getElementById("taxable").checked = !!item.taxable;
        document.getElementById("discountable").checked = !!item.discountable;
        document.getElementById("overrideAllowed").checked = !!item.override_allowed;
        editingIndex = idx;
      });
    });

    pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = btn.dataset.idx;
        selectedItems.splice(idx, 1);
        renderItemPills();
      });
    });
  }

  const submitBtn = document.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML =
      selectedItems.length > 1
        ? `<i class="ri-save-3-line me-1"></i> Submit All`
        : `<i class="ri-save-3-line me-1"></i> Submit`;
  }
}

export function getBillableItemFormState() {
  return { selectedItems, renderItemPills };
}

export async function setupBillableItemFormSubmission({ form }) {
  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const itemId = getQueryParam("id");
  const isEdit = !!itemId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  if (isEdit) {
    titleEl && (titleEl.textContent = "Edit Billable Item");
    submitBtn && (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Billable`);
  } else {
    titleEl && (titleEl.textContent = "Add Billable Item");
    submitBtn && (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit All`);
  }

  // 📋 DOM Refs
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const masterItemInput = document.getElementById("masterItemSearch");
  const masterItemSuggestions = document.getElementById("masterItemSearchSuggestions");

  const nameInput = document.getElementById("name");
  const codeInput = document.getElementById("code");
  const priceInput = document.getElementById("price");
  const currencyInput = document.getElementById("currency");

  const categoryIdInput = document.getElementById("category_id");
  const categoryNameInput = document.getElementById("categoryName");
  const descriptionInput = document.getElementById("description");

  const taxableInput = document.getElementById("taxable");
  const discountableInput = document.getElementById("discountable");
  const overrideInput = document.getElementById("overrideAllowed");

  pillsContainer = document.getElementById("itemPillsContainer");

  // 🔒 Auto code generation
  codeInput.readOnly = true;
  nameInput?.addEventListener("input", () => {
    if (!codeInput.value) {
      codeInput.value = nameInput.value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");
    }
  });

  /* ------------------------- Prefill dropdowns ------------------------- */
  try {
    const { isSuper, isAdmin, isFacilityHead, userOrg, userFac } = resolveTenantScope();

    if (isSuper) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (isAdmin) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({ organization_id: userOrg }, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

    setupSuggestionInputDynamic(
      masterItemInput,
      masterItemSuggestions,
      "/api/lite/master-items",
      (selected) => {
        masterItemInput.dataset.value = selected.id;
        masterItemInput.value = selected.name;
        nameInput.value = selected.name || "";
        codeInput.value =
          selected.code ||
          (selected.name || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
        categoryIdInput.value = selected.category_id || "";
        categoryNameInput.value =
          selected.category?.name || selected.category_name || "";
        descriptionInput.value = selected.description || "";
      },
      "name"
    );
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ------------------------- Prefill if Editing ------------------------- */
  if (isEdit && itemId) {
    try {
      showLoading();
      const res = await authFetch(`/api/billable-items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (res.ok && result?.data) {
        const entry = result.data;
        orgSelect.value = entry.organization_id || "";
        facSelect.value = entry.facility_id || "";
        deptSelect.value = entry.department_id || "";
        masterItemInput.dataset.value = entry.master_item_id;
        masterItemInput.value = entry.masterItem?.name || "";
        nameInput.value = entry.name || "";
        codeInput.value = entry.code || "";
        priceInput.value = entry.price || "";
        currencyInput.value = entry.currency || "USD";
        categoryIdInput.value = entry.category_id || "";
        categoryNameInput.value = entry.category?.name || "";
        descriptionInput.value = entry.description || "";
        taxableInput.checked = !!entry.taxable;
        discountableInput.checked = !!entry.discountable;
        overrideInput.checked = !!entry.override_allowed;

        pillsContainer.closest(".col-sm-12").style.display = "none";
        document.getElementById("addItemBtn")?.closest(".col-sm-12")?.classList.add("hidden");
      }
    } catch (err) {
      hideLoading();
      console.error(err);
      showToast("❌ Could not load billable item");
    }
  } else {
    renderItemPills();
  }

  /* ------------------------- Add to Pills ------------------------- */
  document.getElementById("addItemBtn")?.addEventListener("click", () => {
    if (isEdit) return;

    const obj = {
      master_item_id: masterItemInput.dataset.value || null,
      itemName: masterItemInput.value || "",
      name: nameInput.value.trim(),
      code: codeInput.value.trim(),
      price: +priceInput.value || 0,
      currency: currencyInput.value || "USD",
      department_id: deptSelect.value || null,
      category_id: categoryIdInput.value || null,
      category_name: categoryNameInput.value || "",
      description: descriptionInput?.value || "",
      taxable: taxableInput.checked,
      discountable: discountableInput.checked,
      override_allowed: overrideInput.checked,
    };

    if (!validateBillableFields(obj)) return;
    selectedItems.push(obj);

    masterItemInput.value = "";
    masterItemInput.dataset.value = "";
    nameInput.value = "";
    codeInput.value = "";
    priceInput.value = "";
    currencyInput.value = "USD";
    deptSelect.value = "";
    categoryIdInput.value = "";
    categoryNameInput.value = "";
    descriptionInput.value = "";
    taxableInput.checked = false;
    discountableInput.checked = false;
    overrideInput.checked = false;

    renderItemPills();
  });

  /* ------------------------- Submit ------------------------- */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    try {
      showLoading();

      let url = "/api/billable-items";
      let method = "POST";
      let payload;

      if (isEdit && itemId) {
        url = `/api/billable-items/${itemId}`;
        method = "PUT";
        payload = {
          master_item_id: masterItemInput.dataset.value,
          name: nameInput.value.trim(),
          code: codeInput.value.trim(),
          price: +priceInput.value || 0,
          currency: currencyInput.value || "USD",
          department_id: deptSelect.value || null,
          category_id: categoryIdInput.value || null,
          description: descriptionInput?.value || "",
          taxable: taxableInput.checked,
          discountable: discountableInput.checked,
          override_allowed: overrideInput.checked,
        };
        if (!validateBillableFields(payload)) return;
      } else {
        if (!selectedItems.length)
          return showToast("❌ Please add at least one billable item before submitting");
        payload = selectedItems.length === 1 ? { ...selectedItems[0] } : selectedItems;
      }

      // ✅ attach tenant scope
      const { isSuper, isAdmin, userOrg, userFac } = resolveTenantScope();
      if (isSuper) {
        payload.organization_id = orgSelect?.value || null;
        payload.facility_id = facSelect?.value || null;
      } else if (isAdmin) {
        payload.organization_id = userOrg;
        payload.facility_id = facSelect?.value || null;
      } else {
        payload.organization_id = userOrg;
        payload.facility_id = userFac;
      }

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ Billable item updated successfully");
        window.location.href = "/billableitems-list.html";
        return;
      }

      showToast(`✅ ${selectedItems.length} billable item(s) added successfully`);
      selectedItems = [];
      renderItemPills();
      form.reset();
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ------------------------- Cancel / Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    window.location.href = "/billableitems-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    form.reset();
    masterItemInput.dataset.value = "";
    selectedItems = [];
    renderItemPills();
    if (isEdit) window.location.href = "/add-billableitem.html";
  });
}
