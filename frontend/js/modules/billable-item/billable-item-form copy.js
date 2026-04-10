// 📦 billable-item-form.js – Secure & Role-Aware Billable Item Form (PART 1)
// ============================================================================
// 🔹 Converted from: prescription-form.js
// 🔹 NO refactor — structure preserved
// 🔹 Pill-based multi-price handling (converted from medication pills)
// 🔹 Controller-faithful (prices[])
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
  loadDepartmentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔧 HELPERS (UNCHANGED)
============================================================ */
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
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

/* ============================================================
   💰 Pill-Based PRICE Handling (CONVERTED)
============================================================ */
let selectedPrices = [];
let pillsContainer = null;
let editingIndex = null;
let addItemBtn = null;

function validatePriceItem(obj) {
  if (!obj.price) {
    showToast("❌ Price is required");
    return false;
  }
  if (!obj.currency) {
    showToast("❌ Currency is required");
    return false;
  }
  if (!obj.payer_type) {
    showToast("❌ Payer type is required");
    return false;
  }
  return true;
}

function renderPricePills() {
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  if (!selectedPrices.length) {
    pillsContainer.innerHTML =
      `<p class="text-muted">No prices added yet.</p>`;
    return;
  }

  selectedPrices.forEach((item, idx) => {
    const pill = document.createElement("div");
    pill.className = "pill";

    pill.innerHTML = `
      ${item.payer_type || "—"} 
      – ${item.currency || ""} 
      – ${item.price || ""}
      ${item.is_default ? " (Default)" : ""}

      <button type="button" class="btn btn-sm btn-link pill-edit" data-idx="${idx}">
        <i class="ri-pencil-line"></i>
      </button>

      <button type="button" class="btn btn-sm btn-link text-danger pill-remove" data-idx="${idx}">
        <i class="ri-close-line"></i>
      </button>
    `;

    pillsContainer.appendChild(pill);
  });

  // ================= EDIT =================
  pillsContainer.querySelectorAll(".pill-edit").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      const item = selectedPrices[idx];

      document.getElementById("payer_type").value = item.payer_type || "";
      document.getElementById("currency").value = item.currency || "";
      document.getElementById("price").value = item.price || "";
      document.getElementById("is_default").checked = !!item.is_default;

      editingIndex = idx;

      if (addItemBtn) {
        addItemBtn.innerHTML =
          `<i class="ri-save-3-line me-1"></i> Update Price`;
      }
    };
  });

  // ================= REMOVE =================
  pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);

      selectedPrices.splice(idx, 1);

      if (editingIndex === idx) {
        editingIndex = null;
        if (addItemBtn) {
          addItemBtn.innerHTML =
            `<i class="ri-add-line me-1"></i> Add Price`;
        }
      }

      renderPricePills();
    };
  });
}

