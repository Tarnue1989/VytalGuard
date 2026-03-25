// 📦 order-main.js – Order Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🔹 Lab Request → Order Adaptation (FULL MASTER PARITY)
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Session-driven edit coordination
// 🔹 Delegates ALL business logic to order-form.js
// ============================================================================

import { setupOrderFormSubmission } from "./order-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["orders:create", "orders:edit"])
);
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM
============================================================ */
const form = document.getElementById("orderForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 RESET
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  sessionStorage.removeItem("orderEditId");
  sessionStorage.removeItem("orderEditPayload");

  [
    "patientSearch",
    "providerSearch",
    "consultationSearch",
    "registrationLogSearch",
    "orderItemSearch",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dataset.value = "";
    }
  });

  ["departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const pillsContainer = document.getElementById("orderPillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML =
      `<p class="text-muted">No order items added yet.</p>`;

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Order";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Submit Order`;
}

/* ============================================================
   🚀 INIT
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  const editId = sessionStorage.getItem("orderEditId");
  if (editId) {
    sharedState.currentEditIdRef.value = editId;
  }

  setupOrderFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("orderEditId");
    sessionStorage.removeItem("orderEditPayload");
    window.location.href = "/orders-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    resetForm();
  });
});

/* ============================================================
   🔁 RESERVED
============================================================ */
export function syncRefsToState() {}