// 📁 insurance-claim-form.js – FINAL (FULL FIXED MASTER PARITY)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";
import { loadInsuranceProvidersLite } from "../../utils/data-loaders.js";
import {
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadInvoicesLite, // ✅ ADDED
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { INSURANCE_CLAIM_FORM_RULES } from "./insurance-claims.form.rules.js";

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

function normalizeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/* ============================================================
   🚀 MAIN (FINAL — ENTERPRISE FLOW)
============================================================ */
export async function setupInsuranceClaimFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const claimId =
    sessionStorage.getItem("insuranceClaimEditId") || getQueryParam("id");

  const isEdit = Boolean(claimId);

  /* ================= UI MODE ================= */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Edit Insurance Claim" : "Add Insurance Claim";

    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Claim`
          : `<i class="ri-add-line me-1"></i> Add Claim`;
  };

  setUI(isEdit ? "edit" : "add");

  /* ================= DOM ================= */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const providerSelect = document.getElementById("providerSelect");
  const invoiceSelect = document.getElementById("invoiceSelect");

  const claimNumberInput = document.getElementById("claimNumber");
  const amountClaimedInput = document.getElementById("amountClaimed");
  const amountApprovedInput = document.getElementById("amountApproved");
  const amountPaidInput = document.getElementById("amountPaid");

  const currencySelect = document.getElementById("currencySelect");
  const paymentRefInput = document.getElementById("paymentReference");
  const rejectionReasonInput = document.getElementById("rejectionReason");
  const notesInput = document.getElementById("notes");

  /* ================= ROLE ================= */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ================= INIT STATES ================= */
  invoiceSelect.disabled = true;

  /* ================= LOADERS ================= */
  try {
    if (isSuper) {
        // 🔥 LOAD ORGANIZATIONS (FIX)
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite({}, true),
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

    /* ================= PROVIDERS ================= */
    setupSelectOptions(
      providerSelect,
      await loadInsuranceProvidersLite(),
      "id",
      "label",
      "-- Select Provider --"
    );

    /* ================= PATIENT → INVOICES ================= */
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value = selected?.label || "";

        // 🔥 RESET DEPENDENCIES
        invoiceSelect.innerHTML = "";
        invoiceSelect.disabled = true;

        providerSelect.value = "";
        currencySelect.value = "";
        currencySelect.disabled = false;

        amountClaimedInput.value = "";

        if (!selected?.id) return;

        try {
          const res = await authFetch(
            `/api/lite/invoices?patient_id=${selected.id}`
          );
          const data = await res.json().catch(() => ({}));
          const invoices = data?.data?.records || [];

          if (!invoices.length) {
            setupSelectOptions(
              invoiceSelect,
              [
                {
                  id: "",
                  label: "⚠ No invoices found for selected patient",
                  disabled: true,
                },
              ],
              "id",
              "label"
            );
            return;
          }

          const opts = invoices.map((inv) => ({
            id: inv.id,
            label: inv.label,
          }));

          setupSelectOptions(
            invoiceSelect,
            opts,
            "id",
            "label",
            "-- Select Invoice --"
          );

          invoiceSelect.disabled = false;

        } catch {
          showToast("❌ Failed to load invoices");
        }
      },
      "label"
    );

    /* ================= INVOICE → AUTO FILL ================= */
    invoiceSelect.addEventListener("change", async () => {
      const invoiceId = invoiceSelect.value;
      if (!invoiceId) return;

      try {
        const res = await authFetch(`/api/invoices/${invoiceId}`);
        const data = await res.json().catch(() => ({}));
        const inv = data?.data;

        if (!inv) return;

        // 🔥 provider
        if (inv.provider_id) {
          providerSelect.value = inv.provider_id;
          providerSelect.disabled = true;
        }
        // 🔥 currency
        if (inv.currency && currencySelect) {
          currencySelect.value = inv.currency;
          currencySelect.disabled = true;
        }

        // 🔥 amount
      let invoiceTotal = inv.total_amount || 0;

      if (invoiceTotal) {
        amountClaimedInput.value = invoiceTotal;
      }

      amountClaimedInput.oninput = () => {
        const val = Number(amountClaimedInput.value);

        if (val > invoiceTotal) {
          showToast("❌ Amount cannot exceed invoice total");
          amountClaimedInput.value = invoiceTotal;
        }
      };
      } catch {}
    });

    /* ================= CLEAR INPUT ================= */
    patientInput.oninput = () => {
      if (!patientInput.value) {
        patientHidden.value = "";

        invoiceSelect.innerHTML = "";
        invoiceSelect.disabled = true;

        providerSelect.value = "";
        providerSelect.disabled = false;
        currencySelect.value = "";
        currencySelect.disabled = false;

        amountClaimedInput.value = "";
      }
    };

  } catch {
    showToast("❌ Failed to load reference data");
  }

  /* ================= EDIT PREFILL ================= */
  if (isEdit && claimId) {
    try {
      showLoading();

      const res = await authFetch(`/api/insurance-claims/${claimId}`);
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(normalizeMessage(result, "Failed to load claim"));

      const entry = result?.data;
      if (!entry) return;

      patientHidden.value = entry.patient_id || "";

      patientInput.value = [
        entry.patient?.first_name,
        entry.patient?.middle_name,
        entry.patient?.last_name,
      ].filter(Boolean).join(" ");

      providerSelect.value = entry.provider_id || "";

      claimNumberInput.value = entry.claim_number || "";
      amountClaimedInput.value = entry.amount_claimed || "";
      amountApprovedInput.value = entry.amount_approved || "";
      amountPaidInput.value = entry.amount_paid || "";
      currencySelect.value = entry.currency || "";

      paymentRefInput.value = entry.payment_reference || "";
      rejectionReasonInput.value = entry.rejection_reason || "";
      notesInput.value = entry.notes || "";

      setUI("edit");

    } catch (err) {
      showToast(err.message || "❌ Could not load claim");
    } finally {
      hideLoading();
    }
  }

  /* ================= SUBMIT ================= */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of INSURANCE_CLAIM_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || el.closest(".hidden")) continue;

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
      patient_id: normalizeUUID(patientHidden.value),
      provider_id: normalizeUUID(providerSelect.value),
      invoice_id: normalizeUUID(invoiceSelect.value),
      claim_number: claimNumberInput.value || null,
      currency: currencySelect.value || null,
      amount_claimed: normalizeNumber(amountClaimedInput.value),
      amount_approved: normalizeNumber(amountApprovedInput.value),
      amount_paid: normalizeNumber(amountPaidInput.value),
      payment_reference: paymentRefInput.value || null,
      rejection_reason: rejectionReasonInput.value || null,
      notes: notesInput.value || null,
    };

    if (isSuper) {
      const orgId = normalizeUUID(orgSelect?.value);
      const facId = normalizeUUID(facSelect?.value);
      if (orgId) payload.organization_id = orgId;
      if (facId) payload.facility_id = facId;
    }

    try {
      showLoading();

      const res = await authFetch(
        isEdit
          ? `/api/insurance-claims/${claimId}`
          : `/api/insurance-claims`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      showToast(isEdit ? "✅ Claim updated" : "✅ Claim created");

      sessionStorage.removeItem("insuranceClaimEditId");
      window.location.href = "/insurance-claims-list.html";

    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ================= CANCEL / CLEAR ================= */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/insurance-claims-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    patientHidden.value = "";
    setUI("add");
  });
}