// 📦 supplier-form.js – Secure & Role-Aware Supplier Form (Enterprise Master Pattern)
// ============================================================================
// 🧭 FULL PARITY WITH department-form.js
// 🔹 Rule-driven validation (SUPPLIER_FORM_RULES)
// 🔹 Role-aware org / facility handling (super / org / facility)
// 🔹 Clean payload normalization (UUID | null)
// 🔹 Controller-faithful (backend is source of truth)
// 🔹 No HTML validation, no silent rules
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

import {
  resolveUserRole,
  getOrganizationId,
} from "../../utils/roleResolver.js";

import { SUPPLIER_FORM_RULES } from "./supplier.form.rules.js";

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
export async function setupSupplierFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const supId =
    sessionStorage.getItem("supplierEditId") || getQueryParam("id");
  const isEdit = Boolean(supId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Edit Supplier" : "Add Supplier";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Supplier`
          : `<i class="ri-add-line me-1"></i> Add Supplier`;
  };
  setUI(isEdit ? "edit" : "add");

  /* ---------------- DOM Refs ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const nameInput = document.getElementById("name");
  const contactName = document.getElementById("contact_name");
  const contactEmail = document.getElementById("contact_email");
  const contactPhone = document.getElementById("contact_phone");
  const address = document.getElementById("address");
  const notes = document.getElementById("notes");

  /* ---------------- Role ---------------- */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";
  const isOrgAdmin = userRole === "organization_admin";

  /* ============================================================
     🌐 Dropdowns (ROLE-AWARE)
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
          "-- Select Facility --"
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
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit && supId) {
    try {
      showLoading();

      const res = await authFetch(`/api/suppliers/${supId}`);
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(
          normalizeMessage(result, "Failed to load supplier")
        );

      const entry = result?.data;
      if (!entry) return;

      nameInput.value = entry.name || "";
      contactName.value = entry.contact_name || "";
      contactEmail.value = entry.contact_email || "";
      contactPhone.value = entry.contact_phone || "";
      address.value = entry.address || "";
      notes.value = entry.notes || "";

      if (isSuper && entry.organization_id) {
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
          "-- Select Facility --"
        );
      }

      if ((isSuper || isOrgAdmin) && entry.facility_id) {
        facSelect?.closest(".form-group")?.classList.remove("hidden");
        facSelect.value = entry.facility_id;
      }

      // 🔒 Prevent tenant reassignment
      orgSelect?.setAttribute("disabled", true);
      facSelect?.setAttribute("disabled", true);

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load supplier");
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
    for (const rule of SUPPLIER_FORM_RULES) {
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
      contact_name: contactName?.value.trim() || null,
      contact_email: contactEmail?.value.trim() || null,
      contact_phone: contactPhone?.value.trim() || null,
      address: address?.value.trim() || null,
      notes: notes?.value.trim() || null,
    };

    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    } else if (isOrgAdmin) {
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();
      const url = isEdit
        ? `/api/suppliers/${supId}`
        : `/api/suppliers`;
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
        isEdit ? "✅ Supplier updated" : "✅ Supplier created"
      );
      sessionStorage.clear();
      window.location.href = "/suppliers-list.html";
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
    window.location.href = "/suppliers-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI("add");
  });
}
