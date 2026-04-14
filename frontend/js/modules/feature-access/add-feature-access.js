// 📁 add-feature-access.js – FINAL (CARD + PERMISSION READY)

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
import { loadPermissionsLite } from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form (ADD ONLY) — FIXED
============================================================ */
function resetForm() {
  const form = document.getElementById("featureAccessForm");
  if (!form) return;

  // 🔥 RESET FORM
  form.reset();

  // 🔥 VERY IMPORTANT → trigger FULL UI reset (modules + permissions)
  form.dispatchEvent(new Event("reset"));

  sharedState.currentEditIdRef.value = null;

  // reset selects
  ["organization_id", "role_id", "facility_id"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // reset status
  document.getElementById("status_active")?.click();

  // reset UI text
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Feature Access";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML =
      `<i class="ri-save-3-line me-1"></i> Save Access`;
  }
}

/* ============================================================
   🚀 INIT
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("featureAccessForm");
  if (!form) return;

  const editId =
    sessionStorage.getItem("featureAccessEditId") ||
    new URLSearchParams(window.location.search).get("id");

  const rawPayload = sessionStorage.getItem("featureAccessEditPayload");
  const isEdit = Boolean(editId);

  if (isEdit) {
    sharedState.currentEditIdRef.value = editId;
  }

  /* ================= INIT FORM ================= */
  await setupFeatureAccessFormSubmission({
    form,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ================= EDIT LOCK ================= */
  if (isEdit) {
    document.getElementById("addAllModulesBtn")?.setAttribute("disabled", true);
    document.getElementById("grantFullAccessBtn")?.setAttribute("disabled", true);

    document.getElementById("modulePreviewContainer")?.classList.add("d-none");
    document.getElementById("selectAllPreview")?.classList.add("d-none");
    document.getElementById("deselectAllPreview")?.classList.add("d-none");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  async function applyPrefill(entry) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };

    set("organization_id", entry.organization_id);
    set("role_id", entry.role_id);
    set("facility_id", entry.facility_id || "");

    document
      .getElementById(`status_${entry.status || "active"}`)
      ?.click();

    // 🔥 MODULE + PERMISSION PREFILL
    if (entry.modules && entry.permissions) {
      for (const mod of entry.modules) {
        const checkbox = document.querySelector(
          `.module-checkbox[data-id="${mod.id}"]`
        );

        if (checkbox) checkbox.checked = true;

        // trigger load
        checkbox?.dispatchEvent(new Event("change"));

        // wait small delay
        await new Promise((r) => setTimeout(r, 50));

        const perms = await loadPermissionsLite({ module: mod.key }, true);

        const state = window.moduleState?.[mod.id];
        if (!state) continue;

        state.permissions = perms.map((p) => ({
          key: p.key,
          checked: entry.permissions.includes(p.key),
        }));

        const box = document.getElementById(`perm_${mod.id}`);
        if (box) {
          box.classList.remove("d-none");

          box.innerHTML = state.permissions.map(p => `
            <div class="form-check">
              <input type="checkbox"
                class="form-check-input"
                data-key="${p.key}"
                ${p.checked ? "checked" : ""}
              >
              <label class="form-check-label">${p.key}</label>
            </div>
          `).join("");
        }
      }
    }

    // UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Feature Access";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Access`;
    }
  }

  /* ============================================================
     📦 LOAD EDIT DATA
  ============================================================ */
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
      console.error(err);
      showToast(err.message || "❌ Failed to load");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🚪 CANCEL
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("featureAccessEditId");
    sessionStorage.removeItem("featureAccessEditPayload");
    window.location.href = "/feature-access-list.html";
  });

  /* ============================================================
     🧹 CLEAR (ADD ONLY)
  ============================================================ */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    if (isEdit) return;
    resetForm();
  });
});