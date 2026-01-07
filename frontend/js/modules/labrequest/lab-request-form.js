// 📦 labrequest-form.js
// ============================================================
// 🧭 Secure & Role-Aware Lab Request Form (Enterprise-Aligned)
// Master Pattern: Central Stock + EKG (Pill-based, Multi-item, Secure)
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
  loadBillableItemsLite,
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
function validateLabRequestItem(obj) {
  if (!obj.lab_test_id) return showToast("❌ Lab Test is required"), false;
  return true;
}

/* ============================================================
   💊 Pill-Based Item Handling
============================================================ */
let selectedTests = [];
let pillsContainer = null;
let editingIndex = null;

function renderItemPills() {
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  if (!selectedTests.length) {
    pillsContainer.innerHTML = `<p class="text-muted">No lab tests added yet.</p>`;
  } else {
    selectedTests.forEach((test, idx) => {
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.innerHTML = `
        ${test.lab_test_name || "—"}
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
        const test = selectedTests[idx];
        document.getElementById("labTestSearch").dataset.value = test.lab_test_id;
        document.getElementById("labTestSearch").value = test.lab_test_name || "";
        document.getElementById("itemNotes").value = test.notes || "";
        editingIndex = idx;
      });
    });

    pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = btn.dataset.idx;
        selectedTests.splice(idx, 1);
        renderItemPills();
      });
    });
  }

  const submitBtn = document.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML =
      selectedTests.length > 1
        ? `<i class="ri-save-3-line me-1"></i> Submit All`
        : `<i class="ri-save-3-line me-1"></i> Submit`;
  }
}

export function getLabRequestFormState() {
  return { selectedTests, renderItemPills };
}

/* ============================================================
   🚀 Setup Lab Request Form
============================================================ */
export async function setupLabRequestFormSubmission({ form }) {
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const requestId = getQueryParam("id");
  const isEdit = !!requestId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");
  const addItemBtn = document.getElementById("addItemBtn");
  pillsContainer = document.getElementById("requestPillsContainer");
  const requestDateInput = document.getElementById("request_date");

  // 🧭 UI Mode
  if (isEdit) {
    titleEl && (titleEl.textContent = "Edit Lab Request");
    submitBtn && (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Request`);
  } else {
    titleEl && (titleEl.textContent = "Add Lab Request");
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

    // 🔹 Role-based scope (same as EKG)
    if (userRole.includes("super")) {
      // 🏢 Super Admin → can select any org/facility
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
      // 🧑‍💼 Admin → facility only
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      // 👨‍⚕️ Doctor, Nurse, Staff, Facility Head, Org Owner
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // Departments
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

    // Suggestions
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
        input.value = sel?.label || `Consultation ${normalizeDate(sel?.consultation_date) || ""}`;
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
      document.getElementById("labTestSearch"),
      document.getElementById("labTestSearchSuggestions"),
      "/api/lite/billable-items",
      (sel) => {
        const input = document.getElementById("labTestSearch");
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
  if (isEdit && requestId) {
    try {
      showLoading();
      const res = await authFetch(`/api/lab-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (res.ok && result?.data) {
        const entry = result.data;

        if (entry.organization_id)
          document.getElementById("organizationSelect").value = entry.organization_id;
        if (entry.facility_id)
          document.getElementById("facilitySelect").value = entry.facility_id;
        document.getElementById("departmentSelect").value = entry.department_id || "";

        // Patient
        if (entry.patient) {
          const input = document.getElementById("patientSearch");
          input.dataset.value = entry.patient.id;

          const first = entry.patient.first_name || "";
          const last = entry.patient.last_name || "";
          input.value =
            entry.patient.label ||
            (entry.patient.pat_no
              ? `${entry.patient.pat_no} - ${first} ${last}`.trim()
              : `${first} ${last}`.trim());
        }

        // Doctor
        if (entry.doctor) {
          const input = document.getElementById("doctorSearch");
          input.dataset.value = entry.doctor.id;

          const first = entry.doctor.first_name || "";
          const last = entry.doctor.last_name || "";
          input.value =
            entry.doctor.full_name ||
            (first || last ? `Dr. ${first} ${last}`.trim() : "—");
        }

        // Consultation
        if (entry.consultation) {
          const input = document.getElementById("consultationSearch");
          input.dataset.value = entry.consultation.id;
          input.value =
            entry.consultation.label ||
            `Consultation ${normalizeDate(entry.consultation.consultation_date) || ""}`;
        }

        // Registration Log
        if (entry.registrationLog) {
          const input = document.getElementById("registrationLogSearch");
          input.dataset.value = entry.registrationLog.id;
          input.value = entry.registrationLog.label || `RegLog #${entry.registrationLog.id}`;
        }

        document.getElementById("notes").value = entry.notes || "";
        document.getElementById("is_emergency").checked = !!entry.is_emergency;
        document.getElementById("request_date").value = normalizeDate(entry.request_date);

        selectedTests =
          entry.items?.map((i) => ({
            id: i.id,
            lab_test_id: i.lab_test_id,
            lab_test_name: i.labTest?.name || "",
            notes: i.notes || "",
          })) || [];
        renderItemPills();
      }
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast("❌ Could not load lab request");
    }
  } else {
    if (requestDateInput) requestDateInput.value = normalizeDate(new Date());
    renderItemPills();
  }

  /* ============================================================
     ➕ Add / Update Item Pill
  ============================================================ */
  addItemBtn?.addEventListener("click", () => {
    const obj = {
      lab_test_id: document.getElementById("labTestSearch").dataset.value || null,
      lab_test_name: document.getElementById("labTestSearch").value || "",
      notes: document.getElementById("itemNotes").value.trim(),
    };
    if (!validateLabRequestItem(obj)) return;

    if (editingIndex !== null) {
      selectedTests[editingIndex] = obj;
      editingIndex = null;
    } else {
      selectedTests.push(obj);
    }

    document.getElementById("labTestSearch").value = "";
    document.getElementById("labTestSearch").dataset.value = "";
    document.getElementById("itemNotes").value = "";
    renderItemPills();
  });

  /* ============================================================
    💾 Submit (with EKG-style auto-scope)
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
      request_date: document.getElementById("request_date")?.value,
      notes: document.getElementById("notes")?.value?.trim(),
      is_emergency: document.getElementById("is_emergency")?.checked || false,
      items: selectedTests.map((t) => ({
        lab_test_id: t.lab_test_id,
        notes: t.notes || "",
      })),
    };

    // 🧩 Enterprise auto-scope fallback (EKG-style)
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

    // ✅ Validation
    if (!payload.organization_id)
      return showToast("❌ Organization is required (auto-scope missing)");
    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (!payload.items.length) return showToast("❌ Add at least one Lab Test");

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
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(
        isEdit
          ? "✅ Lab Request updated successfully"
          : "✅ Lab Request created successfully"
      );

      if (isEdit) window.location.href = "/lab-requests-list.html";
      else {
        selectedTests = [];
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
  cancelBtn?.addEventListener("click", () => {
    window.location.href = "/lab-requests-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    form.reset();
    selectedTests = [];
    renderItemPills();
  });
}
