// 📦 add-supplier.js – Supplier Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors department-main.js responsibilities EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Delegates ALL business logic to supplier-form.js
// ============================================================================

import { setupSupplierFormSubmission } from "./supplier-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("supplierForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  sessionStorage.removeItem("supplierEditId");
  sessionStorage.removeItem("supplierEditPayload");

  // Clear selects
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default status = active
  document.getElementById("status_active")?.setAttribute("checked", true);
}

/* ============================================================
   🧭 Form Show / Hide (DEPARTMENT PATTERN)
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
}

// 🔗 Expose globally (actions / hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🚀 Init Entrypoint
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // ✅ ALWAYS show form (EXACTLY like Department)
  showForm();

  // Wire form logic (ALL business logic lives in supplier-form.js)
  setupSupplierFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    resetForm();
    window.location.href = "/suppliers-list.html";
  });

  /* ---------------- Clear ---------------- */
  clearBtn?.addEventListener("click", () => {
    resetForm();
  });

  /* ---------------- Desktop Add ---------------- */
  desktopAddBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("supplierEditId");
    sessionStorage.removeItem("supplierEditPayload");
    resetForm();
    showForm();
  });
});

/* ============================================================
   🔁 Reserved Sync Hook (Future)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive form syncing
}
