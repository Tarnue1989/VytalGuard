// ============================================================================
// 🏢 VytalGuard – Organization Form Controller (Enterprise Master Pattern)
// 🔹 Mirrors consultation-main.js for consistent structure & secure lifecycle
// 🔹 Auth Guard + Logout Watcher + Prefill + Add/Edit unified flow
// 🔹 Preserves all existing IDs, field names, and linked behavior
// ============================================================================

import { setupOrganizationFormSubmission } from "./organization-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";

// 🔐 Auth Guard – auto-resolve backend permission (organizations:create/edit)
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference (consistent across modules)
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form (Back to Add Mode)
============================================================ */
function resetForm() {
  const form = document.getElementById("organizationForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Organization";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Organization`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("organizationForm");
  if (!form) return;

  // 🧩 Hook up unified submission logic
  setupOrganizationFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  // ============================================================
  // ✏️ Edit Mode Handling (Session or Query Param)
  // ============================================================
  const editId = sessionStorage.getItem("organizationEditId");
  const rawPayload = sessionStorage.getItem("organizationEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";

    if (entry.status) {
      const statusEl = document.getElementById(`status_${entry.status.toLowerCase()}`);
      if (statusEl) statusEl.checked = true;
    }

    // 🧭 Switch UI to edit mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Organization";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Organization`;
  }

  /* ============================================================
     1️⃣ Cached Edit Session Payload
  ============================================================ */
  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached organization for editing");
    }
  } else {
    /* ============================================================
       2️⃣ Fallback: ?id Query Parameter
    ============================================================ */
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/organizations/${id}`);
        const result = await res.json().catch(() => ({}));
        const entry = result?.data;

        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch organization");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load organization:", err);
        showToast(err.message || "❌ Failed to load organization for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear Buttons (if any present)
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("organizationEditId");
    sessionStorage.removeItem("organizationEditPayload");
    window.location.href = "/organizations-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("organizationEditId");
    sessionStorage.removeItem("organizationEditPayload");
    resetForm();
  });
});

// ============================================================================
// ✅ Enterprise Master Alignment Summary:
//    • Uses autoPagePermissionKey() for permission-aware guard
//    • Safe unified Add/Edit lifecycle with sharedState tracking
//    • Same lifecycle flow as consultation-main.js
//    • All field IDs, names, and UX structure preserved
// ============================================================================
