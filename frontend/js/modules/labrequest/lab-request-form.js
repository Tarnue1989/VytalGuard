// ============================================================================
// 🧭 Secure & Role-Aware Lab Request Form (ENTERPRISE MASTER PARITY)
// 🔹 MASTER parity with consultation-form.js
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
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function buildPersonName(obj) {
  if (!obj) return "";
  return [obj.first_name, obj.middle_name, obj.last_name]
    .filter(Boolean)
    .join(" ");
}

/* ============================================================
   💊 Pill-Based Item Handling (PRESERVED)
============================================================ */
let selectedTests = [];
let pillsContainer = null;
let editingIndex = null;
let addItemBtn = null;

function validateLabRequestItem(obj) {
  if (!obj.lab_test_id) {
    showToast("❌ Lab Test is required");
    return false;
  }
  return true;
}

function renderItemPills() {
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  if (!selectedTests.length) {
    pillsContainer.innerHTML = `<p class="text-muted">No lab tests added yet.</p>`;
    return;
  }

  selectedTests.forEach((test, idx) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.innerHTML = `
      ${test.lab_test_name || "—"}
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
      const test = selectedTests[idx];

      document.getElementById("labTestSearch").dataset.value =
        test.lab_test_id;
      document.getElementById("labTestSearch").value =
        test.lab_test_name || "";
      document.getElementById("itemNotes").value =
        test.notes || "";

      editingIndex = idx;

      if (addItemBtn) {
        addItemBtn.innerHTML =
          `<i class="ri-save-3-line me-1"></i> Update Test`;
      }
    };
  });

  pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.idx);

      selectedTests.splice(idx, 1);

      if (editingIndex === idx) {
        editingIndex = null;
        if (addItemBtn) {
          addItemBtn.innerHTML =
            `<i class="ri-add-line me-1"></i> Add Test`;
        }
      }

      renderItemPills();
    };
  });
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupLabRequestFormSubmission({
  form,
  sharedState,
}) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const requestId = sharedState?.currentEditIdRef?.value;
  const isEdit = Boolean(requestId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");
  addItemBtn = document.getElementById("addItemBtn");

  pillsContainer = document.getElementById("requestPillsContainer");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Edit Lab Request" : "Add Lab Request";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Lab Request`
          : `<i class="ri-add-line me-1"></i> Save Lab Request`;
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const deptSelect = document.getElementById("departmentSelect");

  const patientInput = document.getElementById("patientSearch");
  const patientSuggestions = document.getElementById("patientSearchSuggestions");

  const doctorInput = document.getElementById("doctorSearch");
  const doctorSuggestions = document.getElementById("doctorSearchSuggestions");

  const consultationInput = document.getElementById("consultationSearch");
  const consultationSuggestions = document.getElementById(
    "consultationSearchSuggestions"
  );

  const regLogInput = document.getElementById("registrationLogSearch");
  const regLogSuggestions = document.getElementById(
    "registrationLogSearchSuggestions"
  );

  const labTestInput = document.getElementById("labTestSearch");
  const labTestSuggestions = document.getElementById(
    "labTestSearchSuggestions"
  );

  const requestDateInput = document.getElementById("request_date");
  const notesInput = document.getElementById("notes");
  const emergencyInput = document.getElementById("is_emergency");

  /* ============================================================
     🌐 Dropdowns & Suggestions (MASTER)
  ============================================================ */
  try {
    setupSelectOptions(
      deptSelect,
      await loadDepartmentsLite({}, true),
      "id",
      "name",
      "-- Select Department --"
    );

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (sel) => {
        patientInput.dataset.value = sel?.id || "";
        patientInput.value =
          sel?.label ||
          `${sel?.pat_no || ""} ${buildPersonName(sel)}`.trim();
      },
      "label"
    );

    setupSuggestionInputDynamic(
      doctorInput,
      doctorSuggestions,
      "/api/lite/employees",
      (sel) => {
        doctorInput.dataset.value = sel?.id || "";
        doctorInput.value = buildPersonName(sel);
      },
      "full_name"
    );

    setupSuggestionInputDynamic(
      consultationInput,
      consultationSuggestions,
      "/api/lite/consultations",
      (sel) => {
        consultationInput.dataset.value = sel?.id || "";
        consultationInput.value =
          sel?.label ||
          `Consultation ${normalizeDate(sel?.consultation_date) || ""}`;
      },
      "label"
    );

    setupSuggestionInputDynamic(
      regLogInput,
      regLogSuggestions,
      "/api/lite/registration-logs",
      (sel) => {
        regLogInput.dataset.value = sel?.id || "";
        regLogInput.value = sel?.label || `RegLog #${sel?.id || ""}`;
      },
      "label"
    );

    setupSuggestionInputDynamic(
      labTestInput,
      labTestSuggestions,
      "/api/lite/billable-items",
      (sel) => {
        labTestInput.dataset.value = sel?.id || "";
        labTestInput.value = sel?.name || "";
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
      const res = await authFetch(`/api/lab-requests/${requestId}`);
      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, "Failed to load lab request")
        );

      const entry = result.data;

      patientInput.dataset.value = entry.patient_id || "";
      patientInput.value = entry.patient
        ? `${entry.patient.pat_no || ""} ${buildPersonName(entry.patient)}`.trim()
        : "";

      deptSelect.value = entry.department_id || "";
      requestDateInput.value = normalizeDate(entry.request_date);
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

      selectedTests =
        entry.items?.map((i) => ({
          id: i.id,
          lab_test_id: i.lab_test_id,
          lab_test_name: i.labTest?.name || "",
          notes: i.notes || "",
        })) || [];

      renderItemPills();
    } catch (err) {
      showToast(err.message || "❌ Could not load lab request");
    } finally {
      hideLoading();
    }
  } else {
    requestDateInput.value = normalizeDate(new Date());
    renderItemPills();
  }

