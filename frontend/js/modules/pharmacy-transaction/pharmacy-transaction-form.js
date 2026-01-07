// 📦 pharmacy-transaction-form.js – Enterprise Master Pattern Aligned (Add/Edit Pharmacy Transaction)
// ============================================================================
// 🔹 Mirrors payment-form.js structure for unified enterprise behavior
// 🔹 Preserves all prescription item logic, IDs, and event wiring
// 🔹 Adds role-based org/facility cascade, RBAC guard, validation, and unified submission flow
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
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
   🧩 Helpers
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
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}
function isUUID(val) {
  return /^[0-9a-fA-F-]{36}$/.test(val || "");
}

/* ============================================================
   ✅ Validation
============================================================ */
function validatePharmacyTransactionForm(payload, isEdit) {
  const errors = [];
  if (!payload.patient_id) errors.push("Patient is required");
  if (!payload.prescription_id) errors.push("Prescription is required");
  if (!payload.department_id) errors.push("Department is required");
  if (!payload.items || payload.items.length === 0)
    errors.push("At least one valid item is required");

  if (isEdit && !payload.notes)
    errors.push("Reason/Notes required when editing transaction");

  return errors;
}

/* ============================================================
   📦 Global State
============================================================ */
let transactionItems = [];
let viewMode = null;

/* ============================================================
   🗂️ Item Renderer (preserved)
============================================================ */
function renderItemsTable() {
  const container = document.getElementById("transactionItemsContainer");
  const toggleBtn = document.getElementById("toggleViewBtn");
  if (!container) return;

  if (!transactionItems.length) {
    container.innerHTML = `<p class="text-muted">No prescription selected or items available.</p>`;
    toggleBtn?.classList.add("d-none");
    return;
  }
  toggleBtn?.classList.remove("d-none");

  // default to table for desktop, card for mobile
  if (!viewMode) viewMode = window.innerWidth < 768 ? "card" : "table";

  const renderStockSelect = (it, idx) =>
    `<select class="form-select form-select-sm stock-select" data-idx="${idx}">
      <option value="">-- Select Batch --</option>
      ${(it.stocks || [])
        .map(
          (s) => `
        <option value="${s.id}" ${
            String(it.department_stock_id) === String(s.id) ? "selected" : ""
          }>
          ${s.batch_no || "Batch"} (exp: ${normalizeDate(s.expiry_date) || "—"}) – bal: ${s.balance}
        </option>`
        )
        .join("")}
    </select>`;

  const renderTypeSelect = (it, idx) => {
    const canReturn = (it.already_dispensed || 0) > 0;

    return `
      <select class="form-select form-select-sm type-select" data-idx="${idx}">
        <option value="dispense" ${it.type === "dispense" ? "selected" : ""}>
          Dispense
        </option>

        ${
          canReturn
            ? `<option value="return" ${it.type === "return" ? "selected" : ""}>
                Return
              </option>`
            : `<option value="return" disabled>
                Return (nothing dispensed)
              </option>`
        }
      </select>
    `;
  };


  const renderQty = (it, idx, remaining) =>
    `<input
      type="number"
      min="0"
      max="${remaining}"
      ${remaining === 0 ? "disabled" : ""}
      class="form-control form-control-sm dispense-input"
      data-idx="${idx}"
      value="${it.dispense_now || 0}"
      style="
        width:80px;
        min-width:80px;
        font-weight:700;
        font-size:1.15rem;
        background:#e8f5e9;
        border:2px solid #28a745;
        text-align:center;
      "
    >`;


  if (viewMode === "table") {
    const rows = transactionItems.map((it, idx) => {
      const remaining = Math.max(
        (it.prescribed_qty || 0) - (it.already_dispensed || 0),
        0
      );
      return `
        <tr>
          <td>${it.medication_name || "—"}</td>
          <td>${it.prescribed_qty ?? "—"}</td>
          <td>${it.already_dispensed ?? 0}</td>
          <td>${remaining}</td>
          <td>${renderStockSelect(it, idx)}</td>
          <td>${renderTypeSelect(it, idx)}</td>
          <td>${renderQty(it, idx, remaining)}</td>
          <td><input type="text" class="form-control form-control-sm notes-input"
              data-idx="${idx}" value="${it.notes || ""}" placeholder="Notes..."></td>
        </tr>`;
    });
    container.innerHTML = `
      <div class="table-responsive" style="max-height:320px;overflow:auto;">
        <table class="table table-sm table-bordered align-middle w-100">
          <thead class="table-light">
            <tr>
              <th>Medication</th>
              <th>Prescribed</th>
              <th>Dispensed</th>
              <th>Remaining</th>
              <th>Batch</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>`;
    toggleBtn.innerHTML = `<i class="ri-layout-grid-line me-1"></i> Card View`;
  } else {
    const cards = transactionItems.map((it, idx) => {
      const remaining = Math.max(
        (it.prescribed_qty || 0) - (it.already_dispensed || 0),
        0
      );
      return `
        <div class="card mb-2 shadow-sm">
          <div class="card-body p-2 small">
            <div><strong>${it.medication_name}</strong> (${it.prescribed_qty ?? 0} prescribed)</div>
            <div class="mt-2 d-flex gap-1 flex-wrap">
              ${renderStockSelect(it, idx)}
              ${renderTypeSelect(it, idx)}
              ${renderQty(it, idx, remaining)}
              <input type="text" class="form-control form-control-sm notes-input"
                data-idx="${idx}" value="${it.notes || ""}" placeholder="Notes">
            </div>
          </div>
        </div>`;
    });
    container.innerHTML = cards.join("");
    toggleBtn.innerHTML = `<i class="ri-table-line me-1"></i> Table View`;
  }

  // Sync handlers
  container.querySelectorAll(".stock-select").forEach((sel) =>
    sel.addEventListener("change", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      transactionItems[idx].department_stock_id = e.target.value || null;
    })
  );
  container.querySelectorAll(".type-select").forEach((sel) =>
    sel.addEventListener("change", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const item = transactionItems[idx];

      const canReturn = (item.already_dispensed || 0) > 0;

      if (e.target.value === "return" && !canReturn) {
        showToast("⚠️ Cannot return medication that was not dispensed.");
        e.target.value = "dispense";
        item.type = "dispense";
        return;
      }

      item.type = e.target.value;
    })
  );


  container.querySelectorAll(".dispense-input").forEach((input) =>
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const item = transactionItems[idx];

      const remaining = Math.max(
        (item.prescribed_qty || 0) - (item.already_dispensed || 0),
        0
      );

      let val = Number(e.target.value);
      if (Number.isNaN(val)) val = 0;

      // 🚫 No negatives
      if (val < 0) {
        val = 0;
        showToast("⚠️ Quantity cannot be negative.");
      }

      // 🚫 HARD RULE: no partial quantities
      if (val !== 0 && val !== remaining) {
        showToast(
          `⚠️ Partial dispensing is disabled. Enter ${remaining} or 0.`
        );
        val = remaining; // auto-snap to full
      }

      e.target.value = val;
      item.dispense_now = val;
    })
  );


  container.querySelectorAll(".notes-input").forEach((input) =>
    input.addEventListener("input", (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      transactionItems[idx].notes = e.target.value;
    })
  );
}

