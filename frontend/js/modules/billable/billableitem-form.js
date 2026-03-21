// 📦 billableitem-form.js – Pill-based Billable Item Form (ENTERPRISE FINAL)
// ============================================================================
// 🔹 Rule-driven validation (BILLABLE_ITEM_FORM_RULES)
// 🔹 ROLE-SAFE (ORG/FAC OWNED BY billableitem-main.js)
// 🔹 Pill-based ADD / EDIT / REMOVE
// 🔹 Single source of truth (pills)
// 🔹 PUT / POST aligned with controller
// 🔹 ❌ NEVER reload org/fac here
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
   🧩 Helpers
============================================================ */
const getQueryParam = (k) =>
  new URLSearchParams(window.location.search).get(k);

const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

/* ============================================================
   🧠 RULE VALIDATION (FORM → PILL ONLY)
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
      value === "" ||
      value === false
    ) {
      errors.push({ field: rule.id, message: rule.message });
    }
  }

  return errors;
}

/* ============================================================
   🌐 PILL STATE (SINGLE SOURCE OF TRUTH)
============================================================ */
let selectedItems = [];
let pillsContainer = null;
let isSelectingMasterItem = false;

/* ============================================================
   🧠 FORM STATE EXPORT
============================================================ */
export function getBillableItemFormState() {
  return { selectedItems, renderItemPills };
}

/* ============================================================
   🧱 PILL RENDERER
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
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `
      ${item.name} – ${item.price} ${item.currency}
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

  /* ---------------- EDIT ---------------- */
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
      priceInput.value = item.price;
      currencyInput.value = item.currency || "USD";
      deptSelect.value = item.department_id || "";
      categoryIdInput.value = item.category_id || "";
      categoryNameInput.value = item.category_name || "";
      descriptionInput.value = item.description || "";
      taxableInput.checked = !!item.taxable;
      discountableInput.checked = !!item.discountable;
      overrideInput.checked = !!item.override_allowed;

      document.getElementById("addItemBtn").innerHTML =
        `<i class="ri-save-3-line"></i> Update`;
    };
  });

  /* ---------------- REMOVE ---------------- */
  pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
    btn.onclick = () => {
      selectedItems.splice(Number(btn.dataset.idx), 1);
      renderItemPills();
    };
  });
}

/* ============================================================
   🚀 MAIN FORM
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

  /* ---------------- DOM ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  window.deptSelect = document.getElementById("departmentSelect");

  window.masterItemSearch = document.getElementById("masterItemSearch");
  const masterItemSuggestions =
    document.getElementById("masterItemSearchSuggestions");

  window.nameInput = document.getElementById("name");
  window.codeInput = document.getElementById("code");
  window.priceInput = document.getElementById("price");
  window.currencyInput = document.getElementById("currency");

  window.categoryIdInput = document.getElementById("category_id");
  window.categoryNameInput = document.getElementById("categoryName");
  window.descriptionInput = document.getElementById("description");

  window.taxableInput = document.getElementById("taxable");
  window.discountableInput = document.getElementById("discountable");
  window.overrideInput = document.getElementById("overrideAllowed");

  pillsContainer = document.getElementById("itemPillsContainer");

  /* ---------------- ROLE (VISIBILITY ONLY) ---------------- */
  const role = resolveUserRole();
  if (role === "superadmin") {
    document.getElementById("organizationFieldGroup")?.classList.remove("d-none");
    document.getElementById("facilityFieldGroup")?.classList.remove("d-none");
  } else if (role === "organization_admin") {
    document.getElementById("facilityFieldGroup")?.classList.remove("d-none");
  }

  /* ---------------- DEPARTMENTS ---------------- */
  setupSelectOptions(
    deptSelect,
    await loadDepartmentsLite({}, true),
    "id",
    "name",
    "-- Select Department --"
  );

  /* ---------------- MASTER ITEM SEARCH ---------------- */
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

      categoryIdInput.value = s.category_id || "";
      categoryNameInput.value = s.category?.name || "";
      descriptionInput.value = s.description || "";
    },
    "name"
  );

  masterItemSearch.addEventListener("input", () => {
    if (isSelectingMasterItem) {
      isSelectingMasterItem = false;
      return;
    }

    masterItemSearch.dataset.value = "";
    document.getElementById("master_item_id").value = "";
  });

  /* ============================================================
     ➕ ADD / UPDATE PILL (RULE-DRIVEN)
  ============================================================ */
  document.getElementById("addItemBtn").onclick = () => {
    clearFormErrors(form);

    const ruleErrors = validateUsingRules(form);
    if (ruleErrors.length) {
      applyServerErrors(form, ruleErrors);
      return;
    }

    selectedItems.push({
      master_item_id: masterItemSearch.dataset.value,
      itemName: masterItemSearch.value,
      name: nameInput.value.trim(),
      code: codeInput.value.trim(),
      price: Number(priceInput.value),
      currency: currencyInput.value || "USD",
      department_id: normalizeUUID(deptSelect.value),
      category_id: normalizeUUID(categoryIdInput.value),
      category_name: categoryNameInput.value || "",
      description: descriptionInput.value || "",
      taxable: taxableInput.checked,
      discountable: discountableInput.checked,
      override_allowed: overrideInput.checked,
    });

    // 🔒 Preserve org/fac before reset
    const orgVal = orgSelect?.value;
    const facVal = facSelect?.value;

    form.reset();

    // 🔁 Restore org/fac
    if (orgSelect) orgSelect.value = orgVal;
    if (facSelect) facSelect.value = facVal;

    masterItemSearch.dataset.value = "";
    document.getElementById("master_item_id").value = "";
    document.getElementById("addItemBtn").innerHTML =
      `<i class="ri-add-line"></i> Add`;

    renderItemPills();
  };

  /* ============================================================
     🛡️ SUBMIT (PILLS ONLY — NO FORM RULES)
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

      let payload = { ...selectedItems[0] };
      let url = "/api/billable-items";
      let method = "POST";

      if (isEdit) {
        url = `/api/billable-items/${itemId}`;
        method = "PUT";
        delete payload.organization_id;
        delete payload.facility_id;
      } else {
        if (role === "superadmin") {
          payload.organization_id = normalizeUUID(orgSelect.value);
          payload.facility_id = normalizeUUID(facSelect.value);
        } else if (role === "organization_admin") {
          payload.organization_id = getOrganizationId();
          payload.facility_id = normalizeUUID(facSelect.value);
        } else {
          payload.organization_id = getOrganizationId();
          payload.facility_id = getFacilityId();
        }
      }

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("❌ Save failed");

      showToast(isEdit ? "✅ Billable item updated" : "✅ Billable item added");
      // 🔄 FULL HARD RESET (everything)
      form.reset();

      // 🧹 clear pill state completely
      selectedItems.length = 0; // safer than reassign
      renderItemPills();

      // 🧹 clear master item selection
      masterItemSearch.dataset.value = "";
      document.getElementById("master_item_id").value = "";

      // 🧹 reset add button
      document.getElementById("addItemBtn").innerHTML =
        `<i class="ri-add-line"></i> Add`;

      // 🧹 remove validation errors
      clearFormErrors(form);

      // 🧹 remove any UI highlights
      pillsContainer.classList.remove("border-danger");

      // 🧹 reset internal flags
      isSelectingMasterItem = false;
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  renderItemPills();
}
