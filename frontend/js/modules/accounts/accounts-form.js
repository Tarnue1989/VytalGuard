// 📁 account-form.js – Secure & Role-Aware Account Form (LIGHT MASTER)
// ============================================================================
// 🔹 Simplified from deposit-form.js (NO patient / invoice / lifecycle)
// 🔹 Rule-driven validation (ACCOUNT_FORM_RULES)
// 🔹 Role-aware org/fac handling (SUPER ONLY)
// 🔹 Clean payload normalization
// 🔹 Controller-faithful (no HTML validation)
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

import { resolveUserRole } from "../../utils/roleResolver.js";
import { ACCOUNT_FORM_RULES } from "./accounts.form.rules.js";

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

function normalizeUUID(val) {
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupAccountFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const accountId =
    sessionStorage.getItem("accountEditId") || getQueryParam("id");
  const isEdit = Boolean(accountId);

  /* ============================================================
     🎨 UI Mode
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent = mode === "edit" ? "Edit Account" : "Add Account";

    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Account`
          : `<i class="ri-add-line me-1"></i> Add Account`;
  };

  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM
  ============================================================ */
  const accountNumberInput = document.getElementById("account_number");
  const nameInput = document.getElementById("name");
  const typeSelect = document.getElementById("type");
  const currencySelect = document.getElementById("currency");
  const statusSelect = document.getElementById("is_active");

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  /* ============================================================
     👥 Role
  ============================================================ */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ============================================================
     🌐 Dropdowns
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
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load dropdowns");
  }

  /* ============================================================
     ✏️ PREFILL
  ============================================================ */
  if (isEdit && accountId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("accountEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/accounts/${accountId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(normalizeMessage(result, "Failed to load account"));
        entry = result?.data;
      }

      if (!entry) return;

      accountNumberInput.value = entry.account_number || "";
      nameInput.value = entry.name || "";
      typeSelect.value = entry.type || "";
      currencySelect.value = entry.currency || "";
      statusSelect.value = entry.is_active ? "true" : "false";

      if (isSuper) {
        orgSelect.value = entry.organization_id || "";
        facSelect.value = entry.facility_id || "";
      }

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load account");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of ACCOUNT_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el = document.getElementById(rule.id);
      if (!el || el.closest(".hidden")) continue;

      if (!el.value || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Fix highlighted fields");
      return;
    }

    const payload = {
      account_number: accountNumberInput.value,
      name: nameInput.value,
      type: typeSelect.value,
      currency: currencySelect.value,
      is_active: statusSelect.value === "true",
    };

    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();

      const url = isEdit
        ? `/api/accounts/${accountId}`
        : `/api/accounts`;

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

      showToast(isEdit ? "✅ Account updated" : "✅ Account created");

      sessionStorage.removeItem("accountEditId");
      sessionStorage.removeItem("accountEditPayload");

      window.location.href = "/accounts-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };
}