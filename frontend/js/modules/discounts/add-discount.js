// 📦 add-discount.js – Discount Form Page Controller (Enterprise MASTER Pattern)
// ============================================================================
// 🧭 Mirrors add-deposit.js / consultation-main.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to discount-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching here
// ============================================================================

import { setupDiscountFormSubmission } from "./discount-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["discounts:create", "discounts:edit"])
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
const form = document.getElementById("discountForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (Add Mode)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear cached edit state
  sessionStorage.removeItem("discountEditId");
  sessionStorage.removeItem("discountEditPayload");

  // Clear hidden IDs
  ["invoiceId", "invoiceItemId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear selects
  ["organizationSelect", "facilitySelect", "typeSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Hide reason field (edit-only)
  const reasonGroup = document
    .getElementById("reason")
    ?.closest(".form-group");
  if (reasonGroup) reasonGroup.classList.add("hidden");

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Discount";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Discount`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Wire form logic (ALL business logic lives there)
  setupDiscountFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("discountEditId");
    sessionStorage.removeItem("discountEditPayload");
    window.location.href = "/discounts-list.html";
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
