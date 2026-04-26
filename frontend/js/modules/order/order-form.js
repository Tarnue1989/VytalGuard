// ============================================================================
// 🧭 Secure & Role-Aware Order Form (ENTERPRISE MASTER PARITY)
// 🔹 Lab Request → Order Adaptation
// 🔹 Pill-based multi-item handling (WITH QUANTITY)
// 🔹 FULL EDIT SUPPORT (FIXED)
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

  /* ================= EDIT ================= */
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

      document.getElementById("itemQuantity").value =
        item.quantity || 1;

      editingIndex = idx;

      addItemBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Item`;
    };
  });

  /* ================= REMOVE ================= */
  pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);

      selectedItems.splice(idx, 1);

      if (editingIndex === idx) {
        editingIndex = null;
        addItemBtn.innerHTML =
          `<i class="ri-add-line me-1"></i> Add Item`;
      }

      renderItemPills();
    };
  });
}

/* ============================================================
   🚀 MAIN SETUP
============================================================ */
export async function setupOrderFormSubmission({
  form,
  token,
  sharedState,
  resetForm,
}) {
  enableLiveValidation(form);

  const orderId = sharedState?.currentEditIdRef?.value;
  const isEdit = Boolean(orderId);
  /* ============================================================
    🎯 UI MODE (MATCH PRESCRIPTION)
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setUI = (mode = "add") => {
    if (titleEl) {
      titleEl.textContent =
        mode === "edit" ? "Edit Order" : "Add Order";
    }

    if (submitBtn) {
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Order`
          : `<i class="ri-add-line me-1"></i> Submit Order`;
    }
  };

  /* 👉 APPLY MODE */
  setUI(isEdit ? "edit" : "add");
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
  // ✅ AUTO-SET TODAY'S DATE (ONLY FOR NEW FORM)
  if (!isEdit && !dateInput.value) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }
  const priorityInput = document.getElementById("is_priority");

  /* ============================================================
     🌐 DROPDOWNS
  ============================================================ */
  setupSelectOptions(
    deptSelect,
    await loadDepartmentsLite({}, true),
    "id",
    "name",
    "-- Select Department --"
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
        itemInput.value = sel?.label || "";
      },
      "label",
      {
        extraParams: () => ({
          exclude_category: JSON.stringify(["registration", "utility"])
        })
      }
    );
  /* ============================================================
    ✏️ EDIT PREFILL (FULL FIX)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      const res = await authFetch(`/api/orders/${orderId}`);
      const result = await res.json();

      if (!res.ok) throw new Error(result.message);

      const entry = result.data;

      /* ================= PATIENT ================= */
      patientInput.dataset.value = entry.patient_id || "";
      patientInput.value = entry.patient
        ? `${entry.patient.pat_no || ""} ${buildPersonName(entry.patient)}`
        : "";

      /* ================= PROVIDER ================= */
      if (entry.provider) {
        providerInput.dataset.value = entry.provider.id;
        providerInput.value = buildPersonName(entry.provider);
      } else {
        providerInput.dataset.value = "";
        providerInput.value = "";
      }

      /* ================= DEPARTMENT ================= */
      deptSelect.value = entry.department_id || "";

      /* ================= CONSULTATION ================= */
      if (entry.consultation) {
        consultationInput.dataset.value = entry.consultation.id;

        consultationInput.value =
          entry.consultation.label ||
          `Consultation ${normalizeDate(entry.consultation.consultation_date)}`;
      }

      /* ================= REG LOG ================= */
      if (entry.registrationLog) {
        regLogInput.dataset.value = entry.registrationLog.id;

        regLogInput.value =
          entry.registrationLog.label ||
          `RegLog ${normalizeDate(entry.registrationLog.registration_time)}`;
      }

      /* ================= CORE ================= */
      dateInput.value = normalizeDate(entry.order_date);
      notesInput.value = entry.notes || "";

      // 🔥 FIX (your backend uses "priority", not is_priority)
      priorityInput.checked = entry.priority === "stat";

      /* ================= ITEMS ================= */
      selectedItems =
        entry.items?.map((i) => ({
          id: i.id,
          billable_item_id: i.billable_item_id,
          billable_item_name:
            i.billableItem?.label ||
            `${i.billableItem?.name || ""}${
              i.billableItem?.code ? ` (${i.billableItem.code})` : ""
            }`,
          quantity: i.quantity || 1,
          notes: i.notes || "",
        })) || [];

      renderItemPills();

    } catch (err) {
      showToast(err.message || "❌ Failed to load order");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     ➕ ADD / UPDATE ITEM
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

      addItemBtn.innerHTML =
        `<i class="ri-add-line me-1"></i> Add Item`;
    } else {
      selectedItems.push(obj);
    }

    itemInput.value = "";
    itemInput.dataset.value = "";
    itemNotesInput.value = "";
    quantityInput.value = 1;

    renderItemPills();
    setUI("edit");
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

    const normalizedDate = normalizeDate(dateInput.value);

    const payload = {
      patient_id: normalizeUUID(patientInput.dataset.value),
      provider_id: normalizeUUID(providerInput.dataset.value),
      department_id: normalizeUUID(deptSelect.value),
      consultation_id: normalizeUUID(consultationInput.dataset.value),
      registration_log_id: normalizeUUID(regLogInput.dataset.value),

      notes: notesInput.value || null,
      is_priority: !!priorityInput.checked,

      items: selectedItems.map((i) => ({
        billable_item_id: i.billable_item_id,
        quantity: i.quantity || 1,
        notes: i.notes || "",
      })),
    };

    // ✅ ONLY ADD DATE IF VALID
    if (normalizedDate) {
      payload.order_date = normalizedDate;
    }
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

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result?.message || "❌ Server error");
      }

      /* ============================================================
        🚨 HANDLE SKIPPED RECORDS (FIX)
      ============================================================ */

      // ❌ NOTHING CREATED
      if (
        !isEdit &&
        result?.data?.records?.length === 0 &&
        result?.data?.skipped?.length
      ) {
        const reasons = result.data.skipped
          .map((s) => `Row ${s.index + 1}: ${s.reason}`)
          .join("\n");

        showToast(`❌ No orders created:\n${reasons}`, "error");
        return;
      }

      // ⚠️ PARTIAL SUCCESS
      if (!isEdit && result?.data?.skipped?.length) {
        const reasons = result.data.skipped
          .map((s) => `Row ${s.index + 1}: ${s.reason}`)
          .join("\n");

        showToast(`⚠️ Some records skipped:\n${reasons}`, "warning");
      }

      // ✅ SUCCESS MESSAGE
      showToast(isEdit ? "✅ Updated" : "✅ Created");

      /* ============================================================
        🔄 CONTINUE NORMAL FLOW
      ============================================================ */

      if (isEdit) {
        window.location.href = "/orders-list.html";
      } else {
        form.reset();
        selectedItems = [];
        editingIndex = null;

        renderItemPills();

        // ✅ RESET UI
        setUI("add");

        // ✅ CLEAR suggestion dataset values
        [
          patientInput,
          providerInput,
          consultationInput,
          regLogInput,
          itemInput,
        ].forEach((el) => {
          if (el) el.dataset.value = "";
        });

        dateInput.value = new Date().toISOString().split("T")[0];
      }

    } catch (err) {
      showToast(err.message || "❌ Error");
    } finally {
      hideLoading();
    }
  };
}