/* ============================================================
   🖼️ View Toggle
============================================================ */
function initViewToggle() {
  const btn = document.getElementById("toggleViewBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    viewMode = viewMode === "table" ? "card" : "table";
    renderItemsTable();
  });
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupPharmacyTransactionFormSubmission({ form }) {
  const queryId = getQueryParam("id");
  const isEdit = !!queryId;

  // 🔐 Auth Guard
  const token = initPageGuard(
    autoPagePermissionKey(["pharmacy_transactions:create", "pharmacy_transactions:edit"])
  );

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const modeUI = isEdit
    ? {
        title: "Edit Pharmacy Transaction",
        btn: `<i class="ri-save-3-line me-1"></i> Update Transaction`,
      }
    : {
        title: "New Pharmacy Transaction",
        btn: `<i class="ri-add-line me-1"></i> Submit`,
      };
  if (titleEl) titleEl.textContent = modeUI.title;
  if (submitBtn) submitBtn.innerHTML = modeUI.btn;

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const patientInput = document.getElementById("patientSearch");
  const patientSuggestions = document.getElementById("patientSearchSuggestions");
  const prescriptionSelect = document.getElementById("prescriptionRequestSelect");
  const fulfilledByInput = document.getElementById("fulfilledBySearch");
  const fulfilledBySuggestions = document.getElementById("fulfilledBySearchSuggestions");
  // 📅 Default fulfillment date = today (user can change)
  const fulfillmentDateInput = document.getElementById("fulfillment_date");
  if (fulfillmentDateInput && !fulfillmentDateInput.value) {
    fulfillmentDateInput.value = new Date().toISOString().slice(0, 10);
  }

  /* ============================================================
     🔽 Dropdowns & Cascades
  ============================================================ */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");

      orgSelect?.addEventListener("change", async () => {
        const orgId = orgSelect.value;
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      });
      } else {
        // 🔒 Hide org, facility, and fulfilled-by for regular users
        orgSelect?.closest(".form-group")?.classList.add("hidden");
        facSelect?.closest(".form-group")?.classList.add("hidden");
        fulfilledByInput?.closest(".field-wrapper")?.classList.add("hidden");

        // Still load facility silently (for payload)
        const facs = await loadFacilitiesLite({}, true);
        setupSelectOptions(facSelect, facs, "id", "name");
      }



    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

    // Cascading: Facility → Departments
    facSelect?.addEventListener("change", async () => {
      const facId = facSelect.value;
      const depts = await loadDepartmentsLite(
        facId ? { facility_id: facId } : {},
        true
      );
      setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");
    });

    // Fulfilled By (pharmacist)
    setupSuggestionInputDynamic(
      fulfilledByInput,
      fulfilledBySuggestions,
      "/api/lite/employees",
      (sel) => {
        fulfilledByInput.dataset.value = sel?.id || "";
        fulfilledByInput.value =
          sel?.label ||
          `${sel?.first_name || ""} ${sel?.last_name || ""}`.trim() ||
          sel?.full_name ||
          sel?.email ||
          "";
      },
      "label"
    );

    // Patient → prescriptions
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (selected) => {
        patientInput.dataset.value = selected?.id || "";
        patientInput.value =
          `${selected?.pat_no || ""} - ${selected?.full_name || ""}`.trim();
        try {
          showLoading();
          const res = await authFetch(
            `/api/lite/prescriptions?patient_id=${selected.id}&status=open`
          );
          const data = await res.json();
          hideLoading();
          if (res.ok)
            setupSelectOptions(
              prescriptionSelect,
              data?.data?.records || [],
              "id",
              "display_name",
              "-- Select Prescription --"
            );
        } catch (err) {
          hideLoading();
          showToast("❌ Failed to load prescriptions");
        }
      },
      "label"
    );

    // Prescription → load items
    prescriptionSelect?.addEventListener("change", async () => {
      const presId = prescriptionSelect.value;
      const deptId = deptSelect.value;

      if (!isUUID(presId) || !isUUID(deptId)) {
        transactionItems = [];
        renderItemsTable();
        return;
      }

      try {
        showLoading();
        const res = await authFetch(
          `/api/lite/prescription-items?prescription_id=${presId}&department_id=${deptId}&status=issued,partially_dispensed`
        );
        const data = await res.json();
        hideLoading();

        transactionItems =
          data?.data?.records?.map((i) => {
            const remaining = Math.max(
              (i.prescribed_qty || 0) - (i.already_dispensed || 0),
              0
            );

            // ⚠️ EARLY STOCK WARNING (UI only)
            const totalStock = (i.stocks || []).reduce(
              (sum, s) => sum + (s.balance || 0),
              0
            );

            if (remaining > 0 && totalStock < remaining) {
              showToast(
                `⚠️ Insufficient stock for "${i.medication_name}". Available: ${totalStock}, Required: ${remaining}`
              );
            }

            return {
              prescription_item_id: i.prescription_item_id,
              medication_name: i.medication_name || "—",
              prescribed_qty: i.prescribed_qty,
              already_dispensed: i.already_dispensed || 0,
              stocks: i.stocks || [],
              department_stock_id: i.department_stock_id || null,

              // ✅ still auto-fill
              dispense_now: remaining,

              notes: i.notes || "",
              type: "dispense",
            };
          }) || [];


        renderItemsTable();
      } catch {
        hideLoading();
        showToast("❌ Failed to load prescription items");
      }
    });

  } catch (err) {
    console.error("Dropdown load failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     🧩 Edit Prefill
  ============================================================ */
  if (isEdit && queryId) {
    try {
      showLoading();
      const res = await authFetch(`/api/pharmacy-transactions/${queryId}`);
      const result = await res.json();
      hideLoading();
      const entry = result?.data;
      if (res.ok && entry) {
        orgSelect.value = entry.organization_id || "";
        facSelect.value = entry.facility_id || "";
        deptSelect.value = entry.department_id || "";
        patientInput.dataset.value = entry.patient_id;
        patientInput.value = `${entry.patient?.pat_no || ""} - ${entry.patient?.full_name || ""}`;
        prescriptionSelect.value = entry.prescription_id || "";
        fulfilledByInput.dataset.value = entry.fulfilled_by_id || "";
        fulfilledByInput.value = entry.fulfilled_by
          ? `${entry.fulfilled_by.first_name} ${entry.fulfilled_by.last_name}`
          : "";
        transactionItems =
          entry.items?.map((i) => ({
            prescription_item_id: i.prescription_item_id,
            medication_name: i.medication?.name || i.billableItem?.name || "—",
            prescribed_qty: i.prescribed_qty,
            already_dispensed: i.already_dispensed,
            stocks: i.stocks || [],
            department_stock_id: i.department_stock_id || null,
            dispense_now: i.quantity_dispensed,
            notes: i.notes || "",
            type: i.type || "dispense",
          })) || [];
        renderItemsTable();
      }
    } catch (err) {
      hideLoading();
      showToast("❌ Could not load transaction");
    }
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    if (!transactionItems.some((i) => i.dispense_now > 0))
      return showToast("❌ Enter at least one dispense quantity");

    // 🚫 HARD BLOCK: no partial dispensing allowed
    for (const item of transactionItems) {
      const remaining =
        (item.prescribed_qty || 0) - (item.already_dispensed || 0);

      if (
        item.dispense_now !== 0 &&
        item.dispense_now !== remaining
      ) {
        return showToast(
          `❌ Partial dispensing is not allowed. "${item.medication_name}" must be ${remaining} or 0.`
        );
      }
    }

    const payload = {
      patient_id: normalizeUUID(patientInput.dataset.value),
      prescription_id: normalizeUUID(prescriptionSelect.value),
      organization_id: normalizeUUID(orgSelect?.value || localStorage.getItem("organizationId")),
      facility_id: normalizeUUID(facSelect?.value || localStorage.getItem("facilityId")),
      department_id: normalizeUUID(deptSelect?.value),
      fulfillment_date: document.getElementById("fulfillment_date")?.value || null,
      notes: document.getElementById("notes")?.value || "",
      items: transactionItems
        .filter(i =>
          i.dispense_now > 0 &&
          i.department_stock_id &&
          i.dispense_now <= (i.prescribed_qty - i.already_dispensed)
        )
        .map(i => ({
          prescription_item_id: i.prescription_item_id,
          department_stock_id: i.department_stock_id,
          quantity_dispensed: i.dispense_now,
          type: i.type || "dispense",
          notes: i.notes || "",
        })),
    };

    // ✅ Only super admin can send fulfilled_by_id
    if ((localStorage.getItem("userRole") || "").toLowerCase().includes("super")) {
      payload.fulfilled_by_id = normalizeUUID(fulfilledByInput.dataset.value);
    }


    const errors = validatePharmacyTransactionForm(payload, isEdit);
    if (errors.length) return showToast("❌ " + errors.join("\n"));

    const url = isEdit
      ? `/api/pharmacy-transactions/${queryId}`
      : `/api/pharmacy-transactions`;
    const method = isEdit ? "PUT" : "POST";

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(isEdit ? "✅ Transaction updated" : "✅ Transaction created");

      if (isEdit) {
        // ✅ Edit → redirect
        window.location.href = "/pharmacy-transactions-list.html";
      } else {
        // ✅ Create → reset form (stay on page)
        form.reset();
        transactionItems = [];
        renderItemsTable();

        // reset fulfillment date to today
        const fd = document.getElementById("fulfillment_date");
        if (fd) fd.value = new Date().toISOString().slice(0, 10);

        // clear dynamic values
        patientInput.value = "";
        patientInput.dataset.value = "";
        prescriptionSelect.innerHTML = `<option value="">-- Select Prescription --</option>`;
      }

    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Clear / Cancel
  ============================================================ */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    form.reset();
    transactionItems = [];
    renderItemsTable();
  });
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    window.location.href = "/pharmacy-transactions-list.html";
  });

  initViewToggle();
}

/* ============================================================
   🚀 Boot
============================================================ */
function boot() {
  const form = document.getElementById("pharmacyTransactionForm");
  if (form) setupPharmacyTransactionFormSubmission({ form });
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
