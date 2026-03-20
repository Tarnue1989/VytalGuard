// 📦 prescription-form.js – Secure & Role-Aware Prescription Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 MASTER parity with lab-request-form.js
// 🔹 Pill-based multi-item handling (PRESERVED)
// 🔹 Rule-driven validation
// 🔹 Controller-faithful (NO org/fac submission)
// 🔹 Clean payload normalization
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
   🔧 HELPERS (MASTER)
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
   💊 Pill-Based Item Handling (MASTER PARITY)
============================================================ */
let selectedItems = [];
let pillsContainer = null;
let editingIndex = null;
let addItemBtn = null;

function validatePrescriptionItem(obj) {
  if (!obj.billable_item_id) {
    showToast("❌ Medication is required");
    return false;
  }
  return true;
}

function renderItemPills() {
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  if (!selectedItems.length) {
    pillsContainer.innerHTML = `<p class="text-muted">No prescription items added yet.</p>`;
    return;
  }

  selectedItems.forEach((item, idx) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `
      ${item.medication_name || "—"}
      ${item.dosage ? `– ${item.dosage}` : ""}
      ${item.route ? `– ${item.route}` : ""}
      ${item.duration ? `– ${item.duration}` : ""}
      ${item.quantity ? `– Qty: ${item.quantity}` : ""}
      <button type="button" class="btn btn-sm btn-link pill-edit" data-idx="${idx}">
        <i class="ri-pencil-line"></i>
      </button>
      <button type="button" class="btn btn-sm btn-link text-danger pill-remove" data-idx="${idx}">
        <i class="ri-close-line"></i>
      </button>
    `;
    pillsContainer.appendChild(pill);
  });

  pillsContainer.querySelectorAll(".pill-edit").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);
      const item = selectedItems[idx];

      document.getElementById("medicationSearch").dataset.value =
        item.billable_item_id;
      document.getElementById("medicationSearch").value =
        item.medication_name || "";
      document.getElementById("dosage").value = item.dosage || "";
      document.getElementById("route").value = item.route || "";
      document.getElementById("duration").value = item.duration || "";
      document.getElementById("quantity").value = item.quantity || "";
      document.getElementById("instructions").value =
        item.instructions || "";
      document.getElementById("itemNotes").value = item.notes || "";

      editingIndex = idx;

      if (addItemBtn) {
        addItemBtn.innerHTML =
          `<i class="ri-save-3-line me-1"></i> Update Medication`;
      }
    };
  });

  pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);

      selectedItems.splice(idx, 1);

      if (editingIndex === idx) {
        editingIndex = null;
        if (addItemBtn) {
          addItemBtn.innerHTML =
            `<i class="ri-add-line me-1"></i> Add Medication`;
        }
      }

      renderItemPills();
    };
  });
}

