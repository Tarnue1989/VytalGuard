// 📁 add-feature-module.js – Init edit mode on add-feature-module.html

import { setupFeatureModuleFormSubmission } from "./feature-module-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js"; // secure fetch wrapper

// 🔐 Auth Guard – driven by backend permissions
const token = initPageGuard("feature_modules");
initLogoutWatcher(); // ✅ auto-redirect on logout (cross-tab safe)

// Shared ref
const sharedState = {
  currentEditIdRef: { value: null },
};

// 🧹 Reset form helper
function resetForm() {
  const form = document.getElementById("featureModuleForm");
  if (form) form.reset();
  sharedState.currentEditIdRef.value = null;

  document.getElementById("status_active")?.setAttribute("checked", true);
  document.getElementById("show_on_dashboard") && (document.getElementById("show_on_dashboard").checked = false);
}

/* -------------------- Load Parent Options -------------------- */
async function loadParentOptions(selectedId = null) {
  try {
    const res = await authFetch("/api/features/feature-modules/list");
    if (!res.ok) throw new Error(`Failed to load parent modules`);
    const data = await res.json();

    const parentSelect = document.getElementById("parent_id");
    if (!parentSelect) return;

    parentSelect.innerHTML = `<option value="">-- None (Top-level) --</option>`;
    (data.records || []).forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      if (selectedId && selectedId === m.id) opt.selected = true;
      parentSelect.appendChild(opt);
    });
  } catch (err) {
    console.error("❌ Failed to load parent module options:", err);
    showToast("❌ Could not load parent module options");
  }
}

// 🚀 Init
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("featureModuleForm");
  if (!form) return;

  // Hook up submission logic (UNCHANGED)
  setupFeatureModuleFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  // --- Handle edit mode ---
  const editId = sessionStorage.getItem("featureModuleEditId");
  const rawPayload = sessionStorage.getItem("featureModuleEditPayload");

  async function prefillForm(entry) {
    document.getElementById("name").value = entry.name || "";
    document.getElementById("key").value = entry.key || "";
    document.getElementById("icon").value = entry.icon || "";
    document.getElementById("category").value = entry.category || "";
    document.getElementById("description").value = entry.description || "";
    document.getElementById("route").value = entry.route || "";

    // ✅ NEW FIELDS
    document.getElementById("tenant_scope") && (document.getElementById("tenant_scope").value = entry.tenant_scope || "org");
    document.getElementById("order_index") && (document.getElementById("order_index").value = entry.order_index ?? 0);

    if (Array.isArray(entry.tags)) {
      document.getElementById("tags").value = entry.tags.join(", ");
    }

    if (entry.visibility) {
      document
        .getElementById(`visibility_${entry.visibility.toLowerCase()}`)
        ?.setAttribute("checked", true);
    }

    document.getElementById("enabled").checked = !!entry.enabled;

    if (entry.status) {
      document
        .getElementById(`status_${entry.status.toLowerCase()}`)
        ?.setAttribute("checked", true);
    }

    // ✅ DASHBOARD FIELDS
    if (document.getElementById("show_on_dashboard")) {
      document.getElementById("show_on_dashboard").checked = !!entry.show_on_dashboard;
    }
    if (document.getElementById("dashboard_type")) {
      document.getElementById("dashboard_type").value = entry.dashboard_type || "none";
    }
    if (document.getElementById("dashboard_order")) {
      document.getElementById("dashboard_order").value = entry.dashboard_order ?? 0;
    }

    await loadParentOptions(entry.parent_id);

    // Update UI
    document.querySelector(".card-title").textContent = "Edit Feature Module";
    form.querySelector("button[type=submit]").innerHTML = `
      <i class="ri-save-3-line me-1"></i> Update Module`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await prefillForm(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached module for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();

        // ✅ FIXED PATH (consistent)
        const res = await authFetch(`/api/features/feature-modules/${id}`);
        const result = await res.json();
        const entry = result?.data?.record || result?.data;

        if (!res.ok || !entry) {
          throw new Error(result.message || "❌ Failed to fetch feature module");
        }

        await prefillForm(entry);
      } catch (err) {
        console.error("❌ Failed to load feature module:", err);
        showToast(err.message || "❌ Failed to load module for editing");
      } finally {
        hideLoading();
      }
    } else {
      // Create mode → load parents only
      await loadParentOptions();
    }
  }
});
