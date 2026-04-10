// 📦 billableitem-form.js – Pill-based Billable Item Form (ENTERPRISE FINAL - MULTI PRICE READY)
// ============================================================================
// 🔹 MULTI-CREATE ENABLED (pills)
// 🔹 MULTI-PRICE READY (price rows)
// 🔹 EDIT SAFE
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import {
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadDepartmentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import {
  resolveUserRole,
  getOrganizationId,
  getFacilityId,
} from "../../utils/roleResolver.js";

import { BILLABLE_ITEM_FORM_RULES } from "./billableitem.form.rules.js";

/* ============================================================
   🧩 HELPERS
============================================================ */
const getQueryParam = (k) =>
  new URLSearchParams(window.location.search).get(k);

const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

/* ============================================================
   🧠 RULE VALIDATION (UNCHANGED)
============================================================ */
function validateUsingRules(form) {
  const errors = [];

  for (const rule of BILLABLE_ITEM_FORM_RULES) {
    if (typeof rule.when === "function" && !rule.when()) continue;

    const el =
      document.getElementById(rule.id) ||
      form.querySelector(`[name="${rule.id}"]`);

    if (!el) continue;

    let value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.type === "radio")
      value = document.querySelector(`input[name="${el.name}"]:checked`);
    else value = el.value;

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      errors.push({ field: rule.id, message: rule.message });
    }
  }

  return errors;
}

/* ============================================================
   🌐 STATE
============================================================ */
let selectedItems = [];
let pillsContainer = null;
let isSelectingMasterItem = false;

/* ============================================================
   🧠 EXPORT STATE
============================================================ */
export function getBillableItemFormState() {
  return { selectedItems, renderItemPills };
}