/* ============================================================
   🚀 Main Setup (CONVERTED FROM PRESCRIPTION)
============================================================ */
export async function setupBillableItemFormSubmission({
  form,
  sharedState,
}) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const itemId = sharedState?.currentEditIdRef?.value;
  const isEdit = Boolean(itemId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");
  addItemBtn = document.getElementById("addItemBtn");

  pillsContainer = document.getElementById("pricePillsContainer");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Edit Billable Item" : "Add Billable Item";

    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Item`
          : `<i class="ri-add-line me-1"></i> Save Item`;
  };

  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM REFS (CONVERTED)
  ============================================================ */
  const deptSelect = document.getElementById("departmentSelect");

  const masterItemInput = document.getElementById("masterItemSearch");
  const masterItemSuggestions = document.getElementById(
    "masterItemSearchSuggestions"
  );

  const nameInput = document.getElementById("name");
  const codeInput = document.getElementById("code");
  const descInput = document.getElementById("description");

  /* ============================================================
     🌐 DROPDOWNS + MASTER ITEM AUTOFILL
  ============================================================ */
  try {
    setupSelectOptions(
      deptSelect,
      await loadDepartmentsLite({}, true),
      "id",
      "name",
      "-- Select Department --"
    );

    // ================= MASTER ITEM =================
    setupSuggestionInputDynamic(
      masterItemInput,
      masterItemSuggestions,
      "/api/lite/master-items",
      (sel) => {
        masterItemInput.dataset.value = sel?.id || "";
        document.getElementById("master_item_id").value = sel?.id || "";

        masterItemInput.value = sel?.name || "";

        /* 🔥 NAME + CODE */
        nameInput.value = sel?.name || "";
        codeInput.value =
          sel?.code ||
          (sel?.name || "")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9\-]/g, "");

        /* 🔥 CATEGORY PREFILL (FIXED FULLY) */
        const catInput = document.getElementById("category_name");
        const catIdInput = document.getElementById("category_id");

        const categoryName =
          sel?.category?.name ||
          sel?.category_name ||
          "";

        const categoryId =
          sel?.category_id ||
          sel?.category?.id ||
          "";

        if (catInput) catInput.value = categoryName;
        if (catIdInput) catIdInput.value = categoryId;
      },
      "name"
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      const res = await authFetch(`/api/billable-items/${itemId}`);
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(
          normalizeMessage(result, "Failed to load item")
        );

      const entry = result.data;

      masterItemInput.dataset.value = entry.master_item_id || "";
      masterItemInput.value = entry.masterItem?.name || "";

      nameInput.value = entry.name || "";
      codeInput.value = entry.code || "";
      descInput.value = entry.description || "";

      deptSelect.value = entry.department_id || "";

      // 🔥 LOAD PRICES
      selectedPrices =
        entry.prices?.map((p) => ({
          payer_type: p.payer_type,
          currency: p.currency,
          price: p.price,
          is_default: p.is_default,
        })) || [];

      renderPricePills();
    } catch (err) {
      showToast(err.message || "❌ Load failed");
    } finally {
      hideLoading();
    }
  } else {
    renderPricePills();
  }

  /* ============================================================
     ➕ ADD / UPDATE PRICE (CRITICAL FIX)
  ============================================================ */
  addItemBtn?.addEventListener("click", () => {
    const obj = {
      payer_type: document.getElementById("payer_type").value,
      currency: document.getElementById("currency").value,
      price: document.getElementById("price").value,
      is_default: document.getElementById("is_default").checked,
    };

    if (!validatePriceItem(obj)) return;

    // 🔥 enforce single default per currency
    if (obj.is_default) {
      selectedPrices = selectedPrices.map((p) =>
        p.currency === obj.currency
          ? { ...p, is_default: false }
          : p
      );
    }

    if (editingIndex !== null) {
      selectedPrices[editingIndex] = {
        ...selectedPrices[editingIndex],
        ...obj,
      };
      editingIndex = null;

      addItemBtn.innerHTML =
        `<i class="ri-add-line me-1"></i> Add Price`;
    } else {
      selectedPrices.push(obj);
    }

    // reset inputs
    ["payer_type", "currency", "price"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    document.getElementById("is_default").checked = false;

    renderPricePills();
  });

  /* ============================================================
     💾 SUBMIT (FULLY MATCHES CONTROLLER)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    if (!normalizeUUID(masterItemInput.dataset.value)) {
      applyServerErrors(form, [
        {
          field: "masterItemSearch",
          message: "Master item is required",
        },
      ]);
      return;
    }

    if (!selectedPrices.length) {
      showToast("❌ Add at least one price");
      return;
    }

    const payload = {
      master_item_id: normalizeUUID(masterItemInput.dataset.value),
      name: nameInput.value,
      code: codeInput.value,
      description: descInput.value || null,
      department_id: normalizeUUID(deptSelect.value),

      // 🔥 THIS IS THE FIX FOR YOUR SYSTEM
      prices: selectedPrices.map((p) => ({
        payer_type: p.payer_type,
        currency: p.currency,
        price: Number(p.price),
        is_default: !!p.is_default,
      })),
    };

    try {
      showLoading();

      const res = await authFetch(
        isEdit
          ? `/api/billable-items/${itemId}`
          : `/api/billable-items`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(
          normalizeMessage(result, "❌ Server error")
        );

      showToast(
        isEdit
          ? "✅ Item updated"
          : "✅ Item created"
      );

      if (isEdit) {
        window.location.href = "/billable-items-list.html";
      } else {
        form.reset();

        selectedPrices = [];
        editingIndex = null;

        renderPricePills();
        setUI("add");

        masterItemInput.dataset.value = "";
      }
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 CANCEL / CLEAR
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    window.location.href = "/billable-items-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();

    selectedPrices = [];
    editingIndex = null;

    renderPricePills();

    addItemBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Price`;
  });
}