// 📁 add-feature-module.js – Secure Add/Edit Page Controller for Feature Modules
// ============================================================================
// 🧭 Mirrors add-patient.js architecture EXACTLY
// 🔹 Unified guard, edit-prefill, reset, cancel, clear
// 🔹 Session + URL edit resolution
// 🔹 100% ID retention for linked HTML
// ============================================================================

import { setupFeatureModuleFormSubmission } from "./feature-module-form.js";
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
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  const form = document.getElementById("featureModuleForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  [
    "parent_id",
    "tenant_scope",
    "dashboard_type",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document
    .querySelector('input[name="status"][value="active"]')
    ?.setAttribute("checked", true);

  document
    .querySelector('input[name="visibility"][value="public"]')
    ?.setAttribute("checked", true);

  document.getElementById("enabled") &&
    (document.getElementById("enabled").checked = true);

  document.getElementById("show_on_dashboard") &&
    (document.getElementById("show_on_dashboard").checked = false);

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Feature Module";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Module`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("featureModuleForm");
  if (!form) return;

  /* --------------------- Form Setup --------------------- */
  setupFeatureModuleFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill (Session → URL → API)
  ============================================================ */
  const editId = sessionStorage.getItem("featureModuleEditId");
  const rawPayload = sessionStorage.getItem("featureModuleEditPayload");

  async function applyPrefill(entry) {
    const fill = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val ?? "";
    };

    [
      "name",
      "key",
      "icon",
      "category",
      "description",
      "route",
      "tenant_scope",
    ].forEach((id) => fill(id, entry[id]));

    document.getElementById("order_index").value =
      entry.order_index ?? 0;

    document.getElementById("parent_id").value =
      entry.parent_id || "";

    if (Array.isArray(entry.tags)) {
      document.getElementById("tags").value =
        entry.tags.join(", ");
    }

    if (entry.visibility) {
      document
        .querySelector(
          `input[name="visibility"][value="${entry.visibility}"]`
        )
        ?.setAttribute("checked", true);
    }

    document.getElementById("enabled").checked =
      !!entry.enabled;

    if (entry.status) {
      document
        .querySelector(
          `input[name="status"][value="${entry.status}"]`
        )
        ?.setAttribute("checked", true);
    }

    document.getElementById("show_on_dashboard").checked =
      !!entry.show_on_dashboard;

    document.getElementById("dashboard_type").value =
      entry.dashboard_type || "none";

    document.getElementById("dashboard_order").value =
      entry.dashboard_order ?? 0;

    // UI title
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Feature Module";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Module`;
  }

  /* --------------------- Session First --------------------- */
  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error(err);
      showToast("❌ Could not load cached module");
    }
  } else {
    /* --------------------- URL Fallback --------------------- */
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(
          `/api/features/feature-modules/${id}`
        );
        const result = await res.json();
        const entry = result?.data?.record || result?.data;

        if (!res.ok || !entry)
          throw new Error(result?.message || "Load failed");

        await applyPrefill(entry);
      } catch (err) {
        console.error(err);
        showToast(err.message || "❌ Failed to load module");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("featureModuleEditId");
    sessionStorage.removeItem("featureModuleEditPayload");
    window.location.href = "/feature-module-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("featureModuleEditId");
    sessionStorage.removeItem("featureModuleEditPayload");
    resetForm();
  });
});
