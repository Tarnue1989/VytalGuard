// 📦 centralstock-form.js – Pill-based Central Stock Form (ENTERPRISE FINAL PARITY)
// ============================================================================
// 🧭 FULL PARITY WITH billableitem-form.js
// 🔹 Rule-driven validation (CENTRAL_STOCK_FORM_RULES)
// 🔹 ROLE-SAFE (ORG/FAC VISIBILITY + DATA OWNERSHIP RESOLVED HERE)
// 🔹 Pill-based ADD / EDIT / REMOVE
// 🔹 Single source of truth (pills)
// 🔹 PUT / POST aligned with centralStockController
// 🔹 ❌ NEVER detect edit via URL
// 🔹 ❌ NEVER fetch edit payload here
// 🔹 ❌ NEVER own edit mode
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import {
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadSuppliersLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import {
  resolveUserRole,
  getOrganizationId,
  getFacilityId,
} from "../../utils/roleResolver.js";

import { CENTRAL_STOCK_FORM_RULES } from "./centralstock.form.rules.js";

/* ============================================================
   🧩 HELPERS
============================================================ */
const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

const normalizeDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ============================================================
   🧠 RULE VALIDATION (FORM → PILL ONLY)
============================================================ */
function validateUsingRules(form) {
  const errors = [];

  for (const rule of CENTRAL_STOCK_FORM_RULES) {
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
export function getCentralStockFormState() {
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
      `<p class="text-muted">No items added yet.</p>`;
    return;
  }

  selectedItems.forEach((item, idx) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `
      ${item.itemName} (x${item.quantity})
      <button type="button" class="btn btn-link pill-edit" data-idx="${idx}">
        <i class="ri-pencil-line"></i>
      </button>
      <button type="button" class="btn btn-link text-danger pill-remove" data-idx="${idx}">
        <i class="ri-close-line"></i>
      </button>
    `;
    pillsContainer.appendChild(pill);
  });

  pillsContainer.querySelectorAll(".pill-edit").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      const item = selectedItems[idx];

      selectedItems.splice(idx, 1);
      renderItemPills();

      isSelectingMasterItem = true;

      itemSearch.dataset.value = item.master_item_id;
      document.getElementById("master_item_id").value =
        item.master_item_id;
      itemSearch.value = item.itemName;

      supplierSelect.value = item.supplier_id || "";
      quantityInput.value = item.quantity;
      receivedInput.value = item.received_date || "";
      expiryInput.value = item.expiry_date || "";
      batchInput.value = item.batch_number || "";
      notesInput.value = item.notes || "";

      document.getElementById("addItemBtn").innerHTML =
        `<i class="ri-save-3-line"></i> Update`;
    };
  });

  pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
    btn.onclick = () => {
      selectedItems.splice(Number(btn.dataset.idx), 1);
      renderItemPills();
    };
  });
}

/* ============================================================
   🧹 SAFE RESET (ITEM FIELDS ONLY — CRITICAL FIX)
============================================================ */
function resetItemFieldsOnly() {
  quantityInput.value = "";
  receivedInput.value = "";
  expiryInput.value = "";
  batchInput.value = "";
  notesInput.value = "";

  itemSearch.value = "";
  itemSearch.dataset.value = "";
  document.getElementById("master_item_id").value = "";

  document.getElementById("addItemBtn").innerHTML =
    `<i class="ri-add-line"></i> Add`;
}

/* ============================================================
   🚀 MAIN FORM
============================================================ */
export async function setupCentralStockFormSubmission({
  form,
  sharedState,
}) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const stockId = sharedState?.currentEditIdRef?.value;
  const isEdit = Boolean(stockId);

  /* ---------------- DOM ---------------- */
  window.itemSearch = document.getElementById("itemSearch");
  const itemSuggestions =
    document.getElementById("itemSearchSuggestions");

  window.supplierSelect = document.getElementById("supplierSelect");
  window.quantityInput = document.getElementById("quantity");
  window.receivedInput = document.getElementById("receivedDate");
  window.expiryInput = document.getElementById("expiryDate");
  window.batchInput = document.getElementById("batchNumber");
  window.notesInput = document.getElementById("notes");

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  pillsContainer = document.getElementById("itemPillsContainer");

  /* ---------------- ROLE VISIBILITY ---------------- */
  const role = resolveUserRole();

  if (role === "superadmin") {
    document
      .getElementById("organizationFieldGroup")
      ?.classList.remove("d-none");
    document
      .getElementById("facilityFieldGroup")
      ?.classList.remove("d-none");
  } else if (role === "organization_admin") {
    document
      .getElementById("facilityFieldGroup")
      ?.classList.remove("d-none");
  }

  /* ---------------- SUPPLIERS ---------------- */
  setupSelectOptions(
    supplierSelect,
    await loadSuppliersLite({}, true),
    "id",
    "name",
    "-- Select Supplier --"
  );

  /* ---------------- MASTER ITEM SEARCH ---------------- */
  setupSuggestionInputDynamic(
    itemSearch,
    itemSuggestions,
    "/api/lite/master-items",
    (s) => {
      isSelectingMasterItem = true;
      itemSearch.dataset.value = s.id;
      document.getElementById("master_item_id").value = s.id;
      itemSearch.value = s.name;
    },
    "name"
  );

  itemSearch.addEventListener("input", () => {
    if (isSelectingMasterItem) {
      isSelectingMasterItem = false;
      return;
    }
    itemSearch.dataset.value = "";
    document.getElementById("master_item_id").value = "";
  });

  /* ---------------- ADD / UPDATE PILL ---------------- */
  document.getElementById("addItemBtn").onclick = () => {
    clearFormErrors(form);

    const ruleErrors = validateUsingRules(form);
    if (ruleErrors.length) {
      applyServerErrors(form, ruleErrors);
      return;
    }

    selectedItems.push({
      master_item_id: itemSearch.dataset.value,
      itemName: itemSearch.value,
      supplier_id: normalizeUUID(supplierSelect.value),
      quantity: Number(quantityInput.value),
      received_date: normalizeDate(receivedInput.value),
      expiry_date: normalizeDate(expiryInput.value),
      batch_number: batchInput.value.trim(),
      notes: notesInput.value || "",
    });

    resetItemFieldsOnly();
    renderItemPills();
  };

  /* ---------------- SUBMIT ---------------- */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    if (!selectedItems.length && !isEdit) {
      showToast("❌ No stock item to submit");
      return;
    }

    try {
      showLoading();

      let url = "/api/central-stocks";
      let method = "POST";

      let payload =
        isEdit
          ? { ...selectedItems[0] }
          : selectedItems.length === 1
            ? { ...selectedItems[0] }
            : selectedItems;

      // 🔐 OWNERSHIP INJECTION (FINAL, CORRECT)
      if (role === "superadmin") {
        payload.organization_id = normalizeUUID(orgSelect?.value);
        payload.facility_id = normalizeUUID(facSelect?.value);
      } else if (role === "organization_admin") {
        payload.organization_id = getOrganizationId();
        payload.facility_id = normalizeUUID(facSelect?.value);
      } else {
        payload.organization_id = getOrganizationId();
        payload.facility_id = getFacilityId();
      }

      if (isEdit) {
        url = `/api/central-stocks/${stockId}`;
        method = "PUT";
      }

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("❌ Save failed");

      showToast(
        isEdit
          ? "✅ Central stock updated"
          : "✅ Central stock added"
      );
      window.location.href = "/centralstocks-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  renderItemPills();
}
