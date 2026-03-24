// ============================================================================
// 🧭 Secure & Role-Aware Order Form (ENTERPRISE MASTER PARITY)
// 🔹 Lab Request → Order Adaptation
// 🔹 Pill-based multi-item handling (WITH QUANTITY)
// 🔹 Rule-driven validation
// 🔹 Controller-faithful
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
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

/* ============================================================ */
function normalizeUUID(val) {
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

function normalizeDate(val) {
  if (!val) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

  const d = new Date(val);
  if (isNaN(d.getTime())) return null;

  return d.toISOString().split("T")[0];
}

function buildPersonName(obj) {
  if (!obj) return "";
  return [obj.first_name, obj.middle_name, obj.last_name]
    .filter(Boolean)
    .join(" ");
}

/* ============================================================
   💊 ORDER ITEMS (PILLS)
============================================================ */
let selectedItems = [];
let pillsContainer = null;
let editingIndex = null;
let addItemBtn = null;

function validateOrderItem(obj) {
  if (!obj.billable_item_id) {
    showToast("❌ Order item is required");
    return false;
  }
  return true;
}

function renderItemPills() {
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  if (!selectedItems.length) {
    pillsContainer.innerHTML =
      `<p class="text-muted">No order items added yet.</p>`;
    return;
  }

  selectedItems.forEach((item, idx) => {
    const pill = document.createElement("div");
    pill.className = "pill";

    pill.innerHTML = `
      ${item.billable_item_name || "—"} (x${item.quantity || 1})
      <button type="button" class="pill-edit" data-idx="${idx}">✏️</button>
      <button type="button" class="pill-remove" data-idx="${idx}">❌</button>
    `;

    pillsContainer.appendChild(pill);
  });

  pillsContainer.querySelectorAll(".pill-edit").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      const item = selectedItems[idx];

      document.getElementById("orderItemSearch").dataset.value =
        item.billable_item_id;

      document.getElementById("orderItemSearch").value =
        item.billable_item_name || "";

      document.getElementById("itemNotes").value =
        item.notes || "";

      const quantityInput = document.getElementById("itemQuantity");
      if (quantityInput) {
        quantityInput.value = item.quantity || 1;
      }

      editingIndex = idx;

      if (addItemBtn) {
        addItemBtn.innerHTML = "Update Item";
      }
    };
  });

  pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      selectedItems.splice(idx, 1);
      renderItemPills();
    };
  });
}

/* ============================================================
   🚀 MAIN SETUP
============================================================ */
export function setupOrderFormSubmission({
  form,
  token,
  sharedState,
  resetForm,
}) {
  enableLiveValidation(form);

  const orderId = sharedState?.currentEditIdRef?.value;
  const isEdit = Boolean(orderId);

  addItemBtn = document.getElementById("addItemBtn");
  pillsContainer = document.getElementById("orderPillsContainer");

  const patientInput = document.getElementById("patientSearch");
  const providerInput = document.getElementById("providerSearch");
  const consultationInput = document.getElementById("consultationSearch");
  const regLogInput = document.getElementById("registrationLogSearch");
  const deptSelect = document.getElementById("departmentSelect");

  const itemInput = document.getElementById("orderItemSearch");
  const quantityInput = document.getElementById("itemQuantity");
  const notesInput = document.getElementById("notes");
  const itemNotesInput = document.getElementById("itemNotes");
  const dateInput = document.getElementById("order_date");
  const priorityInput = document.getElementById("is_priority");

  /* ============================================================
     🌐 DROPDOWNS
  ============================================================ */
  loadDepartmentsLite({}, true).then((data) =>
    setupSelectOptions(deptSelect, data, "id", "name")
  );

  setupSuggestionInputDynamic(
    patientInput,
    document.getElementById("patientSearchSuggestions"),
    "/api/lite/patients",
    (sel) => {
      patientInput.dataset.value = sel?.id || "";
      patientInput.value =
        sel?.label || `${sel?.pat_no || ""} ${buildPersonName(sel)}`;
    },
    "label"
  );

  setupSuggestionInputDynamic(
    providerInput,
    document.getElementById("providerSearchSuggestions"),
    "/api/lite/employees",
    (sel) => {
      providerInput.dataset.value = sel?.id || "";
      providerInput.value = buildPersonName(sel);
    },
    "full_name"
  );

  setupSuggestionInputDynamic(
    consultationInput,
    document.getElementById("consultationSearchSuggestions"),
    "/api/lite/consultations",
    (sel) => {
      consultationInput.dataset.value = sel?.id || "";
      consultationInput.value = sel?.label || "";
    },
    "label"
  );

  setupSuggestionInputDynamic(
    regLogInput,
    document.getElementById("registrationLogSearchSuggestions"),
    "/api/lite/registration-logs",
    (sel) => {
      regLogInput.dataset.value = sel?.id || "";
      regLogInput.value = sel?.label || "";
    },
    "label"
  );

  setupSuggestionInputDynamic(
    itemInput,
    document.getElementById("orderItemSearchSuggestions"),
    "/api/lite/billable-items",
    (sel) => {
      itemInput.dataset.value = sel?.id || "";
      itemInput.value = sel?.name || "";
    },
    "name"
  );

  /* ============================================================
     ➕ ADD ITEM
  ============================================================ */
  addItemBtn?.addEventListener("click", () => {
    const obj = {
      billable_item_id: normalizeUUID(itemInput.dataset.value),
      billable_item_name: itemInput.value,
      quantity: Number(quantityInput.value || 1),
      notes: itemNotesInput.value.trim(),
    };

    if (!validateOrderItem(obj)) return;

    if (editingIndex !== null) {
      selectedItems[editingIndex] = {
        ...selectedItems[editingIndex],
        ...obj,
      };
      editingIndex = null;
    } else {
      selectedItems.push(obj);
    }

    itemInput.value = "";
    itemInput.dataset.value = "";
    itemNotesInput.value = "";
    quantityInput.value = 1;

    renderItemPills();
  });

  /* ============================================================
     💾 SUBMIT
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    if (!normalizeUUID(patientInput.dataset.value)) {
      applyServerErrors(form, [
        { field: "patientSearch", message: "Patient required" },
      ]);
      return;
    }

    if (!selectedItems.length) {
      showToast("❌ Add at least one item");
      return;
    }

    const payload = {
      patient_id: normalizeUUID(patientInput.dataset.value),
      provider_id: normalizeUUID(providerInput.dataset.value),
      department_id: normalizeUUID(deptSelect.value),
      consultation_id: normalizeUUID(consultationInput.dataset.value),
      registration_log_id: normalizeUUID(regLogInput.dataset.value),
      order_date: dateInput.value,
      notes: notesInput.value || null,
      is_priority: !!priorityInput.checked,
      items: selectedItems.map((i) => ({
        billable_item_id: i.billable_item_id,
        quantity: i.quantity || 1,
        notes: i.notes || "",
      })),
    };

    try {
      showLoading();

      const res = await authFetch(
        isEdit ? `/api/orders/${orderId}` : `/api/orders`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json();

      if (!res.ok) throw new Error(result.message);

      showToast(isEdit ? "✅ Updated" : "✅ Created");

      if (isEdit) {
        window.location.href = "/orders-list.html";
      } else {
        form.reset();
        selectedItems = [];
        renderItemPills();
      }
    } catch (err) {
      showToast(err.message || "❌ Error");
    } finally {
      hideLoading();
    }
  };

  renderItemPills();
}