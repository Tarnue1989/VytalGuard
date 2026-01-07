// 📁 consultation-form.js – Secure & Role-Aware Consultation Form (Aligned with Backend Logic)

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

/* ============================================================
   🚀 Setup Consultation Form
============================================================ */
export async function setupConsultationFormSubmission({ form }) {
  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("consultationEditId");
  const queryId = getQueryParam("id");
  const consId = sessionId || queryId;
  const isEdit = !!consId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Consultation");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Consultation`);
    } else {
      titleEl && (titleEl.textContent = "Add Consultation");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Consultation`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* -------------------- DOM Refs -------------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const typeSelect = document.getElementById("consultationTypeSelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");
  const appointmentSelect = document.getElementById("appointmentSelect");

  const doctorInput = document.getElementById("doctorInput");
  const doctorHidden = document.getElementById("doctorId");
  const doctorSuggestions = document.getElementById("doctorSuggestions");
  const doctorFieldGroup = document.getElementById("doctorFieldGroup");

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

    // ✅ Department & Type
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

    const consTypes = await loadBillableItemsLite({ category: "consultation" }, true);
    setupSelectOptions(typeSelect, consTypes, "id", "name", "-- Select Consultation Type --");

    // ✅ Patient suggestions
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (selected) => {
        patientHidden.value = selected?.id || "";
        if (selected) {
          patientInput.value =
            selected.label ||
            (selected.pat_no && selected.full_name
              ? `${selected.pat_no} - ${selected.full_name}`
              : selected.full_name || selected.pat_no || "");

          // load valid appointments
          if (appointmentSelect) {
            appointmentSelect.innerHTML = `<option value="">— Loading... —</option>`;
            try {
              const res = await authFetch(`/api/lite/appointments?patient_id=${selected.id}`);
              const data = await res.json().catch(() => ({}));
              const appts = data?.data?.records || [];
              const validAppts = appts.filter((a) =>
                ["scheduled", "in_progress"].includes((a.status || "").toLowerCase())
              );

              if (!validAppts.length) {
                appointmentSelect.innerHTML = `<option value="">— No valid appointments —</option>`;
              } else {
                appointmentSelect.innerHTML = `<option value="">— Select Appointment —</option>`;
                validAppts.forEach((a) => {
                  const formattedTime = a.date
                    ? new Date(a.date).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  appointmentSelect.innerHTML += `
                    <option value="${a.id}">
                      ${a.code || a.id} — ${formattedTime} (${a.status})
                    </option>`;
                });
              }
            } catch (err) {
              console.error("❌ Appointment load failed:", err);
              appointmentSelect.innerHTML = `<option value="">— Error loading —</option>`;
            }
          }
        }
      },
      "label"
    );

    // ✅ Doctor suggestion (superadmins only)
    if (userRole.includes("super")) {
      doctorFieldGroup?.classList.remove("hidden");
      setupSuggestionInputDynamic(
        doctorInput,
        doctorSuggestions,
        "/api/lite/employees",
        (selected) => {
          doctorHidden.value = selected?.id || "";
          doctorInput.value =
            selected.full_name ||
            `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
        },
        "full_name"
      );
    } else {
      doctorFieldGroup?.classList.add("hidden");
      // for all normal users, backend will assign doctor automatically
      doctorHidden.value = localStorage.getItem("employeeId") || "";
    }
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     ✏️ Prefill if Editing
  ============================================================ */
  if (isEdit && consId) {
    try {
      showLoading();
      const res = await authFetch(`/api/consultations/${consId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load consultation"));
      const entry = result?.data;
      if (!entry) return;

      patientHidden.value = entry.patient_id || "";
      if (entry.patient)
        patientInput.value =
          entry.patient.pat_no && entry.patient.full_name
            ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
            : entry.patient.full_name || entry.patient.pat_no || "";

      if (userRole.includes("super") && entry.doctor)
        doctorInput.value =
          entry.doctor.full_name ||
          `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();

      deptSelect.value = entry.department_id || "";
      typeSelect.value = entry.consultation_type_id || "";
      document.getElementById("consultationDate").value =
        normalizeDate(entry.consultation_date) || "";
      document.getElementById("diagnosis").value = entry.diagnosis || "";
      document.getElementById("consultationNotes").value = entry.consultation_notes || "";
      document.getElementById("prescribedMedications").value =
        entry.prescribed_medications || "";
      if (entry.appointment_id) appointmentSelect.value = entry.appointment_id;
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load consultation");
    }
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    let payload = {
      patient_id: normalizeUUID(patientHidden.value),
      department_id: normalizeUUID(deptSelect?.value),
      consultation_type_id: normalizeUUID(typeSelect?.value),
      consultation_date: normalizeDate(document.getElementById("consultationDate")?.value),
      diagnosis: document.getElementById("diagnosis")?.value || null,
      consultation_notes: document.getElementById("consultationNotes")?.value || null,
      prescribed_medications:
        document.getElementById("prescribedMedications")?.value || null,
      appointment_id: normalizeUUID(appointmentSelect?.value),
    };

    // 🧩 Add doctor_id only for superadmins
    if (userRole.includes("super")) {
      payload.doctor_id = normalizeUUID(doctorHidden.value);
    }

    if (!payload.patient_id) return showToast("❌ Patient is required");

    try {
      showLoading();
      const url = isEdit
        ? `/api/consultations/${consId}`
        : `/api/consultations`;
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
        isEdit ? "✅ Consultation updated successfully" : "✅ Consultation created successfully"
      );

      sessionStorage.removeItem("consultationEditId");
      sessionStorage.removeItem("consultationEditPayload");

      if (isEdit) window.location.href = "/consultations-list.html";
      else {
        form.reset();
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
    sessionStorage.removeItem("consultationEditId");
    sessionStorage.removeItem("consultationEditPayload");
    window.location.href = "/consultations-list.html";
  });
  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("consultationEditId");
    sessionStorage.removeItem("consultationEditPayload");
    form.reset();
    setUI("add");
  });
}
