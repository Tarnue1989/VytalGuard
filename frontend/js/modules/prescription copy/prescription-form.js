// 📦 prescription-form.js – Secure & Role-Aware Prescription Form (Enterprise-Aligned)
// ============================================================
// Master Pattern: Lab Request (Central Stock + EKG Pill Style)
// ============================================================

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
function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
}
function validatePrescriptionItem(obj) {
  if (!obj.billable_item_id) return showToast("❌ Medication is required"), false;
  return true;
}

/* ============================================================
   💊 Pill-Based Item Handling
============================================================ */
let selectedItems = [];
let pillsContainer = null;
let editingIndex = null;

function renderItemPills() {
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  if (!selectedItems.length) {
    pillsContainer.innerHTML = `<p class="text-muted">No prescription items added yet.</p>`;
  } else {
    selectedItems.forEach((item, idx) => {
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.innerHTML = `
        ${item.medication_name || "—"}
        ${item.dosage ? `– ${item.dosage}` : ""}
        ${item.route ? `– ${item.route}` : ""}
        ${item.duration ? `– ${item.duration}` : ""}
        ${item.quantity ? `– Qty: ${item.quantity}` : ""}
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
        const idx = parseInt(btn.dataset.idx);
        const item = selectedItems[idx];
        if (!item) return;

        // Fill fields
        document.getElementById("medicationSearch").dataset.value = item.billable_item_id;
        document.getElementById("medicationSearch").value = item.medication_name || "";
        document.getElementById("dosage").value = item.dosage || "";
        document.getElementById("route").value = item.route || "";
        document.getElementById("duration").value = item.duration || "";
        document.getElementById("quantity").value = item.quantity || "";
        document.getElementById("instructions").value = item.instructions || "";
        document.getElementById("itemNotes").value = item.notes || "";

        editingIndex = idx;

        // Change Add button label → Update
        const addItemBtn = document.getElementById("addItemBtn");
        if (addItemBtn)
          addItemBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Medication`;

        // Temporarily remove from list (so it can be re-added clean)
        selectedItems.splice(idx, 1);
        renderItemPills();
      });
    });

    pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        selectedItems.splice(idx, 1);
        renderItemPills();
      });
    });
  }

  // Update submit button text
  const submitBtn = document.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML =
      selectedItems.length > 1
        ? `<i class="ri-save-3-line me-1"></i> Submit All`
        : `<i class="ri-save-3-line me-1"></i> Submit`;
  }
}

export function getPrescriptionFormState() {
  return { selectedItems, renderItemPills };
}

