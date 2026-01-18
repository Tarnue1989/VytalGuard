// 📁 organization-form.js – Secure & Rule-Driven Organization Form (ENTERPRISE MASTER)
// ============================================================================
// 🧭 MASTER PARITY WITH role-form.js / patient-form.js
// 🔹 Rule-driven validation (ORG_FORM_RULES – same engine as ROLE_FORM_RULES)
// 🔹 Permission-safe (backend remains authority)
// 🔹 Session-safe edit prefill (cache + query fallback)
// 🔹 Unified UX: title, submit mode, cancel, reset
// 🔹 IDs, routes, and HTML bindings PRESERVED
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import {
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

/* ============================================================
   🔧 Helpers (MASTER SAFE)
============================================================ */
const getQueryParam = (k) =>
  new URLSearchParams(window.location.search).get(k);

const normalizeMessage = (r, fb) =>
  r?.message || r?.error || r?.msg || fb;

/* ============================================================
   🧠 ORGANIZATION FORM RULES (ROLE PARITY)
============================================================ */
const ORG_FORM_RULES = [
  { id: "name", message: "Organization Name is required" },
  { id: "code", message: "Organization Code is required" },
  { id: "status", message: "Status is required", when: () => true },
];

/* ============================================================
   🚀 Setup Organization Form
============================================================ */
export async function setupOrganizationFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const orgId =
    sessionStorage.getItem("organizationEditId") ||
    getQueryParam("id");

  const isEdit = Boolean(orgId);

  /* ---------------- UI ---------------- */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");

  const setUI = (edit) => {
    titleEl.textContent = edit ? "Edit Organization" : "Add Organization";
    submitBtn.innerHTML = edit
      ? `<i class="ri-save-3-line me-1"></i> Update Organization`
      : `<i class="ri-add-line me-1"></i> Add Organization`;
  };
  setUI(isEdit);

  /* ============================================================
     🧭 Prefill (Edit Mode – MASTER PARITY)
  ============================================================ */
  if (isEdit && orgId) {
    try {
      let entry = null;
      const cached = sessionStorage.getItem("organizationEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        showLoading();
        const res = await authFetch(`/api/organizations/${orgId}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(normalizeMessage(json, "Failed to load organization"));
        entry = json?.data;
      }

      if (!entry) throw new Error("Organization not found");

      document.getElementById("name").value = entry.name || "";
      document.getElementById("code").value = entry.code || "";

      if (entry.status) {
        const radio = document.getElementById(
          `status_${entry.status.toLowerCase()}`
        );
        if (radio) radio.checked = true;
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to load organization");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💾 Submit — RULE-DRIVEN (ROLE / PATIENT PARITY)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of ORG_FORM_RULES) {
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
      name: document.getElementById("name").value.trim(),
      code: document.getElementById("code").value.trim(),
      status:
        document.querySelector("input[name='status']:checked")?.value ||
        "active",
    };

    try {
      showLoading();
      const res = await authFetch(
        isEdit ? `/api/organizations/${orgId}` : `/api/organizations`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (!res.ok)
        throw new Error(normalizeMessage(json, "Submission failed"));

      showToast(
        isEdit
          ? "✅ Organization updated"
          : "✅ Organization created"
      );

      sessionStorage.clear();
      window.location.href = "/organizations-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel / Clear (MASTER SAFE)
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/organizations-list.html";
  });
}
