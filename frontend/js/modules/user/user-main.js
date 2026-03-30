// 📦 user-main.js – MASTER UPGRADE (ROLE PARITY)
// ============================================================================
// 🔹 Matches role-main.js EXACTLY
// 🔹 Ensures form always initialized
// 🔹 Clean visibility + reset lifecycle
// 🔹 Field selector aligned
// 🔹 Preserves ALL IDs + behavior
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupUserFormSubmission } from "./user-form.js";

import {
  FIELD_LABELS_USER,
  FIELD_ORDER_USER,
  FIELD_DEFAULTS_USER,
} from "./user-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 AUTH GUARD + GLOBAL STATE
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM REFS
============================================================ */
const form = document.getElementById("userForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 RESET FORM (MASTER)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  form?.reset();

  sessionStorage.removeItem("userEditId");
  sessionStorage.removeItem("userEditPayload");

  ["username", "email", "first_name", "last_name", "password"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["organization_id", "facility_id", "role_id"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById("status_active")?.setAttribute("checked", true);
}

/* ============================================================
   🧭 FORM VISIBILITY
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("userFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("userFormVisible", "false");
}

// expose globally (same as role)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 BUTTONS
============================================================ */
cancelBtn &&
  (cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/users-list.html";
  });

clearBtn && (clearBtn.onclick = resetForm);

desktopAddBtn &&
  (desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("userEditId");
    sessionStorage.removeItem("userEditPayload");

    resetForm();
    showForm();
  });

/* ============================================================
   🧰 LOADER (NO-OP)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 INIT (MASTER)
============================================================ */
export async function initUser() {
  /* -------- restore visibility -------- */
  localStorage.getItem("userFormVisible") === "true"
    ? showForm()
    : hideForm();

  /* -------- ALWAYS INIT FORM (🔥 FIX) -------- */
  form &&
    setupUserFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });

  localStorage.setItem("userPanelVisible", "false");

  /* -------- role normalization -------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* -------- field selector -------- */
  setupFieldSelector({
    module: "user",
    fieldLabels: FIELD_LABELS_USER,
    fieldOrder: FIELD_ORDER_USER,
    defaultFields: FIELD_DEFAULTS_USER[role],
  });
}

/* ============================================================
   🔁 SYNC (RESERVED)
============================================================ */
export function syncRefsToState() {}