/* ============================================================
   🚀 Setup Prescription Form
============================================================ */
export async function setupPrescriptionFormSubmission({ form }) {
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const prescriptionId = getQueryParam("id");
  const isEdit = !!prescriptionId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");
  const addItemBtn = document.getElementById("addItemBtn");
  pillsContainer = document.getElementById("prescriptionPillsContainer");
  const prescriptionDateInput = document.getElementById("prescription_date");

  // 🧭 UI Mode
  if (isEdit) {
    titleEl && (titleEl.textContent = "Edit Prescription");
    submitBtn && (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Prescription`);
  } else {
    titleEl && (titleEl.textContent = "Add Prescription");
    submitBtn && (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit All`);
  }

  /* ============================================================
     🏢 Role-Aware Dropdowns & Suggestions
  ============================================================ */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
    const orgSelect = document.getElementById("organizationSelect");
    const facSelect = document.getElementById("facilitySelect");
    const deptSelect = document.getElementById("departmentSelect");

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
      orgSelect?.closest(".col-md-3")?.classList.add("d-none");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".col-md-3")?.classList.add("d-none");
      facSelect?.closest(".col-md-3")?.classList.add("d-none");
    }

    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

    // 🔹 Suggestions
    setupSuggestionInputDynamic(
      document.getElementById("patientSearch"),
      document.getElementById("patientSearchSuggestions"),
      "/api/lite/patients",
      (sel) => {
        const input = document.getElementById("patientSearch");
        input.dataset.value = sel?.id || "";
        input.value = sel?.label || sel?.full_name || "";
      },
      "label"
    );
    setupSuggestionInputDynamic(
      document.getElementById("doctorSearch"),
      document.getElementById("doctorSearchSuggestions"),
      "/api/lite/employees",
      (sel) => {
        const input = document.getElementById("doctorSearch");
        input.dataset.value = sel?.id || "";
        input.value = sel?.label || sel?.full_name || "";
      },
      "label"
    );
    setupSuggestionInputDynamic(
      document.getElementById("consultationSearch"),
      document.getElementById("consultationSearchSuggestions"),
      "/api/lite/consultations",
      (sel) => {
        const input = document.getElementById("consultationSearch");
        input.dataset.value = sel?.id || "";
        input.value =
          sel?.label || `Consultation ${normalizeDate(sel?.consultation_date) || ""}`;
      },
      "label"
    );
    setupSuggestionInputDynamic(
      document.getElementById("registrationLogSearch"),
      document.getElementById("registrationLogSearchSuggestions"),
      "/api/lite/registration-logs",
      (sel) => {
        const input = document.getElementById("registrationLogSearch");
        input.dataset.value = sel?.id || "";
        input.value = sel?.label || `RegLog #${sel?.id || ""}`;
      },
      "label"
    );
    setupSuggestionInputDynamic(
      document.getElementById("medicationSearch"),
      document.getElementById("medicationSearchSuggestions"),
      "/api/lite/billable-items?category=medication",
      (sel) => {
        const input = document.getElementById("medicationSearch");
        input.dataset.value = sel?.id || "";
        input.value = sel?.name || "";
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
  if (isEdit && prescriptionId) {
    try {
      showLoading();
      const res = await authFetch(`/api/prescriptions/${prescriptionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (res.ok && result?.data) {
        const entry = result.data;
        document.getElementById("organizationSelect").value = entry.organization_id || "";
        document.getElementById("facilitySelect").value = entry.facility_id || "";
        document.getElementById("departmentSelect").value = entry.department_id || "";
        if (entry.patient) {
          const input = document.getElementById("patientSearch");
          input.dataset.value = entry.patient.id;
          input.value =
            entry.patient.label ||
            `${entry.patient.pat_no || ""} - ${entry.patient.full_name || ""}`;
        }
        if (entry.doctor) {
          const input = document.getElementById("doctorSearch");
          input.dataset.value = entry.doctor.id;
          input.value = entry.doctor.full_name || "";
        }
        if (entry.consultation) {
          const input = document.getElementById("consultationSearch");
          input.dataset.value = entry.consultation.id;
          input.value =
            entry.consultation.label ||
            `Consultation ${normalizeDate(entry.consultation.consultation_date)}`;
        }
        if (entry.registrationLog) {
          const input = document.getElementById("registrationLogSearch");
          input.dataset.value = entry.registrationLog.id;
          input.value = entry.registrationLog.label || `RegLog #${entry.registrationLog.id}`;
        }
        document.getElementById("notes").value = entry.notes || "";
        document.getElementById("is_emergency").checked = !!entry.is_emergency;
        document.getElementById("prescription_date").value = normalizeDate(entry.prescription_date);
        selectedItems =
          entry.items?.map((i) => ({
            id: i.id,
            billable_item_id: i.billable_item_id,
            medication_name: i.billableItem?.name || "",
            dosage: i.dosage || "",
            route: i.route || "",
            duration: i.duration || "",
            quantity: i.quantity || "",
            instructions: i.instructions || "",
            notes: i.notes || "",
          })) || [];
        renderItemPills();
      }
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast("❌ Could not load prescription");
    }
  } else {
    if (prescriptionDateInput) prescriptionDateInput.value = normalizeDate(new Date());
    renderItemPills();
  }

  /* ============================================================
     ➕ Add / Update Item Pill (Smart Mode)
  ============================================================ */
  addItemBtn?.addEventListener("click", () => {
    const medInput = document.getElementById("medicationSearch");
    const billableId = medInput.dataset.value || null;
    const medName = medInput.value.trim();
    const obj = {
      billable_item_id: billableId,
      medication_name: medName,
      dosage: document.getElementById("dosage").value.trim(),
      route: document.getElementById("route").value.trim(),
      duration: document.getElementById("duration").value.trim(),
      quantity: document.getElementById("quantity").value.trim(),
      instructions: document.getElementById("instructions").value.trim(),
      notes: document.getElementById("itemNotes").value.trim(),
    };
    if (!validatePrescriptionItem(obj)) return;

    const duplicate = selectedItems.find(
      (i) => i.billable_item_id === obj.billable_item_id
    );
    if (duplicate) return showToast("⚠️ Medication already in list");

    selectedItems.push(obj);
    ["medicationSearch", "dosage", "route", "duration", "quantity", "instructions", "itemNotes"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = "";
        if (id === "medicationSearch") el.dataset.value = "";
      }
    );
    const addItemBtn = document.getElementById("addItemBtn");
    if (addItemBtn)
      addItemBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Medication`;
    renderItemPills();
  });

  /* ============================================================
    💾 Submit
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;
    const payload = {
      organization_id: normalizeUUID(document.getElementById("organizationSelect")?.value),
      facility_id: normalizeUUID(document.getElementById("facilitySelect")?.value),
      patient_id: normalizeUUID(document.getElementById("patientSearch")?.dataset?.value),
      doctor_id: normalizeUUID(document.getElementById("doctorSearch")?.dataset?.value),
      department_id: normalizeUUID(document.getElementById("departmentSelect")?.value),
      consultation_id: normalizeUUID(document.getElementById("consultationSearch")?.dataset?.value),
      registration_log_id: normalizeUUID(document.getElementById("registrationLogSearch")?.dataset?.value),
      prescription_date: document.getElementById("prescription_date")?.value,
      notes: document.getElementById("notes")?.value?.trim(),
      is_emergency: document.getElementById("is_emergency")?.checked || false,
      items: selectedItems.map((t) => ({
        billable_item_id: t.billable_item_id,
        dosage: t.dosage,
        route: t.route,
        duration: t.duration,
        quantity: t.quantity,
        instructions: t.instructions,
        notes: t.notes,
      })),
    };
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    payload.organization_id =
      payload.organization_id ||
      currentUser.organization_id ||
      localStorage.getItem("organizationId") ||
      null;
    payload.facility_id =
      payload.facility_id ||
      currentUser.facility_id ||
      localStorage.getItem("facilityId") ||
      null;
    if (!payload.organization_id)
      return showToast("❌ Organization is required (auto-scope missing)");
    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (!payload.items.length) return showToast("❌ Add at least one Medication");

    try {
      showLoading();
      const res = await authFetch(
        isEdit ? `/api/prescriptions/${prescriptionId}` : `/api/prescriptions`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(isEdit ? "✅ Prescription updated successfully" : "✅ Prescription created successfully");

      if (isEdit) window.location.href = "/prescriptions-list.html";
      else {
        selectedItems = [];
        form.reset();
        renderItemPills();
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  cancelBtn?.addEventListener("click", () => (window.location.href = "/prescriptions-list.html"));
  clearBtn?.addEventListener("click", () => {
    form.reset();
    selectedItems = [];
    renderItemPills();
  });
}
