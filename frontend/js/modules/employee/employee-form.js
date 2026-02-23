// 📦 employee-form.js – Secure & Role-Aware Employee Form (ENTERPRISE MASTER)
// ============================================================================
// 🔹 Rule-driven validation (EMPLOYEE_FORM_RULES)
// 🔹 Role-aware org/fac handling (Facility NEVER hidden – MASTER parity)
// 🔹 Safe file upload + removal flags
// 🔹 Controller-faithful (no silent validation)
// 🔹 Edit-mode prefill with correct tenant order
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
  loadEmployeePositionsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { setupFilePreview } from "../../utils/file-preview.js";
import { EMPLOYEE_FORM_RULES } from "./employee.form.rules.js";

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
export async function setupEmployeeFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const empId =
    sessionStorage.getItem("employeeEditId") || getQueryParam("id");
  const isEdit = Boolean(empId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  const setFormTitle = (txt, icon) => {
    if (titleEl) titleEl.textContent = txt;
    if (submitBtn)
      submitBtn.innerHTML = `<i class="${icon} me-1"></i> ${txt}`;
  };

  setFormTitle(isEdit ? "Update Employee" : "Add Employee", "ri-save-3-line");

  /* ---------------- DOM Refs ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const depSelect = document.getElementById("departmentSelect");
  const posSelect = document.getElementById("position");
  const genderSelect = document.getElementById("gender");

  /* ============================================================
     🔐 ROLE-AWARE ORG / FAC (MASTER PARITY)
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

    setupSelectOptions(
      depSelect,
      await loadDepartmentsLite({}, true),
      "id",
      "name",
      "-- Select Department --"
    );

    setupSelectOptions(
      posSelect,
      await loadEmployeePositionsLite({}, true),
      "id",
      "name",
      "-- Select Position --"
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load dropdown data");
  }

  /* ============================================================
     📎 FILE PREVIEWS (MASTER)
  ============================================================ */
  setupFilePreview(
    "photoInput",
    "photoPreview",
    "removePhotoBtn",
    "photo_path"
  );
  setupFilePreview(
    "resumeInput",
    "resumePreview",
    "removeResumeBtn",
    "resume_url"
  );
  setupFilePreview(
    "documentInput",
    "documentPreview",
    "removeDocumentBtn",
    "document_url"
  );

/* ============================================================
   ✏️ PREFILL (EDIT MODE) — ENTERPRISE MASTER (FIXED + FILE NAMES)
============================================================ */
if (isEdit) {
  try {
    showLoading();

    let entry = JSON.parse(
      sessionStorage.getItem("employeeEditPayload") || "null"
    );

    if (!entry) {
      const res = await authFetch(`/api/employees/${empId}`);
      const json = await res.json();
      entry = json?.data;
    }

    if (!entry) throw new Error("Employee not found");

    /* ================= BASIC INPUTS ================= */
    [
      "first_name",
      "middle_name",
      "last_name",
      "phone",
      "email",
      "address",
      "employee_no",
      "license_no",
      "specialty",
      "certifications",
      "emergency_contact_name",
      "emergency_contact_phone",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = entry[id] ?? "";
    });

    /* ================= DATE FIELDS ================= */
    ["dob", "hire_date", "termination_date"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = normalizeDate(entry[id]);
    });

    /* ================= GENDER (ENUM SAFE) ================= */
    if (genderSelect && entry.gender) {
      genderSelect.value = String(entry.gender).toLowerCase();
    }

    /* ================= POSITION ================= */
    if (posSelect) {
      const positions = await loadEmployeePositionsLite({}, true);
      setupSelectOptions(
        posSelect,
        positions,
        "id",
        "name",
        "-- Select Position --"
      );
      posSelect.value = entry.position || "";
    }

    /* ================= ORGANIZATION → FACILITY ================= */
    if (orgSelect && entry.organization_id) {
      orgSelect.value = entry.organization_id;

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

      if (entry.facility_id) {
        facSelect.value = entry.facility_id;
      }
    }

    /* ================= DEPARTMENT (FACILITY-SCOPED) ================= */
    if (depSelect && entry.facility_id) {
      const departments = await loadDepartmentsLite(
        { facility_id: entry.facility_id },
        true
      );

      setupSelectOptions(
        depSelect,
        departments,
        "id",
        "name",
        "-- Select Department --"
      );

      if (entry.department_id) {
        depSelect.value = entry.department_id;
      }
    }

    /* ================= STATUS (RADIO) ================= */
    if (entry.status) {
      const statusEl = document.querySelector(
        `input[name="status"][value="${entry.status}"]`
      );
      if (statusEl) statusEl.checked = true;
    }

    /* ================= FILE PREVIEWS (WITH FILE NAMES) ================= */
    const extractFileName = (url) => {
      try {
        return decodeURIComponent(url.split("/").pop().split("?")[0]);
      } catch {
        return "View File";
      }
    };

    /* ===== PHOTO ===== */
    if (entry.photo_path) {
      document.getElementById("photoPreview").innerHTML = `
        <img src="${entry.photo_path}" class="preview-img" />
      `;
      document.getElementById("removePhotoBtn")?.classList.remove("hidden");
      document.getElementById("remove_photo").value = "false";
    }

    /* ===== RESUME ===== */
    if (entry.resume_url) {
      const resumeName = extractFileName(entry.resume_url);

      document.getElementById("resumePreview").innerHTML = `
        <div class="file-preview">
          <strong>${resumeName}</strong><br/>
          <a href="${entry.resume_url}" target="_blank">View Resume</a>
        </div>
      `;
      document.getElementById("removeResumeBtn")?.classList.remove("hidden");
      document.getElementById("remove_resume").value = "false";
    }

    /* ===== DOCUMENT ===== */
    if (entry.document_url) {
      const documentName = extractFileName(entry.document_url);

      document.getElementById("documentPreview").innerHTML = `
        <div class="file-preview">
          <strong>${documentName}</strong><br/>
          <a href="${entry.document_url}" target="_blank">View Document</a>
        </div>
      `;
      document.getElementById("removeDocumentBtn")?.classList.remove("hidden");
      document.getElementById("remove_document").value = "false";
    }

  } catch (err) {
    console.error(err);
    showToast(err.message || "❌ Failed to load employee");
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

    for (const rule of EMPLOYEE_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

        let hasValue = false;

        if (el?.type === "radio") {
          hasValue = form.querySelector(`[name="${rule.id}"]:checked`);
        } else {
          hasValue = el && el.value && el.value.toString().trim() !== "";
        }

        if (!hasValue) {
          errors.push({ field: rule.id, message: rule.message });
        }

    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const method = isEdit ? "PUT" : "POST";
    const url = isEdit ? `/api/employees/${empId}` : `/api/employees`;
    const formData = new FormData(form);

    /* ---------------- TENANT SAFETY ---------------- */
    if (!userRole.includes("super")) formData.delete("organization_id");
    if (!userRole.includes("super") && !userRole.includes("admin")) {
      formData.delete("facility_id");
    }

    if (!formData.has("remove_photo"))
      formData.append("remove_photo", "false");
    if (!formData.has("remove_resume"))
      formData.append("remove_resume", "false");
    if (!formData.has("remove_document"))
      formData.append("remove_document", "false");

    try {
      showLoading();
      const res = await authFetch(url, { method, body: formData });
      const result = await res.json();

      if (!res.ok) {
        applyServerErrors(form, result?.errors);
        throw new Error(normalizeMessage(result, "Submission failed"));
      }

      showToast(isEdit ? "✅ Employee updated" : "✅ Employee created");
      sessionStorage.clear();
      window.location.href = "/employees-list.html";
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
    window.location.href = "/employees-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setFormTitle("Add Employee", "ri-save-3-line");
  });
}
