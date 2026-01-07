// 📁 add-refundDeposit.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors add-deposit.js & add-refund.js, but for DEPOSIT REFUNDS ONLY
// 🔹 Uses refundable deposit balance (remaining_balance from backend)
// 🔹 Works with refund-deposits-form.js actions
// 🔹 RBAC-aware org/facility visibility
// 🔹 Session-aware edit mode
// ============================================================================

import { setupRefundDepositFormSubmission } from "./refund-deposits-form.js";
import {
  showToast,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepositsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Logout Watch
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["refund-deposits:create", "refund-deposits:edit"])
);
initLogoutWatcher();

/* ============================================================
   🧩 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form
============================================================ */
function resetForm() {
  const form = document.getElementById("refundDepositForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  ["patientId", "depositId", "organizationSelect", "facilitySelect"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
  );

  const amt = document.getElementById("refund_amount");
  if (amt) amt.removeAttribute("max");

  document.querySelector(".card-title").textContent = "Add Deposit Refund";
  form.querySelector("button[type=submit]").innerHTML =
    `<i class="ri-add-line me-1"></i> Add Refund`;
}

/* ============================================================
   🚀 Init on DOM Ready
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("refundDepositForm");
  if (!form) return;

  /* ------------------------------------------------------------
     DOM References
  ------------------------------------------------------------ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const depositInput = document.getElementById("depositInput");
  const depositHidden = document.getElementById("depositId");

  const amountInput = document.getElementById("refund_amount");
  const methodSelect = document.getElementById("methodSelect");
  const reasonInput = document.getElementById("reason");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🏢 1. ORGANIZATIONS
  ============================================================ */
  if (userRole.includes("super")) {
    try {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        orgSelect,
        orgs,
        "id",
        "name",
        "-- Select Organization --"
      );
    } catch {
      showToast("❌ Failed to load organizations");
    }
  } else {
    orgSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
     🏭 2. FACILITIES
  ============================================================ */
  async function reloadFacilities(orgId = null) {
    try {
      const facs = await loadFacilitiesLite(
        orgId ? { organization_id: orgId } : {},
        true
      );
      setupSelectOptions(
        facSelect,
        facs,
        "id",
        "name",
        "-- Select Facility --"
      );
    } catch {
      showToast("❌ Failed to load facilities");
    }
  }

  if (userRole.includes("super")) {
    orgSelect.addEventListener("change", async () => {
      await reloadFacilities(orgSelect.value || null);
    });
  } else if (userRole.includes("admin")) {
    await reloadFacilities();
  } else {
    facSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
     👥 3. PATIENT → LOAD DEPOSITS (ADD MODE)
  ============================================================ */
  setupSuggestionInputDynamic(
    patientInput,
    patientSuggestions,
    "/api/lite/patients",
    async (selected) => {
      patientHidden.value = selected?.id || "";
      depositHidden.value = "";
      depositInput.value = "";

      if (!selected) {
        setupSelectOptions(
          depositInput,
          [],
          "id",
          "label",
          "-- Select Deposit --"
        );
        return;
      }

      patientInput.value =
        selected.label ||
        `${selected.pat_no || ""} ${selected.full_name || ""}`.trim();

      const deposits = await loadDepositsLite({
        patient_id: selected.id,
      });

      const readableDeposits = deposits.map((d) => ({
        ...d,
        label: `Deposit ${d.transaction_ref} — Amount ${d.amount} — Balance ${d.remaining_balance} — ${d.method?.toUpperCase() ?? ""}`,
      }));

      setupSelectOptions(depositInput, readableDeposits, "id", "label");

      depositInput.onchange = () => {
        const dep = readableDeposits.find(
          (d) => d.id === depositInput.value
        );

        if (!dep) {
          amountInput.value = "";
          methodSelect.value = "";
          amountInput.removeAttribute("max");
          return;
        }

        depositHidden.value = dep.id;
        methodSelect.value = dep.method || "";

        const bal = Number(dep.remaining_balance ?? 0);
        amountInput.value = bal.toFixed(2);
        amountInput.max = bal.toFixed(2);
      };
    },
    "label"
  );

  /* ============================================================
     🧾 4. Attach Submission Logic
  ============================================================ */
  setupRefundDepositFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ 5. EDIT MODE PREFILL (FIXED)
  ============================================================ */
  const editId = sessionStorage.getItem("refundDepositEditId");
  const rawPayload = sessionStorage.getItem("refundDepositEditPayload");

  async function applyPrefill(entry) {
    try {
      if (entry.organization_id && orgSelect) {
        orgSelect.value = entry.organization_id;
        await reloadFacilities(entry.organization_id);
      }
      if (entry.facility_id && facSelect) {
        facSelect.value = entry.facility_id;
      }

      /* ===========================
        PATIENT PREFILL (FIXED)
      =========================== */
      if (entry.patient) {
        let patientLabel = "";
        let patientId = "";

        if (typeof entry.patient === "string") {
          // Case 1: backend already formatted
          patientLabel = entry.patient;
          patientId = entry.patient_id || "";
        } else if (typeof entry.patient === "object") {
          // Case 2: backend returned object
          patientLabel =
            entry.patient.label ||
            `${entry.patient.pat_no || ""} - ${entry.patient.full_name || ""}`.trim();

          patientId = entry.patient.id || entry.patient_id || "";
        }

        patientInput.value = patientLabel;
        patientHidden.value = patientId;

        // Load deposits for that patient
        if (patientId) {
          const deposits = await loadDepositsLite({
            patient_id: patientId,
          });

          const readableDeposits = deposits.map((d) => ({
            ...d,
            label: `Deposit ${d.transaction_ref} — Amount ${d.amount} — Balance ${d.remaining_balance} — ${d.method?.toUpperCase() ?? ""}`,
          }));

          setupSelectOptions(depositInput, readableDeposits, "id", "label");

          depositInput.value = entry.deposit_id;
          depositHidden.value = entry.deposit_id;

          const dep = readableDeposits.find((d) => d.id === entry.deposit_id);
          if (dep) {
            amountInput.max = Number(dep.remaining_balance).toFixed(2);
          }
        }
      }

      amountInput.value = Number(entry.refund_amount).toFixed(2);
      methodSelect.value = entry.method || "";
      reasonInput.value = entry.reason || "";

      document.querySelector(".card-title").textContent =
        "Edit Deposit Refund";
      form.querySelector("button[type=submit]").innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Refund`;
    } catch (err) {
      console.error("❌ Prefill failed:", err);
      showToast("❌ Could not load refund for editing");
    }
  }

  if (editId && rawPayload) {
    try {
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(JSON.parse(rawPayload));
    } catch {}
  }

  /* ============================================================
     🚪 6. Cancel & Clear Buttons
  ============================================================ */
  document
    .getElementById("cancelRefundDepositBtn")
    ?.addEventListener("click", () => {
      sessionStorage.removeItem("refundDepositEditId");
      sessionStorage.removeItem("refundDepositEditPayload");
      window.location.href = "/refund-deposits-list.html";
    });

  document
    .getElementById("clearRefundDepositBtn")
    ?.addEventListener("click", () => {
      resetForm();
      amountInput.removeAttribute("max");
      depositHidden.value = "";
      patientHidden.value = "";
    });
});
