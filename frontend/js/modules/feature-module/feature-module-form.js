// 📁 feature-module-form.js – Secure & Role-Aware Feature Module Form
// ============================================================================
// 🔹 Rule-driven validation (FEATURE_MODULE_FORM_RULES)
// 🔹 Role-aware tenant enforcement
// 🔹 Edit hydration (session + API)
// 🔹 Dashboard field toggle safety
// 🔹 Controller-faithful (no silent validation)
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import {
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import { FEATURE_MODULE_FORM_RULES } from "./feature-module.form.rules.js";

/* ============================================================
   🧩 Helpers
============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
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
    const json = await res.json();
    const modules = json?.data?.records || [];

    const parentSelect = document.getElementById("parent_id");
    if (!parentSelect) return;

    parentSelect.innerHTML =
      `<option value="">-- None (Top-level) --</option>`;

    modules
      .filter((m) => !m.parent_id)
      .forEach((m) => {
        parentSelect.insertAdjacentHTML(
          "beforeend",
          `<option value="${m.id}">${m.name}</option>`
        );
      });
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load parent modules");
  }
}

/* ============================================================
   🎛️ DASHBOARD FIELD TOGGLE
============================================================ */
function toggleDashboardFields(show) {
  const typeEl =
    document.getElementById("dashboard_type")?.closest(".col-xxl-3");
  const orderEl =
    document.getElementById("dashboard_order")?.closest(".col-xxl-3");

  if (typeEl) typeEl.style.display = show ? "" : "none";
  if (orderEl) orderEl.style.display = show ? "" : "none";
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupFeatureModuleFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const moduleId =
    sessionStorage.getItem("featureModuleEditId") ||
    getQueryParam("id");

  const isEdit = Boolean(moduleId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setFormTitle = (txt, icon) => {
    if (titleEl) titleEl.textContent = txt;
    if (submitBtn)
      submitBtn.innerHTML = `<i class="${icon} me-1"></i> ${txt}`;
  };

  setFormTitle(
    isEdit ? "Update Feature Module" : "Add Feature Module",
    "ri-save-3-line"
  );

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     📦 Dependencies
  ============================================================ */
  await loadParentModules();

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      let entry = JSON.parse(
        sessionStorage.getItem("featureModuleEditPayload") || "null"
      );

      if (!entry) {
        const res = await authFetch(
          `/api/features/feature-modules/${moduleId}`
        );
        const json = await res.json();
        entry = json?.data?.record;
      }

      if (!entry) throw new Error("Feature module not found");

      [
        "name",
        "key",
        "icon",
        "category",
        "description",
        "route",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = entry[id] || "";
      });

      document.getElementById("order_index").value =
        entry.order_index ?? 0;

      document.getElementById("tenant_scope").value =
        entry.tenant_scope || "org";

      document.getElementById("parent_id").value =
        entry.parent_id || "";

      document.getElementById("enabled").checked =
        !!entry.enabled;

      if (Array.isArray(entry.tags)) {
        document.getElementById("tags").value =
          entry.tags.join(", ");
      }

      document
        .querySelector(
          `input[name="visibility"][value="${entry.visibility}"]`
        )
        ?.setAttribute("checked", true);

      document
        .querySelector(
          `input[name="status"][value="${entry.status}"]`
        )
        ?.setAttribute("checked", true);

      document.getElementById("show_on_dashboard").checked =
        !!entry.show_on_dashboard;

      document.getElementById("dashboard_type").value =
        entry.dashboard_type || "none";

      document.getElementById("dashboard_order").value =
        entry.dashboard_order ?? 0;

      toggleDashboardFields(!!entry.show_on_dashboard);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to load module");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🎛️ Dashboard Toggle
  ============================================================ */
  document
    .getElementById("show_on_dashboard")
    ?.addEventListener("change", (e) =>
      toggleDashboardFields(e.target.checked)
    );

  toggleDashboardFields(
    document.getElementById("show_on_dashboard")?.checked
  );

  /* ============================================================
     🛡️ SUBMIT — RULE-DRIVEN
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of FEATURE_MODULE_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || !el.value || el.value.toString().trim() === "") {
        errors.push({
          field: rule.id,
          message: rule.message,
        });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      name: form.name.value.trim(),
      key: form.key.value.trim(),
      icon: form.icon.value.trim(),
      category: form.category.value.trim(),
      description: form.description.value.trim(),
      route: form.route.value.trim(),
      parent_id: form.parent_id.value || null,
      tenant_scope: form.tenant_scope.value,
      order_index: Number(form.order_index.value || 0),
      tags: form.tags.value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      visibility:
        form.querySelector("input[name='visibility']:checked")
          ?.value || "public",
      enabled: form.enabled.checked,
      status:
        form.querySelector("input[name='status']:checked")
          ?.value || "active",
      show_on_dashboard: form.show_on_dashboard.checked,
      dashboard_type: form.dashboard_type.value,
      dashboard_order: Number(form.dashboard_order.value || 0),
    };

    // 🔐 Frontend tenant safety
    if (!userRole.includes("super")) {
      if (payload.tenant_scope === "global") {
        showToast("❌ Only super admins can assign global scope");
        return;
      }
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

      const result = await res.json();

      if (!res.ok) {
        applyServerErrors(form, result?.errors);
        throw new Error(
          normalizeMessage(result, "Save failed")
        );
      }

      showToast(
        isEdit
          ? "✅ Feature module updated"
          : "✅ Feature module created"
      );

      sessionStorage.clear();
      window.location.href = "/feature-module-list.html";
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     ⏮️ Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/feature-module-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setFormTitle("Add Feature Module", "ri-save-3-line");
    toggleDashboardFields(false);
  });
}
