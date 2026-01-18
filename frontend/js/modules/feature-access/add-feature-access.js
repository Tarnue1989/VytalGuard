// 📁 add-feature-access.js – Secure Add/Edit Page Controller for Feature Access
// ============================================================================
// 🧭 Mirrors add-feature-module.js architecture EXACTLY
// 🔹 Unified guard, edit-prefill, reset, cancel, clear
// 🔹 Session + URL edit resolution
// 🔹 Edit-mode lockdown for bulk actions
// 🔹 100% ID retention for linked HTML
// ============================================================================

import { setupFeatureAccessFormSubmission } from "./feature-access-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper (ADD MODE ONLY)
============================================================ */
function resetForm() {
  const form = document.getElementById("featureAccessForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Explicit dropdown clears
  ["organization_id", "role_id", "module_id", "facility_id"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default radio
  document.getElementById("status_active")?.click();

  // Reset title + button
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Feature Access";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML =
      `<i class="ri-save-3-line me-1"></i> Save Access`;
  }
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("featureAccessForm");
  if (!form) return;

  /* ----------------------------------------------------------
     ✏️ Detect Edit Mode (Session → URL)
  ----------------------------------------------------------- */
  const editId =
    sessionStorage.getItem("featureAccessEditId") ||
    new URLSearchParams(window.location.search).get("id");

  const rawPayload = sessionStorage.getItem("featureAccessEditPayload");
  const isEdit = Boolean(editId);

  if (isEdit) {
    sharedState.currentEditIdRef.value = editId;
  }

  /* ----------------------------------------------------------
     📦 Init Form Logic (dropdowns + submit)
  ----------------------------------------------------------- */
  await setupFeatureAccessFormSubmission({
    form,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ----------------------------------------------------------
     🔒 EDIT MODE LOCKDOWN
  ----------------------------------------------------------- */
  if (isEdit) {
    // Disable bulk buttons
    document.getElementById("addAllModulesBtn")?.setAttribute("disabled", true);
    document
      .getElementById("grantFullAccessBtn")
      ?.setAttribute("disabled", true);

    // Hide bulk preview controls
    document
      .getElementById("modulePreviewContainer")
      ?.classList.add("d-none");
    document.getElementById("selectAllPreview")?.classList.add("d-none");
    document.getElementById("deselectAllPreview")?.classList.add("d-none");
  }

  /* ----------------------------------------------------------
     ✏️ Prefill Helper (EDIT MODE)
  ----------------------------------------------------------- */
  async function applyPrefill(entry) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };

    set("organization_id", entry.organization_id);
    set("role_id", entry.role_id);
    set("module_id", entry.module_id);
    set("facility_id", entry.facility_id || "");

    document
      .getElementById(`status_${entry.status || "active"}`)
      ?.click();

    // UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Feature Access";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Access`;
    }
  }

  /* ----------------------------------------------------------
     📦 Load Edit Data (Session → API)
  ----------------------------------------------------------- */
  if (isEdit) {
    try {
      let entry = null;

      if (rawPayload) {
        entry = JSON.parse(rawPayload);
      } else {
        showLoading();
        const res = await authFetch(
          `/api/features/feature-access/${editId}`
        );
        const result = await res.json();

        if (!res.ok || !result?.data) {
          throw new Error(
            result?.message || "Failed to load feature access"
          );
        }

        entry = result.data;
      }

      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Feature access edit load failed:", err);
      showToast(err.message || "❌ Failed to load feature access");
    } finally {
      hideLoading();
    }
  }

  /* ----------------------------------------------------------
     🚪 Cancel
  ----------------------------------------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("featureAccessEditId");
    sessionStorage.removeItem("featureAccessEditPayload");
    window.location.href = "/feature-access-list.html";
  });

  /* ----------------------------------------------------------
     🧹 Clear (ADD MODE ONLY)
  ----------------------------------------------------------- */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    if (isEdit) return;
    resetForm();
  });
});
