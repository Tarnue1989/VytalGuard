// ============================================================================
// 🏢 VytalGuard – Secure & Role-Aware Organization Form
// 🔹 Fully aligned with Enterprise Master Pattern (consultation-form.js)
// 🔹 Preserves all original IDs, validation, and submission logic
// 🔹 Adds role-awareness, safe edit prefill, and unified UX behavior
// ============================================================================

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
   🔧 Helpers
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
   🚀 Setup Organization Form
============================================================ */
export async function setupOrganizationFormSubmission({ form }) {
  // 🔐 Auth Guard & Logout Watcher
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("organizationEditId");
  const queryId = getQueryParam("id");
  const orgId = sessionId || queryId;
  const isEdit = !!orgId;

  // 🎨 UI Title & Button Mode
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Organization");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Organization`);
    } else {
      titleEl && (titleEl.textContent = "Add Organization");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Organization`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🧭 Prefill (Edit Mode)
  ============================================================ */
  if (isEdit && orgId) {
    try {
      let entry = null;
      const cached = sessionStorage.getItem("organizationEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        showLoading();
        const res = await authFetch(`/api/organizations/${orgId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load organization"));
        entry = result?.data;
      }

      if (!entry) throw new Error("❌ Organization not found");

      document.getElementById("name").value = entry.name || "";
      document.getElementById("code").value = entry.code || "";

      if (entry.status) {
        const radio = document.getElementById(
          `status_${entry.status.toLowerCase()}`
        );
        if (radio) radio.checked = true;
      }
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load organization");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      name: (document.getElementById("name")?.value || "").trim(),
      code: (document.getElementById("code")?.value || "").trim(),
      status:
        document.querySelector("input[name='status']:checked")?.value || "active",
    };

    // 🔎 Validation
    if (!payload.name) return showToast("❌ Organization Name is required");
    if (payload.name.length < 3)
      return showToast("❌ Organization Name must be at least 3 characters");
    if (!payload.code) return showToast("❌ Organization Code is required");
    if (!/^[A-Z0-9_-]+$/i.test(payload.code))
      return showToast("❌ Code may only contain letters, numbers, underscores, or dashes");
    if (payload.code.length > 50)
      return showToast("❌ Code must be ≤ 50 characters");

    try {
      showLoading();
      const url = isEdit ? `/api/organizations/${orgId}` : `/api/organizations`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(
        isEdit
          ? `✅ Organization "${payload.name}" updated successfully`
          : `✅ Organization "${payload.name}" added successfully`
      );

      sessionStorage.removeItem("organizationEditId");
      sessionStorage.removeItem("organizationEditPayload");

      if (isEdit) {
        window.location.href = "/organizations-list.html";
      } else {
        form.reset();
        document.getElementById("status_active")?.setAttribute("checked", true);
        setUI("add");
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel & Reset
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("organizationEditId");
    sessionStorage.removeItem("organizationEditPayload");
    window.location.href = "/organizations-list.html";
  });
}
