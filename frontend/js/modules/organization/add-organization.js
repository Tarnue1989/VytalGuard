// ============================================================================
// 🏢 VytalGuard – Organization Form Controller (Enterprise Master Pattern)
// 🔹 FULL PARITY with add-role.js / consultation-main.js
// 🔹 Unified auth guard + logout watcher
// 🔹 Delegates ALL business logic to organization-form.js
// 🔹 Handles edit-prefill (cache + API fallback)
// 🔹 Preserves ALL existing HTML IDs, routes, and behaviors
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

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
// Auto-resolve permission: organizations:create / organizations:edit
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper (MASTER SAFE)
============================================================ */
function resetForm() {
  const form = document.getElementById("organizationForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  sessionStorage.removeItem("organizationEditId");
  sessionStorage.removeItem("organizationEditPayload");

  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Organization";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Organization`;
}

/* ============================================================
   🚀 Main Init (DOM READY)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("organizationForm");
  if (!form) return;

  /* ==========================================================
     🧾 Form Setup (ALL LOGIC DELEGATED)
  ========================================================== */
  setupOrganizationFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ==========================================================
     ✏️ Edit Mode Prefill (CACHE → API FALLBACK)
  ========================================================== */
  const editId = sessionStorage.getItem("organizationEditId");
  const rawPayload = sessionStorage.getItem("organizationEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";

    if (entry.status) {
      document
        .getElementById(`status_${entry.status.toLowerCase()}`)
        ?.setAttribute("checked", true);
    }

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Organization";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Organization`;
  }

  // 1️⃣ Cached payload
  if (editId && rawPayload) {
    try {
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(JSON.parse(rawPayload));
    } catch (err) {
      console.error("❌ Cached organization load failed:", err);
      showToast("❌ Could not load cached organization");
    }
  } else {
    // 2️⃣ Query param fallback
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/organizations/${id}`);
        const result = await res.json().catch(() => ({}));

        if (!res.ok || !result?.data)
          throw new Error(result.message || "Failed to load organization");

        await applyPrefill(result.data);
      } catch (err) {
        console.error("❌ Failed to load organization:", err);
        showToast(err.message || "❌ Failed to load organization");
      } finally {
        hideLoading();
      }
    }
  }

  /* ==========================================================
     🚪 Cancel / Clear
  ========================================================== */
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
// ✅ Enterprise Master Alignment Summary
//    • Mirrors add-role.js lifecycle exactly
//    • Delegates validation & submission to organization-form.js
//    • Cache-first edit prefill with API fallback
//    • Permission-aware auth guard via autoPagePermissionKey()
//    • ZERO ID, route, or behavior drift
// ============================================================================
