// 📁 user-actions.js – Enterprise-Aligned (Roles Parity, Token-Safe)

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { renderCard, showUserModal } from "./user-render.js";

/* ============================================================
   🧠 INTERNAL STATE (CRITICAL FIX)
============================================================ */
let handlersBound = false;

/* ============================================================
   🪟 Modal Helpers
============================================================ */

function showTokenModal(username, token, exp) {
  if (!token) {
    showToast("⚠️ No reset token available");
    return;
  }

  showUserModal(
    "Password Reset Token",
    `
    <p>Reset token for <strong>${username}</strong>:</p>
    <div class="input-group mb-3">
      <input type="text" class="form-control" value="${token}" id="copyTokenInput" readonly>
      <button class="btn btn-outline-secondary"
        onclick="navigator.clipboard.writeText(document.getElementById('copyTokenInput').value)">
        Copy
      </button>
    </div>
    <small class="text-muted">Expires at: ${exp || "—"}</small>
  `
  );
}

function showPasswordResetModal(username, newPassword) {
  if (!newPassword) {
    showToast("⚠️ Password reset failed");
    return;
  }

  showUserModal(
    "Password Reset",
    `
    <p>Temporary password for <strong>${username}</strong>:</p>
    <div class="input-group mb-3">
      <input type="text" class="form-control" value="${newPassword}" id="copyPwdInput" readonly>
      <button class="btn btn-outline-secondary"
        onclick="navigator.clipboard.writeText(document.getElementById('copyPwdInput').value)">
        Copy
      </button>
    </div>
    <small class="text-muted">User should change this password on next login.</small>
  `
  );
}

/* ============================================================
   🚀 Action Handlers
============================================================ */

export function setupActionHandlers({
  entries,
  currentPage,
  loadEntries,
  visibleFields,
  user,
}) {
  // 🔴 CRITICAL: prevent duplicate listeners
  if (handlersBound) return;
  handlersBound = true;

  const tableBody = document.getElementById("userTableBody");
  const cardContainer = document.getElementById("userList");

  window.latestUserEntries = entries;

  tableBody?.addEventListener("click", handleActions);
  cardContainer?.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Permission Engine
  ============================================================ */

  const userPerms = new Set(
    (Array.isArray(user?.permissions) ? user.permissions : [])
      .map(p => String(p).toLowerCase().trim())
  );

  const isSuperAdmin =
    user?.role?.toLowerCase().replace(/\s+/g, "") === "superadmin" ||
    user?.roleNames?.some(r =>
      r.toLowerCase().replace(/\s+/g, "") === "superadmin"
    );

  const hasPerm = (key) => isSuperAdmin || userPerms.has(key.toLowerCase());

  /* ============================================================
     🧠 Dispatcher
  ============================================================ */

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    const cls = btn.classList;

    let entry =
      (window.latestUserEntries || []).find(u => String(u.id) === String(id)) ||
      null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/users/${id}`);
        const json = await res.json();
        entry = json?.data;
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ User not found");

    /* ====================== ACTION ROUTES ====================== */

    if (cls.contains("view-btn")) {
      if (!hasPerm("users:view")) return showToast("⛔ Permission denied");
      return openViewModal(
        "User Details",
        renderCard(entry, visibleFields, user)
      );
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("users:edit")) return showToast("⛔ Permission denied");
      sessionStorage.setItem("userEditId", entry.id);
      sessionStorage.setItem("userEditPayload", JSON.stringify(entry));
      return (window.location.href = "add-user.html");
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("users:edit")) return showToast("⛔ Permission denied");
      return handleToggleStatus(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("users:delete")) return showToast("⛔ Permission denied");
      return handleDelete(entry);
    }

    if (cls.contains("reset-password-btn")) {
      if (!hasPerm("users:edit")) return showToast("⛔ Permission denied");
      return handleResetPassword(entry);
    }

    if (cls.contains("generate-token-btn")) {
      if (!hasPerm("users:edit")) return showToast("⛔ Permission denied");
      return handleGenerateResetToken(entry);
    }

    if (cls.contains("unlock-btn")) {
      if (!hasPerm("users:edit")) return showToast("⛔ Permission denied");
      return handleUnlock(entry);
    }

    if (cls.contains("revoke-sessions-btn")) {
      if (!hasPerm("users:edit")) return showToast("⛔ Permission denied");
      return handleRevokeSessions(entry);
    }
  }

  /* ============================================================
     ⚙️ Implementations
  ============================================================ */

  async function handleToggleStatus(entry) {
    const isActive = entry.status === "active";
    if (
      !(await showConfirm(
        isActive ? "Deactivate this user?" : "Activate this user?"
      ))
    ) return;

    try {
      showLoading();
      const res = await authFetch(`/api/users/${entry.id}/toggle-status`, {
        method: "PUT",
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.success === false) {
        showToast(json?.message || "❌ Failed to update status");
        return;
      }

      showToast(`✅ User "${entry.username}" status updated`);
      await loadEntries(currentPage);
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(entry) {
    if (!(await showConfirm(`Delete user "${entry.username}"?`))) return;
    showLoading();
    await authFetch(`/api/users/${entry.id}`, { method: "DELETE" });
    showToast(`✅ User "${entry.username}" deleted`);
    await loadEntries(currentPage);
    hideLoading();
  }

  async function handleResetPassword(entry) {
    if (!(await showConfirm("Reset this user's password?"))) return;
    const res = await authFetch(`/api/users/${entry.id}/reset-password`, {
      method: "PUT",
    });
    const json = await res.json();
    if (!json?.success) return showToast(json?.message || "❌ Reset failed");
    showPasswordResetModal(entry.username, json.data?.tempPassword);
  }

  async function handleGenerateResetToken(entry) {
    if (!(await showConfirm("Generate password reset token?"))) return;
    const res = await authFetch(`/api/users/generate-reset-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: entry.id }),
    });
    const json = await res.json();
    if (!json?.success)
      return showToast(json?.message || "❌ Token generation failed");
    showTokenModal(entry.username, json.data?.token, json.data?.expires_at);
  }

  async function handleUnlock(entry) {
    if (!(await showConfirm("Unlock this account?"))) return;
    await authFetch(`/api/users/${entry.id}/unlock`, { method: "PUT" });
    showToast(`✅ "${entry.username}" unlocked`);
    await loadEntries(currentPage);
  }

  async function handleRevokeSessions(entry) {
    if (!(await showConfirm("Revoke all active sessions?"))) return;
    await authFetch(`/api/users/${entry.id}/revoke-sessions`, { method: "PUT" });
    showToast(`✅ Sessions revoked for "${entry.username}"`);
  }
}
