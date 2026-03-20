// 📁 discount-form.js – Secure & Role-Aware Discount Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 FULL parity with deposit-form.js MASTER
// 🔹 Rule-driven validation (DISCOUNT_FORM_RULES)
// 🔹 Role-aware org/fac handling (SUPER ONLY)
// 🔹 Clean payload normalization (UUID | number | null)
// 🔹 Controller-faithful (no HTML validation, no silent rules)
// 🔹 Preserves ALL existing DOM IDs, API calls, and wiring
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
  loadInvoiceItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { DISCOUNT_FORM_RULES } from "./discount.form.rules.js";

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

function normalizeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupDiscountFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey(["discounts:create", "discounts:edit"]));
  initLogoutWatcher();
  enableLiveValidation(form);

  const discountId =
    sessionStorage.getItem("discountEditId") || getQueryParam("id");
  const isEdit = Boolean(discountId);

  /* ============================================================
     🎨 UI Mode
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");
  const reasonGroup = document.getElementById("reasonGroup");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent = mode === "edit" ? "Edit Discount" : "Add Discount";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Discount`
          : `<i class="ri-add-line me-1"></i> Add Discount`;
    if (reasonGroup)
      reasonGroup.classList.remove("hidden");
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const invoiceInput = document.getElementById("invoiceInput");
  const invoiceHidden = document.getElementById("invoiceId");
  const invoiceSuggestions = document.getElementById("invoiceSuggestions");

  const invoiceItemSelect = document.getElementById("invoiceItemId");
  const typeSelect = document.getElementById("typeSelect");
  const valueInput = document.getElementById("value");
  const reasonInput = document.getElementById("reason");

  /* ============================================================
     👥 Role
  ============================================================ */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

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
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    setupSuggestionInputDynamic(
      invoiceInput,
      invoiceSuggestions,
      "/api/lite/invoices",
      async (selected) => {
        const record = selected?.raw || selected;
        invoiceHidden.value = record?.id || "";

        if (selected && invoiceItemSelect) {
          try {
            const items = await loadInvoiceItemsLite(record.id, {}, true);
            const filtered = items.filter(
              (x) => !["voided", "cancelled"].includes(x.status)
            );
            filtered.forEach((item) => {
              item.displayLabel = `${item.description || "Item"} · Qty ${
                item.quantity || 1
              } · $${item.net_amount || item.total_price || 0}`;
            });
            setupSelectOptions(
              invoiceItemSelect,
              filtered,
              "id",
              "displayLabel",
              "-- Apply to whole invoice --"
            );
          } catch {
            invoiceItemSelect.innerHTML = `<option value="">-- Apply to whole invoice --</option>`;
          }
        } else {
          invoiceHidden.value = "";
          invoiceItemSelect.innerHTML = `<option value="">-- Apply to whole invoice --</option>`;
        }
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
  if (isEdit && discountId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("discountEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/discounts/${discountId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            normalizeMessage(result, "Failed to load discount")
          );
        entry = result?.data;
      }

      if (!entry) return;

      invoiceHidden.value = entry.invoice_id || "";
      invoiceInput.value = entry.invoice
        ? `${entry.invoice.invoice_number || ""}`
        : "";

      invoiceItemSelect.value = entry.invoice_item_id || "";
      typeSelect.value = entry.type || "";
      valueInput.value = entry.value ?? "";
      reasonInput.value = entry.reason || "";

      if (isSuper) {
        if (orgSelect && entry.organization_id)
          orgSelect.value = entry.organization_id;
        if (facSelect && entry.facility_id)
          facSelect.value = entry.facility_id;
      }

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load discount");
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

    for (const rule of DISCOUNT_FORM_RULES) {
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
      invoice_id: normalizeUUID(invoiceHidden.value),
      invoice_item_id: normalizeUUID(invoiceItemSelect?.value),
      type: typeSelect.value || null,
      value: normalizeNumber(valueInput.value),
      reason: reasonInput.value || null,
    };

    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();

      const url = isEdit
        ? `/api/discounts/${discountId}`
        : `/api/discounts`;
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

      showToast(isEdit ? "✅ Discount updated" : "✅ Discount created");

      sessionStorage.removeItem("discountEditId");
      sessionStorage.removeItem("discountEditPayload");

      window.location.href = "/discounts-list.html";
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
    window.location.href = "/discounts-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    invoiceHidden.value = "";
    invoiceItemSelect.innerHTML = `<option value="">-- Apply to whole invoice --</option>`;
    setUI("add");
  });
}