/* ============================================================
   🧱 PILL RENDER (UPDATED DISPLAY)
============================================================ */
function renderItemPills() {
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  if (!selectedItems.length) {
    pillsContainer.innerHTML =
      `<p class="text-muted">No billables added yet.</p>`;
    return;
  }

  selectedItems.forEach((item, idx) => {
    // 🔥 SHOW FIRST PRICE + COUNT
    const priceDisplay = item.prices?.length
      ? `${Number(item.prices[0].price).toFixed(2)} ${item.prices[0].currency} (${item.prices.length} price${item.prices.length > 1 ? "s" : ""})`
      : "0.00";

    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `
      ${item.name} – ${priceDisplay}
      ${item.category_name ? `(${item.category_name})` : ""}
      <button type="button" class="btn btn-link pill-edit" data-idx="${idx}">
        <i class="ri-pencil-line"></i>
      </button>
      <button type="button" class="btn btn-link text-danger pill-remove" data-idx="${idx}">
        <i class="ri-close-line"></i>
      </button>
    `;
    pillsContainer.appendChild(pill);
  });

  /* ================= EDIT ================= */
  pillsContainer.querySelectorAll(".pill-edit").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      const item = selectedItems[idx];

      selectedItems.splice(idx, 1);
      renderItemPills();

      isSelectingMasterItem = true;

      masterItemSearch.dataset.value = item.master_item_id;
      document.getElementById("master_item_id").value = item.master_item_id;
      masterItemSearch.value = item.itemName || "";

      nameInput.value = item.name;
      codeInput.value = item.code || "";

      deptSelect.value = item.department_id || "";
      categoryIdInput.value = item.category_id || "";
      categoryNameInput.value = item.category_name || "";
      descriptionInput.value = item.description || "";
      taxableInput.checked = !!item.taxable;
      discountableInput.checked = !!item.discountable;
      overrideInput.checked = !!item.override_allowed;

      // 🔥 PRICE ROWS RESET (handled in main.js prefill)
      document.getElementById("priceRowsContainer").innerHTML = "";

      document.getElementById("addItemBtn").innerHTML =
        `<i class="ri-save-3-line"></i> Update`;
    };
  });

  /* ================= REMOVE ================= */
  pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
    btn.onclick = () => {
      selectedItems.splice(Number(btn.dataset.idx), 1);
      renderItemPills();
    };
  });
}
/* ============================================================
   🚀 MAIN FORM (FINAL MULTI-PRICE COMPLETE)
============================================================ */
export async function setupBillableItemFormSubmission({
  form,
  sharedState,
}) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const itemId =
    sharedState?.currentEditIdRef?.value || getQueryParam("id");
  const isEdit = Boolean(itemId);

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  window.deptSelect = document.getElementById("departmentSelect");

  window.masterItemSearch = document.getElementById("masterItemSearch");
  const masterItemSuggestions =
    document.getElementById("masterItemSearchSuggestions");

  window.nameInput = document.getElementById("name");
  window.codeInput = document.getElementById("code");

  window.categoryIdInput = document.getElementById("category_id");
  window.categoryNameInput = document.getElementById("categoryName");
  window.descriptionInput = document.getElementById("description");

  window.taxableInput = document.getElementById("taxable");
  window.discountableInput = document.getElementById("discountable");
  window.overrideInput = document.getElementById("overrideAllowed");

  pillsContainer = document.getElementById("itemPillsContainer");

  const role = resolveUserRole();

  /* ================= LOAD DEPARTMENTS ================= */
  setupSelectOptions(
    deptSelect,
    await loadDepartmentsLite({}, true),
    "id",
    "name",
    "-- Select Department --"
  );

  /* ================= MASTER ITEM SEARCH ================= */
  setupSuggestionInputDynamic(
    masterItemSearch,
    masterItemSuggestions,
    "/api/lite/master-items",
    (s) => {
      isSelectingMasterItem = true;

      masterItemSearch.dataset.value = s.id;
      document.getElementById("master_item_id").value = s.id;

      masterItemSearch.value = s.name;

      nameInput.value = s.name || "";
      codeInput.value =
        s.code ||
        s.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9\-]/g, "");

      /* 🔥 FIXED CATEGORY */
      categoryIdInput.value = s.category_id || "";
      categoryNameInput.value = s.category?.name || "";
    },
    "name"
  );
  // 🔥 CLEAR MASTER ITEM IF USER TYPES
  masterItemSearch.addEventListener("input", () => {
    masterItemSearch.dataset.value = "";
    document.getElementById("master_item_id").value = "";
  });
  /* ============================================================
     ➕ ADD PRICE ROW BUTTON
  ============================================================ */
  document.getElementById("addPriceRowBtn").onclick = () => {
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

    row.querySelector(".removeRow").onclick = () => row.remove();
  };

  /* ============================================================
     ➕ ADD ITEM (MULTI-PRICE)
  ============================================================ */
  document.getElementById("addItemBtn").onclick = () => {
    clearFormErrors(form);
    // 🔥 MASTER ITEM MUST BE SELECTED
    if (!document.getElementById("master_item_id").value) {
      showToast("⚠️ Please select a Master Item from the dropdown");
      return;
    }
    const ruleErrors = validateUsingRules(form);
    if (ruleErrors.length) {
      applyServerErrors(form, ruleErrors);
      return;
    }

    const priceRows = document.querySelectorAll(".price-row");
    const prices = [];

    priceRows.forEach((row) => {
      const payer = row.querySelector(".payer_type")?.value;
      const price = Number(row.querySelector(".price")?.value);
      const currency = row.querySelector(".currency")?.value || "USD";
      const isDefault = row.querySelector(".is_default")?.checked;

      if (payer && price) {
        prices.push({
          payer_type: payer,
          price,
          currency,
          is_default: !!isDefault,
        });
      }
    });

    if (!prices.length) {
      showToast("⚠️ At least one price is required");
      return;
    }

    selectedItems.push({
      master_item_id: masterItemSearch.dataset.value,
      itemName: masterItemSearch.value,
      name: nameInput.value.trim(),
      code: codeInput.value.trim(),
      prices,
      department_id: normalizeUUID(deptSelect.value),
      category_id: normalizeUUID(categoryIdInput.value),
      category_name: categoryNameInput.value || "",
      description: descriptionInput.value || "",
      taxable: taxableInput.checked,
      discountable: discountableInput.checked,
      override_allowed: overrideInput.checked,
    });

    const orgVal = orgSelect?.value;
    const facVal = facSelect?.value;

    form.reset();

    if (orgSelect) orgSelect.value = orgVal;
    if (facSelect) facSelect.value = facVal;

    /* RESET PRICE ROWS */
    const container = document.getElementById("priceRowsContainer");
    container.innerHTML = "";
    document.getElementById("addPriceRowBtn").click();

    renderItemPills();
  };

  /* ============================================================
     🛡️ SUBMIT
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    if (!selectedItems.length) {
      pillsContainer.classList.add("border-danger");
      showToast("⚠️ Please add at least one billable item first");
      return;
    } else {
      pillsContainer.classList.remove("border-danger");
    }

    try {
      showLoading();

      let payload;
      let url = "/api/billable-items";
      let method = "POST";

      if (isEdit) {
        payload = { ...selectedItems[0] };
        url = `/api/billable-items/${itemId}`;
        method = "PUT";

        delete payload.organization_id;
        delete payload.facility_id;
      } else {
        payload = selectedItems.map((item) => {
          if (role === "superadmin") {
            return {
              ...item,
              organization_id: normalizeUUID(orgSelect.value),
              facility_id: normalizeUUID(facSelect.value),
            };
          } else if (role === "organization_admin") {
            return {
              ...item,
              organization_id: getOrganizationId(),
              facility_id: normalizeUUID(facSelect.value),
            };
          } else {
            return {
              ...item,
              organization_id: getOrganizationId(),
              facility_id: getFacilityId(),
            };
          }
        });
      }

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("❌ Save failed");

      showToast(isEdit ? "✅ Billable item updated" : "✅ Billable items added");

      form.reset();
      selectedItems.length = 0;
      renderItemPills();

      masterItemSearch.dataset.value = "";
      document.getElementById("master_item_id").value = "";

      document.getElementById("addItemBtn").innerHTML =
        `<i class="ri-add-line"></i> Add`;

      clearFormErrors(form);
      pillsContainer.classList.remove("border-danger");
      isSelectingMasterItem = false;

    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  renderItemPills();
}