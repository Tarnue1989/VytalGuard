// 📁 role-form.js – Secure & Role-Aware Role Form (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: department-form.js / patient-form.js
// 🔹 Rule-driven validation (ROLE_FORM_RULES)
// 🔹 ONLY superadmin can see/select organization
// 🔹 Org admin has implicit org (never selectable)
// 🔹 Facility optional (superadmin + org admin)
// 🔹 Backend remains authority
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
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { ROLE_FORM_RULES } from "./role.form.rules.js";

/* ============================================================
   Helpers
============================================================ */
const getQueryParam = (k) =>
  new URLSearchParams(window.location.search).get(k);

const normalizeMessage = (r, fb) =>
  r?.message || r?.error || r?.msg || fb;

const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

/* ============================================================
   Setup Role Form
============================================================ */
export async function setupRoleFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";
  const isOrgAdmin = userRole === "organization_admin";

  const roleId =
    sessionStorage.getItem("roleEditId") || getQueryParam("id");
  const isEdit = Boolean(roleId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setUI = (edit) => {
    titleEl.textContent = edit ? "Edit Role" : "Add Role";
    submitBtn.innerHTML = edit
      ? `<i class="ri-save-3-line me-1"></i> Update Role`
      : `<i class="ri-add-line me-1"></i> Add Role`;
  };
  setUI(isEdit);

  /* ---------------- DOM ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const systemRadio = document.getElementById("is_system_true");
  const customRadio = document.getElementById("is_system_false");

  const hideOrg = () =>
    orgSelect?.closest(".mb-3")?.classList.add("hidden");
  const showOrg = () =>
    orgSelect?.closest(".mb-3")?.classList.remove("hidden");
  const hideFac = () =>
    facSelect?.closest(".mb-3")?.classList.add("hidden");
  const showFac = () =>
    facSelect?.closest(".mb-3")?.classList.remove("hidden");

  /* ============================================================
     Role / Scope Visibility
  ============================================================ */
  if (isSuper) {
    showOrg();
    showFac();
  } else if (isOrgAdmin) {
    hideOrg();
    showFac();
  } else {
    hideOrg();
    hideFac();
  }

  if (!isSuper) {
    systemRadio?.closest(".form-check")?.classList.add("hidden");
    customRadio.checked = true;
  }

  /* ============================================================
     Load dropdowns
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
          "-- Select Facility (optional) --"
        );
      };

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
    } else if (isOrgAdmin) {
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility (optional) --"
      );
    }
  } catch {
    showToast("❌ Failed to load organization/facility lists");
  }

  /* ============================================================
     Submit — RULE-DRIVEN (PATIENT PARITY)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of ROLE_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || !el.value || el.value.toString().trim() === "") {
        errors.push({
          field: rule.id,
          message: rule.message,
        });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      name: document.getElementById("name").value.trim(),
      code: document.getElementById("code").value.trim(),
      description:
        document.getElementById("description")?.value.trim() || "",
      is_system: systemRadio.checked,
      status:
        document.querySelector("input[name='status']:checked")?.value ||
        "active",
    };

    if (!payload.is_system) {
      if (isSuper) payload.organization_id = normalizeUUID(orgSelect.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();
      const res = await authFetch(
        isEdit ? `/api/roles/${roleId}` : `/api/roles`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (!res.ok)
        throw new Error(normalizeMessage(json, "Submission failed"));

      showToast(isEdit ? "✅ Role updated" : "✅ Role created");
      sessionStorage.clear();
      window.location.href = "/roles-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/roles-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    customRadio.checked = true;
    setUI(false);
  });
}