/* ============================================================
   ➕ Add / Update Pill  (FIXED – ID PRESERVED)
============================================================ */
addItemBtn?.addEventListener("click", () => {
  const obj = {
    lab_test_id: normalizeUUID(labTestInput.dataset.value),
    lab_test_name: labTestInput.value || "",
    notes: document.getElementById("itemNotes").value.trim(),
  };

  if (!validateLabRequestItem(obj)) return;

  if (editingIndex !== null) {
    // 🔒 CRITICAL FIX: preserve existing id (and any future flags)
    selectedTests[editingIndex] = {
      ...selectedTests[editingIndex],
      ...obj,
    };
    editingIndex = null;
    addItemBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Test`;
  } else {
    selectedTests.push(obj);
  }

  labTestInput.value = "";
  labTestInput.dataset.value = "";
  document.getElementById("itemNotes").value = "";
  renderItemPills();
});

  /* ============================================================
     💾 SUBMIT — MASTER PARITY (NO TENANT FROM UI)
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

    if (!selectedTests.length) {
      showToast("❌ Add at least one Lab Test");
      return;
    }

    const payload = {
      patient_id: normalizeUUID(patientInput.dataset.value),
      doctor_id: normalizeUUID(doctorInput.dataset.value),
      department_id: normalizeUUID(deptSelect.value),
      consultation_id: normalizeUUID(consultationInput.dataset.value),
      registration_log_id: normalizeUUID(regLogInput.dataset.value),
      request_date: normalizeDate(requestDateInput.value),
      notes: notesInput.value || null,
      is_emergency: !!emergencyInput.checked,
      items: selectedTests.map((t) => ({
        lab_test_id: t.lab_test_id,
        notes: t.notes || "",
      })),
    };

    try {
      showLoading();

      const res = await authFetch(
        isEdit ? `/api/lab-requests/${requestId}` : `/api/lab-requests`,
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
            ? "✅ Lab Request updated"
            : "✅ Lab Request created"
        );

        if (isEdit) {
          // 🔁 Redirect only on edit
          window.location.href = "/lab-requests-list.html";
        } else {
          // 🔒 Stay on page after create (NO REDIRECT)
          form.reset();

          selectedTests = [];
          editingIndex = null;

          renderItemPills();
          setUI("add");

          // Reset suggestion dataset values
          [
            patientInput,
            doctorInput,
            consultationInput,
            regLogInput,
            labTestInput,
          ].forEach((el) => {
            if (el) el.dataset.value = "";
          });

          // Reset date to today
          requestDateInput.value = normalizeDate(new Date());
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
    window.location.href = "/lab-requests-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    selectedTests = [];
    renderItemPills();
    setUI("add");
    editingIndex = null;
    addItemBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Test`;
  });
}
