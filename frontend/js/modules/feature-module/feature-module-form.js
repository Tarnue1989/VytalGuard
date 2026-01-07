// 📁 feature-module-form.js – Handles add/edit form for Feature Module

import {
  showToast,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";

/* ============================================================
   🔎 HELPERS
   ============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
  if (msg?.detail) return msg.detail;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

/* ============================================================
   📌 LOAD PARENT MODULES (TOP-LEVEL ONLY)
   ============================================================ */
async function loadParentModules() {
  try {
    const res = await authFetch("/api/features/feature-modules");
    let result = {};
    try { result = await res.json(); } catch {}

    const modules = result?.data?.records || [];
    const parentSelect = document.getElementById("parent_id");
    if (!parentSelect) return;

    parentSelect.innerHTML = `<option value="">-- None (Top-level) --</option>`;

    modules
      .filter(m => !m.parent_id)
      .forEach(m => {
        parentSelect.insertAdjacentHTML(
          "beforeend",
          `<option value="${m.id}">${m.name}</option>`
        );
      });
  } catch (err) {
    console.error("❌ Failed to load parent modules:", err);
    showToast("❌ Could not load parent module list");
  }
}

/* ============================================================
   🎛️ DASHBOARD FIELD TOGGLE
   ============================================================ */
function toggleDashboardFields(show) {
  const typeEl = document.getElementById("dashboard_type")?.closest(".col-xxl-3");
  const orderEl = document.getElementById("dashboard_order")?.closest(".col-xxl-3");

  if (typeEl) typeEl.style.display = show ? "" : "none";
  if (orderEl) orderEl.style.display = show ? "" : "none";
}

/* ============================================================
   🚀 INIT FORM
   ============================================================ */
export async function setupFeatureModuleFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("featureModuleEditId");
  const queryId = getQueryParam("id");
  const moduleId = sessionId || queryId;
  const isEdit = !!moduleId;

  /* ================= UI TITLES ================= */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  if (titleEl && submitBtn) {
    titleEl.textContent = isEdit ? "Edit Feature Module" : "Add Feature Module";
    submitBtn.innerHTML = isEdit
      ? `<i class="ri-save-3-line me-1"></i> Update Module`
      : `<i class="ri-add-line me-1"></i> Add Module`;
  }

  /* ================= LOAD DEPENDENCIES ================= */
  await loadParentModules();

  /* ================= PREFILL (EDIT MODE) ================= */
  if (isEdit) {
    let entry = null;
    try {
      const raw = sessionStorage.getItem("featureModuleEditPayload");
      if (raw) entry = JSON.parse(raw);

      if (!entry) {
        showLoading();
        const res = await authFetch(`/api/features/feature-modules/${moduleId}`);
        let result = {};
        try { result = await res.json(); } catch {}
        entry = result?.data?.record || result?.data;
        if (!res.ok || !entry) {
          throw new Error(normalizeMessage(result, "❌ Failed to load module"));
        }
      }

      document.getElementById("name").value = entry.name || "";
      document.getElementById("key").value = entry.key || "";
      document.getElementById("icon").value = entry.icon || "";
      document.getElementById("category").value = entry.category || "";
      document.getElementById("description").value = entry.description || "";
      document.getElementById("route").value = entry.route || "";
      document.getElementById("parent_id").value = entry.parent_id || "";
      document.getElementById("tenant_scope").value = entry.tenant_scope || "org";
      document.getElementById("order_index").value = entry.order_index ?? 0;

      if (Array.isArray(entry.tags)) {
        document.getElementById("tags").value = entry.tags.join(", ");
      }

      if (entry.visibility) {
        document.getElementById(`visibility_${entry.visibility}`)?.setAttribute("checked", true);
      }

      document.getElementById("enabled").checked = !!entry.enabled;

      if (entry.status) {
        document.getElementById(`status_${entry.status}`)?.setAttribute("checked", true);
      }

      document.getElementById("show_on_dashboard").checked = !!entry.show_on_dashboard;
      document.getElementById("dashboard_type").value = entry.dashboard_type || "none";
      document.getElementById("dashboard_order").value = entry.dashboard_order ?? 0;

      toggleDashboardFields(!!entry.show_on_dashboard);

    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load module");
    } finally {
      hideLoading();
    }
  }

  /* ================= DASHBOARD TOGGLE ================= */
  document.getElementById("show_on_dashboard")?.addEventListener("change", e => {
    toggleDashboardFields(e.target.checked);
  });

  toggleDashboardFields(
    document.getElementById("show_on_dashboard")?.checked
  );

  /* ================= SUBMIT ================= */
  form.onsubmit = async e => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      name: document.getElementById("name").value.trim(),
      key: document.getElementById("key").value.trim(),
      icon: document.getElementById("icon").value.trim(),
      category: document.getElementById("category").value.trim(),
      description: document.getElementById("description").value.trim(),
      route: document.getElementById("route").value.trim(),
      parent_id: document.getElementById("parent_id").value || null,
      tenant_scope: document.getElementById("tenant_scope").value,
      order_index: Number(document.getElementById("order_index").value || 0),
      tags: document
        .getElementById("tags")
        .value.split(",")
        .map(t => t.trim())
        .filter(Boolean),
      visibility: document.querySelector("input[name='visibility']:checked")?.value || "public",
      enabled: document.getElementById("enabled").checked,
      status: document.querySelector("input[name='status']:checked")?.value || "active",
      show_on_dashboard: document.getElementById("show_on_dashboard").checked,
      dashboard_type: document.getElementById("dashboard_type").value,
      dashboard_order: Number(document.getElementById("dashboard_order").value || 0),
    };

    /* ================= BASIC VALIDATION ================= */
    if (!payload.name || !payload.key) {
      showToast("❌ Name and Key are required");
      return;
    }

    try {
      showLoading();
      const res = await authFetch(
        isEdit
          ? `/api/features/feature-modules/${moduleId}`
          : `/api/features/feature-modules`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      let result = {};
      try { result = await res.json(); } catch {}

      if (!res.ok) {
        throw new Error(normalizeMessage(result, "❌ Save failed"));
      }

      showToast(`✅ Module "${payload.name}" ${isEdit ? "updated" : "created"}`);

      sessionStorage.removeItem("featureModuleEditPayload");
      sessionStorage.removeItem("featureModuleEditId");
      window.location.href = "/feature-module-list.html";

    } catch (err) {
      console.error("❌ Submit error:", err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ================= CANCEL ================= */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    form.reset();
    window.location.href = "/feature-module-list.html";
  });
}
