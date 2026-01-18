// 📁 department-form.js – Secure & Role-Aware Department Form (Enterprise Master Pattern)
// ============================================================================
// 🔹 Rule-driven validation (DEPARTMENT_FORM_RULES)
// 🔹 Role-aware org/fac handling (super / org / facility)
// 🔹 Clean payload normalization (UUID | null)
// 🔹 Controller-faithful (no HTML validation, no silent rules)
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
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import {
  resolveUserRole,
  getOrganizationId,
} from "../../utils/roleResolver.js";

import { DEPARTMENT_FORM_RULES } from "./department.form.rules.js";

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
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupDepartmentFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const depId =
    sessionStorage.getItem("departmentEditId") || getQueryParam("id");
  const isEdit = Boolean(depId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Edit Department" : "Add Department";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Department`
          : `<i class="ri-add-line me-1"></i> Add Department`;
  };
  setUI(isEdit ? "edit" : "add");

  /* ---------------- DOM Refs ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const headInput = document.getElementById("headInput");
  const headHidden = document.getElementById("headId");
  const headSuggestions = document.getElementById("headSuggestions");

  /* ---------------- Role ---------------- */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";
  const isOrgAdmin = userRole === "organization_admin";

  /* ============================================================
     🌐 Dropdowns & Suggestions
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
            { organization_id: orgId ?? getOrganizationId() },
            true
          ),
          "id",
          "name",
          "-- Select Facility (optional) --"
        );
      };

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
    } else if (isOrgAdmin) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite(
          { organization_id: getOrganizationId() },
          true
        ),
        "id",
        "name",
        "-- Select Facility (optional) --"
      );
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // Head of Department (Employee suggestion)
    setupSuggestionInputDynamic(
      headInput,
      headSuggestions,
      "/api/lite/employees",
      (selected) => {
        headHidden.value = selected?.id || "";
        headInput.value = selected?.label || selected?.full_name || "";
      },
      "label"
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit && depId) {
    try {
      showLoading();

      const res = await authFetch(`/api/departments/${depId}`);
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(
          normalizeMessage(result, "Failed to load department")
        );

      const entry = result?.data;
      if (!entry) return;

      document.getElementById("name").value = entry.name || "";
      document.getElementById("code").value = entry.code || "";
      document.getElementById("description").value =
        entry.description || "";

      if (isSuper && entry.organization_id) {
        orgSelect?.closest(".form-group")?.classList.remove("hidden");
        setupSelectOptions(
          orgSelect,
          await loadOrganizationsLite(),
          "id",
          "name",
          "-- Select Organization --"
        );
        orgSelect.value = entry.organization_id;

        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite(
            { organization_id: entry.organization_id },
            true
          ),
          "id",
          "name",
          "-- Select Facility (optional) --"
        );
      }

      if (isOrgAdmin || isSuper) {
        facSelect?.closest(".form-group")?.classList.remove("hidden");
        if (entry.facility_id) facSelect.value = entry.facility_id;
      }

      if (entry.head_of_department) {
        const h = entry.head_of_department;
        headInput.value = [h.first_name, h.middle_name, h.last_name]
          .filter(Boolean)
          .join(" ");
        headHidden.value = h.id;
      }

      if (entry.status) {
        document
          .getElementById(`status_${entry.status}`)
          ?.setAttribute("checked", true);
      }

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load department");
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
    for (const rule of DEPARTMENT_FORM_RULES) {
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

    const payload = {
      name: document.getElementById("name")?.value.trim(),
      code: document.getElementById("code")?.value.trim(),
      description:
        document.getElementById("description")?.value.trim() || "",
      status:
        document.querySelector("input[name='status']:checked")?.value ||
        "active",
      organization_id: isSuper
        ? normalizeUUID(orgSelect?.value)
        : null,
      facility_id: normalizeUUID(facSelect?.value),
      head_of_department_id: normalizeUUID(headHidden?.value),
    };

    try {
      showLoading();
      const url = isEdit
        ? `/api/departments/${depId}`
        : `/api/departments`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      showToast(
        isEdit ? "✅ Department updated" : "✅ Department created"
      );
      sessionStorage.clear();
      window.location.href = "/departments-list.html";
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
    window.location.href = "/departments-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI("add");
    document
      .getElementById("status_active")
      ?.setAttribute("checked", true);
  });
}
