// 📦 stockrequest-form.js – Secure & Role-Aware Stock Request Form (Master Pattern Aligned)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
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

function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
}

function normalizeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function validateRequestItem({ master_item_id, quantity }) {
  if (!master_item_id) return showToast("❌ Item is required"), false;
  if (!quantity || Number(quantity) <= 0)
    return showToast("❌ Quantity must be greater than 0"), false;
  return true;
}

/* ============================================================
   🧠 Shared Pill State
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
        ${item.itemName || "—"} (x${item.quantity})
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
        document.getElementById("itemSearch").value = item.itemName || "";
        document.getElementById("quantity").value = item.quantity;
        document.getElementById("remarks").value = item.remarks || "";

        editingIndex = idx;
        const addBtn = document.getElementById("addItemBtn");
        if (addBtn) {
          addBtn.innerHTML = `<i class="ri-check-line me-1"></i> Update Item`;
          addBtn.classList.remove("btn-outline-primary");
          addBtn.classList.add("btn-success");
        }
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

export function getStockRequestFormState() {
  return { selectedItems, renderItemPills };
}

/* ============================================================
   🚀 Setup Stock Request Form
============================================================ */
export async function setupStockRequestFormSubmission({ form }) {
  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  pillsContainer = document.getElementById("itemPillsContainer");

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");

  const itemInput = document.getElementById("itemSearch");
  const itemSuggestions = document.getElementById("itemSearchSuggestions");
  const qtyInput = document.getElementById("quantity");
  const remarksInput = document.getElementById("remarks");
  const notesInput = document.getElementById("notes");
  const refInput = document.getElementById("referenceNumber");
  const addItemBtn = document.getElementById("addItemBtn");

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  // 🧠 Edit Mode
  const sessionId = sessionStorage.getItem("stockRequestEditId");
  const queryId = getQueryParam("id");
  const reqId = sessionId || queryId;
  const isEdit = !!reqId;

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Stock Request");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Request`);
    } else {
      titleEl && (titleEl.textContent = "Add Stock Request");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit Request`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🧭 Prefill Dropdowns & Suggestions
  ============================================================ */
  let userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  try {
    if (userRole.includes("super")) {
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
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

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

  /* ============================================================
     ✏️ Prefill if Editing
  ============================================================ */
  if (isEdit && reqId) {
    try {
      showLoading();
      const res = await authFetch(`/api/stock-requests/${reqId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load stock request"));
      const entry = result?.data;
      if (!entry) return;

      deptSelect.value = entry.department_id || "";
      refInput.value = entry.reference_number || "";
      notesInput.value = entry.notes || "";

      selectedItems = (entry.items || []).map((it) => ({
        master_item_id: it.master_item_id,
        itemName: it.masterItem?.name || "",
        quantity: it.quantity,
        remarks: it.remarks || "",
      }));
      renderItemPills();
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load stock request");
    }
  }

  /* ============================================================
     ➕ Add / Update Item
  ============================================================ */
  addItemBtn?.addEventListener("click", () => {
    const obj = {
      master_item_id: itemInput.dataset.value || null,
      itemName: itemInput.value || "",
      quantity: +qtyInput.value || 0,
      remarks: remarksInput.value.trim(),
    };
    if (!validateRequestItem(obj)) return;

    if (editingIndex !== null) {
      selectedItems[editingIndex] = obj;
      editingIndex = null;
      addItemBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Item`;
      addItemBtn.classList.remove("btn-success");
      addItemBtn.classList.add("btn-outline-primary");
    } else {
      selectedItems.push(obj);
    }

    itemInput.value = "";
    itemInput.dataset.value = "";
    qtyInput.value = "";
    remarksInput.value = "";
    renderItemPills();
  });

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      organization_id: normalizeUUID(orgSelect?.value),
      facility_id: normalizeUUID(facSelect?.value),
      department_id: normalizeUUID(deptSelect?.value),
      notes: notesInput.value || "",
      reference_number: refInput.value || "",
      items: selectedItems,
    };

    if (!payload.department_id)
      return showToast("❌ Department is required");
    if (!selectedItems.length)
      return showToast("❌ Please add at least one item before submitting");

    try {
      showLoading();
      const url = isEdit
        ? `/api/stock-requests/${reqId}`
        : `/api/stock-requests`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(
        isEdit
          ? "✅ Stock Request updated successfully"
          : "✅ Stock Request created successfully"
      );

      sessionStorage.removeItem("stockRequestEditId");
      sessionStorage.removeItem("stockRequestEditPayload");

      if (isEdit) window.location.href = "/stockrequests-list.html";
      else {
        form.reset();
        selectedItems = [];
        renderItemPills();
        setUI("add");
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("stockRequestEditId");
    sessionStorage.removeItem("stockRequestEditPayload");
    window.location.href = "/stockrequests-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("stockRequestEditId");
    sessionStorage.removeItem("stockRequestEditPayload");
    form.reset();
    itemInput.dataset.value = "";
    selectedItems = [];
    renderItemPills();

    addItemBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Item`;
    addItemBtn.classList.remove("btn-success");
    addItemBtn.classList.add("btn-outline-primary");
    setUI("add");
  });

  // Initial render
  renderItemPills();
}
