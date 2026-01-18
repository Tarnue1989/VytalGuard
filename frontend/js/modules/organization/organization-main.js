// ============================================================================
// 🏢 VytalGuard – Organization Main (Enterprise Master Pattern Aligned)
// 🔹 Mirrors consultation-main.js for full structural + behavioral parity
// 🔹 Keeps all existing IDs, field references, and HTML bindings
// 🔹 Integrates permission-driven auth guard, reset, visibility, and field selector
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupOrganizationFormSubmission } from "./organization-form.js";
import {
  FIELD_LABELS_ORGANIZATION,
  FIELD_ORDER_ORGANIZATION,
  FIELD_DEFAULTS_ORGANIZATION,
} from "./organization-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
// Automatically resolve correct permission ("organizations:create" / "organizations:edit")
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
const form = document.getElementById("organizationForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit session
  sessionStorage.removeItem("organizationEditId");
  sessionStorage.removeItem("organizationEditPayload");

  // Reset text inputs
  ["name", "code"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset default status radio
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Organization";
  const submitBtn = form?.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Organization`;
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("organizationFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("organizationFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/organizations-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("organizationEditId");
    sessionStorage.removeItem("organizationEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op placeholder)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initOrganizationModule() {
  showForm(); // auto-open form on dedicated add page

  setupOrganizationFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("organizationPanelVisible", "false");

  // Prefill when editing from list (cached or query)
  const editId = sessionStorage.getItem("organizationEditId");
  const rawPayload = sessionStorage.getItem("organizationEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";

    if (entry.status) {
      const radio = document.getElementById(
        `status_${entry.status.toLowerCase()}`
      );
      if (radio) radio.checked = true;
    }

    // Switch UI to Edit mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Organization";
    const submitBtn = form?.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Organization`;

    form?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  try {
    if (editId && rawPayload) {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } else {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) {
        sharedState.currentEditIdRef.value = id;
        const res = await fetch(`/api/organizations/${id}`);
        const data = await res.json().catch(() => ({}));
        const entry = data?.data;
        if (entry) await applyPrefill(entry);
      }
    }
  } catch (err) {
    console.error("❌ Organization prefill failed:", err);
    showToast("❌ Failed to load organization for editing");
  } finally {
    sessionStorage.removeItem("organizationEditId");
    sessionStorage.removeItem("organizationEditPayload");
    sessionStorage.removeItem("organizationEditFrom");
  }

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧩 Initialize Field Selector
  setupFieldSelector({
    module: "organization",
    fieldLabels: FIELD_LABELS_ORGANIZATION,
    fieldOrder: FIELD_ORDER_ORGANIZATION,
    defaultFields: FIELD_DEFAULTS_ORGANIZATION[role],
  });
}

/* ============================================================
   🔁 Sync Helper (Reserved for reactive integrations)
============================================================ */
export function syncRefsToState() {
  // reserved
}
