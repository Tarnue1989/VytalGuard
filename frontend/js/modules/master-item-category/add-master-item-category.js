// 📦 add-master-item-category.js – Master Item Category Form Page Controller
// ============================================================================
// 🔥 FINAL (ORDER TYPE SUPPORT ADDED)
// ============================================================================

import { setupMasterItemCategoryFormSubmission } from "./master-item-category-form.js";

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("masterItemCategoryForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (FIXED)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  sessionStorage.removeItem("masterItemCategoryEditId");
  sessionStorage.removeItem("masterItemCategoryEditPayload");

  // 🔥 FIXED: include orderType
  ["organizationSelect", "facilitySelect", "orderType"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default status → active
  document.getElementById("status_active")?.setAttribute("checked", true);

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Master Item Category";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Category`;
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  setupMasterItemCategoryFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("masterItemCategoryEditId");
    sessionStorage.removeItem("masterItemCategoryEditPayload");
    window.location.href = "/master-item-categories-list.html";
  });

  /* ---------------- Clear ---------------- */
  clearBtn?.addEventListener("click", () => {
    resetForm();
  });
});

/* ============================================================
   🔁 Reserved Sync Hook
============================================================ */
export function syncRefsToState() {
  // reserved
}