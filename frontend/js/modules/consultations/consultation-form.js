// 📁 consultation-form.js – Secure & Role-Aware Consultation Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 FULL parity with deposit-form.js MASTER
// 🔹 Rule-driven validation (CONSULTATION_FORM_RULES)
// 🔹 Role-aware org/fac handling (SUPER / ORG ADMIN / FACILITY)
// 🔹 Clean payload normalization (UUID | null | date)
// 🔹 Controller-faithful (no HTML validation, no silent rules)
// 🔹 Preserves ALL existing DOM IDs, API calls, and wiring
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import {
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { CONSULTATION_FORM_RULES } from "./consultation.form.rules.js";

/* ============================================================
   🧩 Helpers (MASTER)
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
   🚀 Main Setup
============================================================ */
export async function setupConsultationFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const consId =
    sessionStorage.getItem("consultationEditId") || getQueryParam("id");
  const isEdit = Boolean(consId);

  /* ============================================================
     🎨 UI Mode
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Edit Consultation" : "Add Consultation";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Consultation`
          : `<i class="ri-add-line me-1"></i> Add Consultation`;
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const typeSelect = document.getElementById("consultationTypeSelect");
  const appointmentSelect = document.getElementById("appointmentSelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const doctorInput = document.getElementById("doctorInput");
  const doctorHidden = document.getElementById("doctorId");
  const doctorSuggestions = document.getElementById("doctorSuggestions");
  const doctorFieldGroup = document.getElementById("doctorFieldGroup");

  const dateInput = document.getElementById("consultationDate");
  const diagnosisInput = document.getElementById("diagnosis");
  const notesInput = document.getElementById("consultationNotes");
  const medsInput = document.getElementById("prescribedMedications");

  /* ============================================================
     👥 Role
  ============================================================ */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";
  const isOrgAdmin = userRole === "organization_admin";

  /* ============================================================
     🌐 Dropdowns & Suggestions (MASTER)
  ============================================================ */
  try {
    if (isSuper) {
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
      );

      const reloadFacilities = async (orgId = null) => {
        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite(
            orgId ? { organization_id: orgId } : {},
            true
          ),
          "id",
          "name",
          "-- Select Facility --"
        );
      };

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
      } else {
        // Org Admin, Facility Head, Staff
        orgSelect?.closest(".form-group")?.classList.add("hidden");
        facSelect?.closest(".form-group")?.classList.add("hidden");
      }


    setupSelectOptions(
      deptSelect,
      await loadDepartmentsLite({}, true),
      "id",
      "name",
      "-- Select Department --"
    );

    setupSelectOptions(
      typeSelect,
      await loadBillableItemsLite({ category: "consultation" }, true),
      "id",
      "name",
      "-- Select Consultation Type --"
    );

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value =
          selected?.label ||
          `${selected?.pat_no || ""} ${buildPersonName(selected)}`.trim();

        if (appointmentSelect && selected?.id) {
          appointmentSelect.innerHTML = `<option value="">— Loading... —</option>`;
          try {
            const res = await authFetch(
              `/api/lite/appointments?patient_id=${selected.id}`
            );
            const data = await res.json().catch(() => ({}));
            const appts = data?.data?.records || [];
            const valid = appts.filter((a) =>
              ["scheduled", "in_progress"].includes(
                (a.status || "").toLowerCase()
              )
            );

            appointmentSelect.innerHTML = valid.length
              ? `<option value="">— Select Appointment —</option>`
              : `<option value="">— No valid appointments —</option>`;

            valid.forEach((a) => {
              appointmentSelect.innerHTML += `
                <option value="${a.id}">
                  ${a.code || a.id} (${a.status})
                </option>`;
            });
          } catch {
            appointmentSelect.innerHTML = `<option value="">— Error loading —</option>`;
          }
        }
      },
      "label"
    );

    if (isSuper) {
      doctorFieldGroup?.classList.remove("hidden");
      setupSuggestionInputDynamic(
        doctorInput,
        doctorSuggestions,
        "/api/lite/employees",
        (selected) => {
          doctorHidden.value = selected?.id || "";
          doctorInput.value = buildPersonName(selected);
        },
        "full_name"
      );
    } else {
      doctorFieldGroup?.classList.add("hidden");
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit && consId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("consultationEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/consultations/${consId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            normalizeMessage(result, "Failed to load consultation")
          );
        entry = result?.data;
      }

      if (!entry) return;

      patientHidden.value = entry.patient_id || "";
      patientInput.value = entry.patient
        ? `${entry.patient.pat_no || ""} ${buildPersonName(entry.patient)}`.trim()
        : "";

      if (isSuper) {
        if (orgSelect && entry.organization_id)
          orgSelect.value = entry.organization_id;
        if (facSelect && entry.facility_id)
          facSelect.value = entry.facility_id;
      }

      deptSelect.value = entry.department_id || "";
      typeSelect.value = entry.consultation_type_id || "";
      dateInput.value = normalizeDate(entry.consultation_date) || "";
      diagnosisInput.value = entry.diagnosis || "";
      notesInput.value = entry.consultation_notes || "";
      medsInput.value = entry.prescribed_medications || "";

      if (isSuper && entry.doctor) {
        doctorHidden.value = entry.doctor.id || "";
        doctorInput.value = buildPersonName(entry.doctor);
      }

      if (appointmentSelect && entry.patient_id) {
        appointmentSelect.innerHTML = `<option value="">— Loading... —</option>`;
        try {
          const resA = await authFetch(
            `/api/lite/appointments?patient_id=${entry.patient_id}`
          );
          const dataA = await resA.json().catch(() => ({}));
          const appts = dataA?.data?.records || [];
          const valid = appts.filter((a) =>
            ["scheduled", "in_progress"].includes(
              (a.status || "").toLowerCase()
            )
          );

          appointmentSelect.innerHTML = valid.length
            ? `<option value="">— Select Appointment —</option>`
            : `<option value="">— No valid appointments —</option>`;

          valid.forEach((a) => {
            appointmentSelect.innerHTML += `
              <option value="${a.id}">
                ${a.code || a.id} (${a.status})
              </option>`;
          });

          appointmentSelect.value = entry.appointment_id || "";
        } catch {
          appointmentSelect.innerHTML = `<option value="">— Error loading —</option>`;
        }
      }

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load consultation");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT — RULE-DRIVEN (MASTER PARITY)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of CONSULTATION_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el) continue;
      if (el.closest(".hidden")) continue;

      if (!el.value || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      patient_id: normalizeUUID(patientHidden.value),
      department_id: normalizeUUID(deptSelect.value),
      consultation_type_id: normalizeUUID(typeSelect.value),
      appointment_id: normalizeUUID(appointmentSelect.value),
      consultation_date: normalizeDate(dateInput.value),
      diagnosis: diagnosisInput.value || null,
      consultation_notes: notesInput.value || null,
      prescribed_medications: medsInput.value || null,
    };

    if (isSuper) {
      payload.doctor_id = normalizeUUID(doctorHidden.value);
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

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
      if (!res.ok) {
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );
      }

      showToast(
        isEdit ? "✅ Consultation updated" : "✅ Consultation created"
      );

      /* ================= POST-ACTION FLOW (FIXED) ================= */
      sessionStorage.removeItem("consultationEditId");
      sessionStorage.removeItem("consultationEditPayload");

      if (isEdit) {
        // ✅ EDIT → redirect
        window.location.href = "/consultations-list.html";
      } else {
        // ✅ CREATE → stay on form
        clearFormErrors(form);
        form.reset();
        setUI("add");
      }
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     ⏮️ CANCEL / CLEAR
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/consultations-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI("add");
  });
}