/* ============================================================
   🚀 Main Setup (MASTER)
============================================================ */
export async function setupPrescriptionFormSubmission({
  form,
  sharedState,
}) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const prescriptionId = sharedState?.currentEditIdRef?.value;
  const isEdit = Boolean(prescriptionId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");
  addItemBtn = document.getElementById("addItemBtn");

  pillsContainer = document.getElementById("prescriptionPillsContainer");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Edit Prescription" : "Add Prescription";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Prescription`
          : `<i class="ri-add-line me-1"></i> Save Prescription`;
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const deptSelect = document.getElementById("departmentSelect");

  const patientInput = document.getElementById("patientSearch");
  const patientSuggestions = document.getElementById(
    "patientSearchSuggestions"
  );

  const doctorInput = document.getElementById("doctorSearch");
  const doctorSuggestions = document.getElementById(
    "doctorSearchSuggestions"
  );

  const consultationInput = document.getElementById(
    "consultationSearch"
  );
  const consultationSuggestions = document.getElementById(
    "consultationSearchSuggestions"
  );

  const regLogInput = document.getElementById(
    "registrationLogSearch"
  );
  const regLogSuggestions = document.getElementById(
    "registrationLogSearchSuggestions"
  );

  const medInput = document.getElementById("medicationSearch");
  const medSuggestions = document.getElementById(
    "medicationSearchSuggestions"
  );

  const prescriptionDateInput = document.getElementById(
    "prescription_date"
  );
  const notesInput = document.getElementById("notes");
  const emergencyInput = document.getElementById("is_emergency");

  /* ============================================================
    🌐 Dropdowns & Suggestions (MASTER FIXED)
  ============================================================ */
  try {
    setupSelectOptions(
      deptSelect,
      await loadDepartmentsLite({}, true),
      "id",
      "name",
      "-- Select Department --"
    );

    // ================= PATIENT =================
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (sel) => {
        patientInput.dataset.value = sel?.id || "";
        document.getElementById("patientId").value = sel?.id || ""; // ✅ FIX

        patientInput.value =
          sel?.label ||
          `${sel?.pat_no || ""} ${buildPersonName(sel)}`.trim();
      },
      "label"
    );

    // ================= DOCTOR =================
    setupSuggestionInputDynamic(
      doctorInput,
      doctorSuggestions,
      "/api/lite/employees",
      (sel) => {
        doctorInput.dataset.value = sel?.id || "";
        document.getElementById("doctorId").value = sel?.id || ""; // ✅ FIX

        doctorInput.value = buildPersonName(sel);
      },
      "full_name"
    );

    // ================= CONSULTATION =================
    setupSuggestionInputDynamic(
      consultationInput,
      consultationSuggestions,
      "/api/lite/consultations",
      (sel) => {
        consultationInput.dataset.value = sel?.id || "";
        document.getElementById("consultationId").value = sel?.id || ""; // ✅ FIX

        consultationInput.value =
          sel?.label ||
          `Consultation ${normalizeDate(sel?.consultation_date) || ""}`;
      },
      "label"
    );

    // ================= REG LOG =================
    setupSuggestionInputDynamic(
      regLogInput,
      regLogSuggestions,
      "/api/lite/registration-logs",
      (sel) => {
        regLogInput.dataset.value = sel?.id || "";
        document.getElementById("registrationLogId").value = sel?.id || ""; // ✅ FIX

        regLogInput.value =
          sel?.label || `RegLog #${sel?.id || ""}`;
      },
      "label"
    );

    // ================= MEDICATION (CRITICAL FIX) =================
    setupSuggestionInputDynamic(
      medInput,
      medSuggestions,
      "/api/lite/billable-items?category=medication", // ✅ FIXED ENDPOINT
      (sel) => {
        medInput.dataset.value = sel?.id || "";
        document.getElementById("medicationId").value = sel?.id || ""; // ✅ FIX

        medInput.value = sel?.name || "";
      },
      "name"
    );

  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ Prefill (EDIT MODE)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();
      const res = await authFetch(
        `/api/prescriptions/${prescriptionId}`
      );
      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, "Failed to load prescription")
        );

      const entry = result.data;

      patientInput.dataset.value = entry.patient_id || "";
      patientInput.value = entry.patient
        ? `${entry.patient.pat_no || ""} ${buildPersonName(
            entry.patient
          )}`.trim()
        : "";

      deptSelect.value = entry.department_id || "";
      prescriptionDateInput.value = normalizeDate(
        entry.prescription_date
      );
      notesInput.value = entry.notes || "";
      emergencyInput.checked = !!entry.is_emergency;

      if (entry.doctor) {
        doctorInput.dataset.value = entry.doctor.id;
        doctorInput.value = buildPersonName(entry.doctor);
      }

      if (entry.consultation) {
        consultationInput.dataset.value = entry.consultation.id;
        consultationInput.value =
          entry.consultation.label ||
          `Consultation ${normalizeDate(
            entry.consultation.consultation_date
          )}`;
      }

      if (entry.registrationLog) {
        regLogInput.dataset.value = entry.registrationLog.id;
        regLogInput.value =
          entry.registrationLog.label ||
          `RegLog #${entry.registrationLog.id}`;
      }

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
    } catch (err) {
      showToast(err.message || "❌ Could not load prescription");
    } finally {
      hideLoading();
    }
  } else {
    prescriptionDateInput.value =
      new Date().toISOString().split("T")[0];
    renderItemPills();
  }

  /* ============================================================
     ➕ Add / Update Pill (MASTER FIXED)
  ============================================================ */
  addItemBtn?.addEventListener("click", () => {
    const obj = {
      billable_item_id: normalizeUUID(medInput.dataset.value),
      medication_name: medInput.value || "",
      dosage: document.getElementById("dosage").value.trim(),
      route: document.getElementById("route").value.trim(),
      duration: document.getElementById("duration").value.trim(),
      quantity: document.getElementById("quantity").value.trim(),
      instructions:
        document.getElementById("instructions").value.trim(),
      notes: document.getElementById("itemNotes").value.trim(),
    };

    if (!validatePrescriptionItem(obj)) return;

    if (editingIndex !== null) {
      selectedItems[editingIndex] = {
        ...selectedItems[editingIndex],
        ...obj,
      };
      editingIndex = null;
      addItemBtn.innerHTML =
        `<i class="ri-add-line me-1"></i> Add Medication`;
    } else {
      selectedItems.push(obj);
    }

    medInput.value = "";
    medInput.dataset.value = "";
    ["dosage", "route", "duration", "quantity", "instructions", "itemNotes"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      }
    );

    renderItemPills();
  });

  /* ============================================================
     💾 SUBMIT — MASTER PARITY
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    if (!normalizeUUID(patientInput.dataset.value)) {
      applyServerErrors(form, [
        { field: "patientSearch", message: "Patient is required" },
      ]);
      return;
    }

    if (!selectedItems.length) {
      showToast("❌ Add at least one Medication");
      return;
    }

    const payload = {
      patient_id: normalizeUUID(patientInput.dataset.value),
      doctor_id: normalizeUUID(doctorInput.dataset.value),
      department_id: normalizeUUID(deptSelect.value),
      consultation_id: normalizeUUID(
        consultationInput.dataset.value
      ),
      registration_log_id: normalizeUUID(
        regLogInput.dataset.value
      ),
      prescription_date: prescriptionDateInput.value,
      notes: notesInput.value || null,
      is_emergency: !!emergencyInput.checked,
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

    try {
      showLoading();

      const res = await authFetch(
        isEdit
          ? `/api/prescriptions/${prescriptionId}`
          : `/api/prescriptions`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      showToast(
        isEdit
          ? "✅ Prescription updated"
          : "✅ Prescription created"
      );

      if (isEdit) {
        window.location.href = "/prescriptions-list.html";
      } else {
        form.reset();

        selectedItems = [];
        editingIndex = null;

        renderItemPills();
        setUI("add");

        [
          patientInput,
          doctorInput,
          consultationInput,
          regLogInput,
          medInput,
        ].forEach((el) => {
          if (el) el.dataset.value = "";
        });

        prescriptionDateInput.value =
          new Date().toISOString().split("T")[0];
      }
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    window.location.href = "/prescriptions-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    selectedItems = [];
    renderItemPills();
    setUI("add");
    editingIndex = null;
    addItemBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Medication`;
  });
}