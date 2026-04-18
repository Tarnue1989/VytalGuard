// 📦 add-cash-closing.js – Cash Closing Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors add-deposit.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Delegates ALL logic to cash-closing-form.js
// 🔹 NO API calls here
// ============================================================================

import { setupCashClosingForm } from "./cash-closing-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 AUTH GUARD
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["cash_closings:create"])
);
initLogoutWatcher();

/* ============================================================
   🌐 STATE
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM
============================================================ */
const form = document.getElementById("cashClosingForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 RESET
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // clear selects
  ["organizationSelect", "facilitySelect", "accountSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // reset title
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Close Cash Day";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-lock-line me-1"></i> Close Cash Day`;
}

/* ============================================================
   🚀 INIT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  setupCashClosingForm({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    window.location.href = "/cash-closing-list.html";
  });

  /* ---------------- Clear ---------------- */
  clearBtn?.addEventListener("click", () => {
    resetForm();
  });
});

/* ============================================================
   🔁 RESERVED
============================================================ */
export function syncRefsToState() {
  // reserved
}