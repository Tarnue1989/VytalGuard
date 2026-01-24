// 📦 delivery-record-main.js – Delivery Record Form Page Controller (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Mirrors ekg-record-main.js / add-registration-log.js / department-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Form visibility & reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to delivery-record-form.js
// ❌ NO API calls
// ❌ NO dropdown loading
// ❌ NO suggestion logic
// ============================================================================

import { setupDeliveryRecordFormSubmission } from "./delivery-record-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["delivery_records:create", "delivery_records:edit"])
);
initLogoutWatcher();

/* ============================================================
   🌐 Shared State (Enterprise Pattern)
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("deliveryRecordForm");
const formContainer = document.getElementById("formContainer");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (Add Mode – MASTER PARITY)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear cached edit state
  sessionStorage.removeItem("deliveryRecordEditId");
  sessionStorage.removeItem("deliveryRecordEditPayload");

  // Clear hidden + select fields
  [
    "patientId",
    "doctorId",
    "midwifeId",
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "consultationSelect",
    "billableItemSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset emergency flag
  const emergency = document.getElementById("isEmergency");
  if (emergency) emergency.checked = false;

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Delivery Record";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Create Delivery Record`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Delegate ALL business logic to form module
  setupDeliveryRecordFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("deliveryRecordEditId");
    sessionStorage.removeItem("deliveryRecordEditPayload");
    window.location.href = "/delivery-records-list.html";
  });

  /* ---------------- Clear ---------------- */
  clearBtn?.addEventListener("click", () => {
    resetForm();
  });
});

/* ============================================================
   🔁 Reserved Sync Hook (Future)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive form syncing
}
