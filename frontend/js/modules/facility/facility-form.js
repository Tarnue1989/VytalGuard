// 📁 facility-form.js – Secure & Role-Aware Facility Form (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-form.js (Authoritative)
// 🔹 Rule-driven validation (FACILITY_FORM_RULES)
// 🔹 ONLY superadmin can see/select organization
// 🔹 Org admin has implicit org (never selectable)
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
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { FACILITY_FORM_RULES } from "./facility.form.rules.js";

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
   Setup Facility Form
============================================================ */
export async function setupFacilityFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";
  const isOrgAdmin = userRole === "organization_admin";

  const facilityId =
    sessionStorage.getItem("facilityEditId") || getQueryParam("id");
  const isEdit = Boolean(facilityId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setUI = (edit) => {
    titleEl.textContent = edit ? "Edit Facility" : "Add Facility";
    submitBtn.innerHTML = edit
      ? `<i class="ri-save-3-line me-1"></i> Update Facility`
      : `<i class="ri-add-line me-1"></i> Add Facility`;
  };
  setUI(isEdit);

  /* ---------------- DOM ---------------- */
  const orgSelect = document.getElementById("organizationSelect");

  const hideOrg = () =>
    orgSelect?.closest(".mb-3")?.classList.add("hidden");
  const showOrg = () =>
    orgSelect?.closest(".mb-3")?.classList.remove("hidden");

  /* ============================================================
     Scope Visibility
  ============================================================ */
  if (isSuper) showOrg();
  else hideOrg();

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
    }
  } catch {
    showToast("❌ Failed to load organization list");
  }

  /* ============================================================
     Submit — RULE-DRIVEN (ROLE PARITY)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of FACILITY_FORM_RULES) {
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

    const getVal = (name) =>
      form.querySelector(`[name="${name}"]`)?.value?.trim();

    const payload = {
      name: getVal("name"),
      code: getVal("code"),
      address: getVal("address") || null,
      phone: getVal("phone") || null,
      email: getVal("email") || null,
      status:
        form.querySelector("input[name='status']:checked")?.value || "active",
    };


    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect.value);
    }

    try {
      showLoading();
      const res = await authFetch(
        isEdit ? `/api/facilities/${facilityId}` : `/api/facilities`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (!res.ok)
        throw new Error(normalizeMessage(json, "Submission failed"));

      showToast(isEdit ? "✅ Facility updated" : "✅ Facility created");
      sessionStorage.clear();
      window.location.href = "/facilities-list.html";
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
    window.location.href = "/facilities-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI(false);
  });
}
