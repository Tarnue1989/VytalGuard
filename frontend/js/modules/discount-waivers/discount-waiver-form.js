// 📁 discount-waiver-form.js – Enterprise Master Pattern Aligned (Add/Edit Discount Waiver)
// ============================================================================
// 🔹 Mirrors discount-form.js for unified enterprise behavior
// 🔹 Adds permission-driven org/facility visibility & cascade logic
// 🔹 Preserves all existing DOM IDs, API calls, and event wiring
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

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
  return val && val.trim() !== "" ? val : null;
}

function validateWaiverForm(payload, isEdit, userRole, ctx = {}) {
  const errors = [];

  if (!payload.invoice_id) errors.push("Invoice is required");
  if (!payload.patient_id) errors.push("Patient is required (auto-filled from invoice)");
  if (!payload.type) errors.push("Waiver type is required");
  if (!payload.reason || payload.reason.trim().length < (isEdit ? 5 : 3))
    errors.push(isEdit ? "Reason (min 5 chars) required when editing" : "Reason is required");

  const role = userRole.toLowerCase();
  if (role.includes("super")) {
    if (!payload.organization_id) errors.push("Organization is required");
    if (!payload.facility_id) errors.push("Facility is required");
  } else if (role.includes("org_owner")) {
    if (!payload.facility_id) errors.push("Facility is required");
  }

  if (payload.type === "percentage") {
    if (payload.percentage == null || payload.percentage <= 0)
      errors.push("Valid percentage is required");
    if (payload.percentage > 100)
      errors.push("Percentage waiver cannot exceed 100%");
  }

  if (payload.type === "fixed") {
    if (payload.amount == null || payload.amount <= 0)
      errors.push("Valid fixed amount is required");
    if (ctx.maxAllowed != null && payload.amount > ctx.maxAllowed)
      errors.push(`Waiver cannot exceed ${ctx.maxAllowed.toFixed(2)}`);
  }

  return errors;
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupDiscountWaiverFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("discountWaiverEditId");
  const queryId = getQueryParam("id");
  const waiverId = sessionId || queryId;
  const isEdit = !!waiverId;

  // 🔐 Permission Guard
  const token = initPageGuard(autoPagePermissionKey(["discount-waivers:create", "discount-waivers:edit"]));

  /* ============================================================
     🎨 UI Mode Setup
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const setAddModeUI = () => {
    if (titleEl) titleEl.textContent = "Add Discount Waiver";
    if (submitBtn) submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Waiver`;
  };
  const setEditModeUI = () => {
    if (titleEl) titleEl.textContent = "Edit Discount Waiver";
    if (submitBtn) submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Waiver`;
  };
  isEdit ? setEditModeUI() : setAddModeUI();

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const invoiceInput = document.getElementById("invoiceInput");
  const invoiceHidden = document.getElementById("invoiceId");
  const invoiceSuggestions = document.getElementById("invoiceSuggestions");
  const patientHidden = document.getElementById("patientId");

  const typeSelect = document.getElementById("typeSelect");
  const percentageInput = document.getElementById("percentage");
  const amountInput = document.getElementById("amount");
  const appliedTotalInput = document.getElementById("appliedTotal");
  const reasonInput = document.getElementById("reason");

  const percentageGroup = document.getElementById("percentageGroup");
  const amountGroup = document.getElementById("amountGroup");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
  let maxAllowed = null;

  /* ============================================================
     🔄 Toggle Fields
  ============================================================ */
  function toggleWaiverFields() {
    const type = typeSelect.value;
    percentageGroup.style.display = type === "percentage" ? "block" : "none";
    amountGroup.style.display = type === "fixed" ? "block" : "none";
    if (type === "percentage") amountInput.value = "";
    if (type === "fixed") percentageInput.value = "";
  }

  /* ============================================================
     🔽 Prefill Dropdowns + Suggestions
  ============================================================ */
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => await reloadFacilities(orgSelect.value || null));
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
      const facilities = await loadFacilitiesLite({}, true);
      if (facilities.length && facSelect) {
        setupSelectOptions(facSelect, facilities, "id", "name", "-- Select Facility --");
        facSelect.value = localStorage.getItem("facilityId") || "";
      }
    }

    setupSuggestionInputDynamic(
      invoiceInput,
      invoiceSuggestions,
      "/api/lite/invoices",
      async (selected) => {
        invoiceHidden.value = selected?.id || "";
        if (selected) {
          invoiceInput.value =
            selected.label ||
            `${selected.invoice_number || ""} · ${selected.patient?.code || ""} - ${
              selected.patient?.full_name || ""
            } · Balance ${selected.balance || ""}`;
          maxAllowed = selected.balance ? parseFloat(selected.balance) : null;
          patientHidden.value = selected.patient?.id || "";
        } else {
          invoiceHidden.value = "";
          patientHidden.value = "";
          maxAllowed = null;
        }
      },
      "label"
    );

    /* ============================================================
       🧩 Prefill If Editing
    ============================================================ */
    if (isEdit) {
      try {
        showLoading();
        let entry = sessionStorage.getItem("discountWaiverEditPayload");
        entry = entry ? JSON.parse(entry) : null;

        if (!entry) {
          const res = await authFetch(`/api/discount-waivers/${waiverId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const result = await res.json().catch(() => ({}));
          entry = result?.data;
          if (!res.ok || !entry)
            throw new Error(normalizeMessage(result, `❌ Failed to load waiver`));
        }

        // 🧾 Populate fields
        if (entry.invoice) {
          invoiceHidden.value = entry.invoice.id;
          invoiceInput.value = `${entry.invoice.invoice_number} · ${
            entry.invoice.patient?.code || ""
          } - ${entry.invoice.patient?.full_name || ""}`;
        }
        if (entry.patient) {
          patientHidden.value = entry.patient?.id || "";
        }

        typeSelect.value = entry.type || "";
        percentageInput.value = entry.percentage ?? "";
        amountInput.value = entry.amount ?? "";
        appliedTotalInput.value = entry.applied_total ?? "";
        reasonInput.value = entry.reason || "";
        if (entry.organization_id && orgSelect) orgSelect.value = entry.organization_id;
        if (entry.facility_id && facSelect) facSelect.value = entry.facility_id;
        setEditModeUI();
      } catch (err) {
        console.error("❌ Prefill error:", err);
        showToast(err.message || "❌ Could not load waiver");
      } finally {
        hideLoading();
      }
    }

    toggleWaiverFields();
    typeSelect.addEventListener("change", toggleWaiverFields);
  } catch (err) {
    console.error("❌ Dropdown load failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const type = typeSelect?.value || null;
    const payload = {
      invoice_id: normalizeUUID(invoiceHidden.value),
      patient_id: normalizeUUID(patientHidden.value),
      type,
      reason: reasonInput?.value || null,
      organization_id: normalizeUUID(orgSelect?.value || localStorage.getItem("organizationId")),
      facility_id: normalizeUUID(facSelect?.value || localStorage.getItem("facilityId")),
    };

    if (type === "percentage")
      payload.percentage = percentageInput?.value ? parseFloat(percentageInput.value) : null;
    if (type === "fixed")
      payload.amount = amountInput?.value ? parseFloat(amountInput.value) : null;

    const errors = validateWaiverForm(payload, isEdit, userRole, { maxAllowed });
    if (errors.length > 0) {
      showToast("❌ " + errors.join("\n"));
      return;
    }

    const url = isEdit ? `/api/discount-waivers/${waiverId}` : `/api/discount-waivers`;
    const method = isEdit ? "PUT" : "POST";

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ Waiver updated successfully");
        sessionStorage.removeItem("discountWaiverEditId");
        sessionStorage.removeItem("discountWaiverEditPayload");
        window.location.href = "/discount-waivers-list.html";
      } else {
        showToast("✅ Waiver created successfully");
        form.reset();
        invoiceHidden.value = "";
        patientHidden.value = "";
        setAddModeUI();
        toggleWaiverFields();
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Clear / Cancel Buttons
  ============================================================ */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountWaiverEditId");
    sessionStorage.removeItem("discountWaiverEditPayload");
    form.reset();
    invoiceHidden.value = "";
    patientHidden.value = "";
    setAddModeUI();
    toggleWaiverFields();
  });

  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountWaiverEditId");
    sessionStorage.removeItem("discountWaiverEditPayload");
    window.location.href = "/discount-waivers-list.html";
  });
}
