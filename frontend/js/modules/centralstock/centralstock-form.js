// 📦 centralstock-form.js – Pill-based Central Stock Form (secure + role-aware)

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
  loadSuppliersLite,
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

function normalizeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function validateCentralStockFields({
  master_item_id,
  quantity,
  received_date,
  batch_number,
}) {
  if (!master_item_id) return showToast("❌ Master Item is required"), false;
  if (!quantity || Number(quantity) <= 0)
    return showToast("❌ Quantity must be greater than 0"), false;
  if (!received_date) return showToast("❌ Received Date is required"), false;
  if (!batch_number) return showToast("❌ Batch Number is required"), false;
  return true;
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
    pillsContainer.innerHTML = `<p class="text-muted">No items added yet.</p>`;
  } else {
    selectedItems.forEach((item, idx) => {
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.innerHTML = `
        ${item.itemName || item.masterItem?.name || "—"} (x${item.quantity})
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
        document.getElementById("itemSearch").dataset.value = item.master_item_id;
        document.getElementById("itemSearch").value =
          item.itemName || item.masterItem?.name || "";
        document.getElementById("supplierSelect").value = item.supplier_id || "";
        document.getElementById("quantity").value = item.quantity;
        document.getElementById("receivedDate").value = item.received_date || "";
        document.getElementById("expiryDate").value = item.expiry_date || "";
        document.getElementById("batchNumber").value = item.batch_number || "";
        document.getElementById("notes").value = item.notes || "";
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

export function getCentralStockFormState() {
  return { selectedItems, renderItemPills };
}

export async function setupCentralStockFormSubmission({ form }) {
  // 🔐 Auth
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const stockId = getQueryParam("id");
  const isEdit = !!stockId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  if (isEdit) {
    titleEl && (titleEl.textContent = "Edit Central Stock");
    submitBtn &&
      (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Stock`);
  } else {
    titleEl && (titleEl.textContent = "Add Central Stock");
    submitBtn &&
      (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit All`);
  }

  // 📋 DOM Refs
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const itemInput = document.getElementById("itemSearch");
  const itemSuggestions = document.getElementById("itemSearchSuggestions");
  const supplierSelect = document.getElementById("supplierSelect");
  const qtyInput = document.getElementById("quantity");
  const receivedInput = document.getElementById("receivedDate");
  const expiryInput = document.getElementById("expiryDate");
  const batchInput = document.getElementById("batchNumber");
  const notesInput = document.getElementById("notes");
  pillsContainer = document.getElementById("itemPillsContainer");

  /* ------------------------- Prefill dropdowns ------------------------- */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    if (userRole.includes("super")) {
      // 🏢 Super Admin → can select any org/facility
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });

    } else if (userRole.includes("admin")) {
      // 🧑‍💼 Admin → facility only (org auto)
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");

    } else if (userRole.includes("facilityhead")) {
      // 👨‍🏫 Facility Head → both hidden, auto-bound to their facility
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");

    } else if (userRole.includes("orgowner")) {
      // 🏛 Org Owner → hide org & facility
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");

    } else {
      // 👨‍⚕️ Doctor, nurse, staff → hide both
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }


    const suppliers = await loadSuppliersLite({}, true);
    setupSelectOptions(supplierSelect, suppliers, "id", "name", "-- Select Supplier --");

    setupSuggestionInputDynamic(
      itemInput,
      itemSuggestions,
      "/api/lite/master-items",
      (selected) => {
        itemInput.dataset.value = selected.id;
        itemInput.value = selected.name;
      },
      "name"
    );
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ------------------------- Prefill if Editing ------------------------- */
  if (isEdit && stockId) {
    try {
      showLoading();
      const res = await authFetch(`/api/central-stocks/${stockId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (res.ok && result?.data) {
        const entry = result.data;
        orgSelect.value = entry.organization_id || "";
        facSelect.value = entry.facility_id || "";
        supplierSelect.value = entry.supplier_id || "";
        itemInput.dataset.value = entry.master_item_id;
        itemInput.value = entry.masterItem?.name || "";
        qtyInput.value = entry.quantity || "";
        receivedInput.value = normalizeDate(entry.received_date) || "";
        expiryInput.value = normalizeDate(entry.expiry_date) || "";
        batchInput.value = entry.batch_number || "";
        notesInput.value = entry.notes || "";

        if (pillsContainer)
          pillsContainer.closest(".col-sm-12").style.display = "none";
        document
          .getElementById("addItemBtn")
          ?.closest(".col-sm-12")
          .classList.add("hidden");
      }
    } catch (err) {
      hideLoading();
      console.error(err);
      showToast("❌ Could not load stock entry");
    }
  } else {
    renderItemPills();
  }

  /* ------------------------- Add to pills ------------------------- */
  document.getElementById("addItemBtn")?.addEventListener("click", () => {
    if (isEdit) return;

    const obj = {
      master_item_id: itemInput.dataset.value || null,
      itemName: itemInput.value || "",
      supplier_id: supplierSelect.value || null,
      quantity: +qtyInput.value || 0,
      received_date: normalizeDate(receivedInput.value),
      expiry_date: normalizeDate(expiryInput.value),
      batch_number: batchInput.value.trim(),
      notes: notesInput.value.trim(),
    };

    if (!validateCentralStockFields(obj)) return;
    selectedItems.push(obj);

    // clear inputs
    itemInput.value = "";
    itemInput.dataset.value = "";
    supplierSelect.value = "";
    qtyInput.value = "";
    receivedInput.value = "";
    expiryInput.value = "";
    batchInput.value = "";
    notesInput.value = "";

    renderItemPills();
  });

  /* ------------------------- Submit ------------------------- */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    try {
      showLoading();

      let url = "/api/central-stocks";
      let method = "POST";
      let payload;

      if (isEdit && stockId) {
        url = `/api/central-stocks/${stockId}`;
        method = "PUT";
        payload = {
          master_item_id: itemInput.dataset.value,
          supplier_id: supplierSelect.value || null,
          quantity: +qtyInput.value,
          received_date: normalizeDate(receivedInput.value),
          expiry_date: normalizeDate(expiryInput.value),
          batch_number: batchInput.value,
          notes: notesInput.value,
        };
        if (!validateCentralStockFields(payload)) return;
      } else {
        if (!selectedItems.length)
          return showToast("❌ Please add at least one item before submitting");
        payload = selectedItems.length === 1 ? { ...selectedItems[0] } : selectedItems;
      }

      // 🚫 Do NOT send organization_id or facility_id — backend will infer from token
      delete payload.organization_id;
      delete payload.facility_id;

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ Stock updated successfully");
        window.location.href = "/centralstocks-list.html";
        return;
      }

      showToast(`✅ ${selectedItems.length} stock item(s) added successfully`);
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
    window.location.href = "/centralstocks-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    form.reset();
    itemInput.dataset.value = "";
    selectedItems = [];
    renderItemPills();
    if (isEdit) window.location.href = "/add-central-stock.html";
  });
}
