// 📦 patient-form.js – Secure & Role-Aware Patient Form (ENTERPRISE MASTER)
// ============================================================================
// 🔹 Rule-driven validation (PATIENT_FORM_RULES)
// 🔹 Role-aware org/fac handling (NO hidden facility for staff)
// 🔹 Emergency JSONB hydration + submit
// 🔹 Safe file upload + removal flags
// 🔹 Controller-faithful (no silent validation)
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
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { setupFilePreview } from "../../utils/file-preview.js";
import { PATIENT_FORM_RULES } from "./patient.form.rules.js";

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
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

function normalizeDate(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupPatientFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const patId =
    sessionStorage.getItem("patientEditId") || getQueryParam("id");
  const isEdit = Boolean(patId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  const setFormTitle = (txt, icon) => {
    if (titleEl) titleEl.textContent = txt;
    if (submitBtn)
      submitBtn.innerHTML = `<i class="${icon} me-1"></i> ${txt}`;
  };

  setFormTitle(isEdit ? "Update Patient" : "Add Patient", "ri-save-3-line");

  /* ---------------- DOM Refs ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  /* ============================================================
     🔐 ROLE-AWARE ORG / FAC (MASTER-ALIGNED)
     ✔ Facility is NEVER hidden
  ============================================================ */
  try {
    const hideOrg = () =>
      orgSelect?.closest(".form-group")?.classList.add("hidden");

    if (userRole.includes("super")) {
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
    } else if (userRole.includes("admin")) {
      hideOrg();
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );
    } else {
      // STAFF / DOCTOR / NURSE
      hideOrg();
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load organization/facility data");
  }

  /* ============================================================
     📎 FILE PREVIEW
  ============================================================ */
  setupFilePreview(
    "photoInput",
    "photoPreview",
    "removePhotoBtn",
    "photo_path"
  );

  /* ============================================================
    ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      let entry = JSON.parse(
        sessionStorage.getItem("patientEditPayload") || "null"
      );

      if (!entry) {
        const res = await authFetch(`/api/patients/${patId}`);
        const json = await res.json();
        entry = json?.data;
      }

      if (!entry) throw new Error("Patient not found");

      /* ---------------- BASIC FIELDS ---------------- */
      [
        "first_name",
        "middle_name",
        "last_name",
        "gender",
        "phone_number",
        "email_address",
        "home_address",
        "marital_status",
        "religion",
        "profession",
        "national_id",
        "insurance_number",
        "passport_number",
        "notes",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = entry[id] || "";
      });

      const dobEl = document.getElementById("date_of_birth");
      if (dobEl) dobEl.value = normalizeDate(entry.date_of_birth);

      /* ---------------- ORG / FAC PREFILL (FIX) ---------------- */
      if (entry.organization_id && orgSelect) {
        orgSelect.value = entry.organization_id;

        // Super admin: reload facilities BEFORE setting facility
        if (userRole.includes("super")) {
          const facilities = await loadFacilitiesLite(
            { organization_id: entry.organization_id },
            true
          );

          setupSelectOptions(
            facSelect,
            facilities,
            "id",
            "name",
            "-- Select Facility --"
          );
        }
      }

      if (entry.facility_id && facSelect) {
        facSelect.value = entry.facility_id;
      }

      /* ---------------- EMERGENCY JSONB ---------------- */
      const ecName = document.getElementById("emergency_contact_name");
      const ecPhone = document.getElementById("emergency_contact_phone");

      if (Array.isArray(entry.emergency_contacts) && entry.emergency_contacts[0]) {
        ecName.value = entry.emergency_contacts[0]?.name || "";
        ecPhone.value = entry.emergency_contacts[0]?.phone || "";
      }

      /* ---------------- PHOTO ---------------- */
      if (entry.photo_path) {
        document.getElementById("photoPreview").innerHTML =
          `<img src="${entry.photo_path}" class="preview-img" />`;
        document.getElementById("removePhotoBtn")?.classList.remove("hidden");
        document.getElementById("remove_photo").value = "false";
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to load patient");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT — RULE-DRIVEN (MASTER)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of PATIENT_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || !el.value || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const method = isEdit ? "PUT" : "POST";
    const url = isEdit ? `/api/patients/${patId}` : `/api/patients`;
    const formData = new FormData(form);

    // Emergency JSONB packaging
    const ecName = formData.get("emergency_contact_name");
    const ecPhone = formData.get("emergency_contact_phone");

    formData.delete("emergency_contact_name");
    formData.delete("emergency_contact_phone");

    if (ecName || ecPhone) {
      formData.append(
        "emergency_contacts",
        JSON.stringify([{ name: ecName || "", phone: ecPhone || "" }])
      );
    }

    // Tenant scope safety
    if (!userRole.includes("super")) formData.delete("organization_id");
    if (!userRole.includes("super") && !userRole.includes("admin")) {
      formData.delete("organization_id");
    }

    if (!formData.has("remove_photo"))
      formData.append("remove_photo", "false");
    if (!formData.has("remove_qr_code"))
      formData.append("remove_qr_code", "false");

    try {
      showLoading();
      const res = await authFetch(url, { method, body: formData });
      const result = await res.json();

      if (!res.ok) {
        applyServerErrors(form, result?.errors);
        throw new Error(normalizeMessage(result, "Submission failed"));
      }

      showToast(isEdit ? "✅ Patient updated" : "✅ Patient created");
      sessionStorage.clear();
      window.location.href = "/patients-list.html";
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     ⏮️ CANCEL / CLEAR
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/patients-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setFormTitle("Add Patient", "ri-save-3-line");
  });
}
