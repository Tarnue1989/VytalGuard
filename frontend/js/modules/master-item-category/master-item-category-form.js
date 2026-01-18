// 📁 master-item-category-form.js – Secure & Role-Aware Category Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 MASTER PARITY WITH department-form.js
// 🔹 Rule-driven validation (MASTER_ITEM_CATEGORY_FORM_RULES)
// 🔹 Live validation + server error mapping
// 🔹 Role-aware org/fac handling (super / org / facility)
// 🔹 Clean payload normalization (UUID | null)
// 🔹 Controller-faithful (no HTML validation, no silent rules)
// 🔹 100% ID preservation
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

import { MASTER_ITEM_CATEGORY_FORM_RULES } from "./master-item-category.form.rules.js";

/* ============================================================
   🧩 Helpers (MASTER PARITY)
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
   🚀 Setup Master Item Category Form (MASTER)
============================================================ */
export async function setupMasterItemCategoryFormSubmission({ form }) {
  /* ---------------- Auth Guard ---------------- */
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const sessionId =
    sessionStorage.getItem("masterItemCategoryEditId") ||
    getQueryParam("id");
  const isEdit = Boolean(sessionId);

  /* ---------------- UI Refs ---------------- */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit"
          ? "Edit Master Item Category"
          : "Add Master Item Category";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Category`
          : `<i class="ri-add-line me-1"></i> Add Category`;
  };
  setUI(isEdit ? "edit" : "add");

  /* ---------------- Field Refs ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const nameInput = document.getElementById("name");
  const codeInput = document.getElementById("code");
  const descInput = document.getElementById("description");

  /* ============================================================
     🌐 Org / Facility Dropdowns (ROLE-AWARE – MASTER)
  ============================================================ */
  const role = (localStorage.getItem("userRole") || "").toLowerCase();

  try {
    if (role.includes("super")) {
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
    } else if (role.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE – MASTER)
  ============================================================ */
  if (isEdit && sessionId) {
    try {
      showLoading();
      const res = await authFetch(
        `/api/master-item-categories/${sessionId}`
      );
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(
          normalizeMessage(result, "Failed to load category")
        );

      const entry = result?.data;
      if (!entry) return;

      nameInput.value = entry.name || "";
      codeInput.value = entry.code || "";
      descInput.value = entry.description || "";

      if (entry.organization_id) orgSelect.value = entry.organization_id;
      if (entry.facility_id) facSelect.value = entry.facility_id;

      if (entry.status) {
        document
          .getElementById(`status_${entry.status}`)
          ?.setAttribute("checked", true);
      }

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load category");
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
    for (const rule of MASTER_ITEM_CATEGORY_FORM_RULES) {
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
      name: nameInput?.value.trim(),
      code: codeInput?.value.trim(),
      description: descInput?.value.trim() || "",
      status:
        document.querySelector("input[name='status']:checked")?.value ||
        "active",
      organization_id: role.includes("super")
        ? normalizeUUID(orgSelect?.value)
        : null,
      facility_id: normalizeUUID(facSelect?.value),
    };

    try {
      showLoading();
      const url = isEdit
        ? `/api/master-item-categories/${sessionId}`
        : `/api/master-item-categories`;
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
        isEdit
          ? "✅ Category updated"
          : "✅ Category created"
      );

      sessionStorage.clear();
      window.location.href = "/master-item-categories-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     ⏮️ CANCEL / CLEAR (MASTER)
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/master-item-categories-list.html";
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
