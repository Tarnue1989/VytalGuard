// 📦 vital-main.js – Vital Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Master Pattern: department-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Form reset & edit session orchestration
// 🔹 Delegates ALL business logic to vital-form.js
// 🔹 NO dropdown logic here (prevents double-init bugs)
// ============================================================================

import { setupVitalFormSubmission } from "./vital-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard("vitals");
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
const form = document.getElementById("vitalForm");
const formContainer = document.getElementById("formContainer");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (Add Mode)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  sessionStorage.removeItem("vitalEditId");
  sessionStorage.removeItem("vitalEditPayload");

  // Clear hidden + select fields
  [
    "patientId",
    "nurseId",
    "organizationSelect",
    "facilitySelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Vital";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Vital`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // 🔗 Wire form logic (ALL business logic lives in vital-form.js)
  setupVitalFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("vitalEditId");
    sessionStorage.removeItem("vitalEditPayload");
    window.location.href = "/vitals-list.html";
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
