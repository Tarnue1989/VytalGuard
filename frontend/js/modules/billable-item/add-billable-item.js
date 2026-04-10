// 📁 add-billable-item-main.js – Billable Item Form Page Controller (MASTER-ALIGNED)
// ============================================================================
// 🧭 EXACT parity with prescription-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination (SESSION-DRIVEN)
// 🔹 Delegates ALL business logic to billable-item-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching here
// ============================================================================

import { setupBillableItemFormSubmission } from "./billable-item-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["billable_items:create", "billable_items:update"])
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
const form = document.getElementById("billableItemForm");
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
  sessionStorage.removeItem("billableItemEditId");
  sessionStorage.removeItem("billableItemEditPayload");

  // Clear suggestion inputs (dataset + value)
  [
    "masterItemSearch"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dataset.value = "";
    }
  });

  // Clear selects
  ["departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset price pills UI
  const pillsContainer = document.getElementById("pricePillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML =
      `<p class="text-muted">No prices added yet.</p>`;

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Billable Item";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Save Item`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  /* ------------------------------------------------------------
     🧠 SESSION-DRIVEN EDIT COORDINATION (MASTER)
  ------------------------------------------------------------ */
  const editId = sessionStorage.getItem("billableItemEditId");
  if (editId) {
    sharedState.currentEditIdRef.value = editId;
  }

  /* ------------------------------------------------------------
     🔗 Wire Form Logic (ALL business logic in form file)
  ------------------------------------------------------------ */
  setupBillableItemFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("billableItemEditId");
    sessionStorage.removeItem("billableItemEditPayload");
    window.location.href = "/billable-items-list.html";
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
  // Reserved for enterprise reactive syncing
}