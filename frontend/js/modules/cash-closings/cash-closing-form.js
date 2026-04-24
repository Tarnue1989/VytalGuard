// 📁 cash-closing-form.js – FIXED (EXPENSE PARITY)

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
  loadAccountsLite,        // ✅ ADDED
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { CASH_CLOSING_FORM_RULES } from "./cash-closing-form-rules.js";

/* ============================================================ */
function normalizeUUID(val) {
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error;
  if (typeof msg === "string") return msg;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

/* ============================================================ */
export async function setupCashClosingForm({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  /* ================= DOM ================= */
  const dateInput = document.getElementById("date"); // ✅ FIXED
  const accountSelect = document.getElementById("accountSelect");

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  /* ================= ROLE ================= */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ================= DROPDOWNS ================= */
  try {
    /* 🔥 ACCOUNTS (MAIN FIX) */
    const accounts = await loadAccountsLite();
    setupSelectOptions(
      accountSelect,
      accounts,
      "id",
      "name",
      "-- Select Account --"
    );

    /* 🔥 ORG / FAC */
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

  /* ================= SUBMIT ================= */
 form.onsubmit = async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) submitBtn.disabled = true;

    clearFormErrors(form);

    const errors = [];

    for (const rule of CASH_CLOSING_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el = document.getElementById(rule.id);
      if (!el) continue;
      if (el.closest(".hidden")) continue;

      if (!el.value || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix highlighted fields");

      if (submitBtn) submitBtn.disabled = false; // 🔥 re-enable on validation fail
      return;
    }

    const payload = {
      date: dateInput.value,
      account_id: normalizeUUID(accountSelect.value),
    };

    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();

      const res = await authFetch(`/api/cash-closings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );
      }

      showToast("✅ Cash closing created");
      window.location.href = "/cash-closing-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();

      if (submitBtn) submitBtn.disabled = false; // 🔥 always re-enable
    }
  };

  /* ================= CANCEL / CLEAR ================= */
  cancelBtn?.addEventListener("click", () => {
    window.location.href = "/cash-closing-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
  });
}