// 📁 user-actions.js – ENTERPRISE MASTER (FULLY ALIGNED)
// ============================================================================
// 🔹 Matches order-actions.js structure 1:1
// 🔹 Class-based dispatch (MASTER)
// 🔹 Global helpers added
// 🔹 Lifecycle-style reusable handlers
// 🔹 All user-specific actions preserved
// ============================================================================

import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { renderCard } from "./user-render.js";

/* ============================================================
   🧠 STATE
============================================================ */
let handlersBound = false;

/* ============================================================
   🪟 LOCAL MODAL
============================================================ */
function openLocalModal(titleText, htmlContent) {
  const modal = document.getElementById("viewModal");
  const title = document.getElementById("viewModalTitle");
  const body = document.getElementById("viewModalBody");

  if (!modal || !title || !body) return;

  title.textContent = titleText;
  body.innerHTML = htmlContent;

  modal.classList.remove("hidden");
}

/* ============================================================
   🪟 MODAL HELPERS
============================================================ */
function showTokenModal(username, token, exp) {
  if (!token) return showToast("⚠️ No reset token available");

  openLocalModal(
    "Password Reset Token",
    `
    <p>Reset token for <strong>${username}</strong>:</p>
    <div class="input-group mb-3">
      <input class="form-control" value="${token}" readonly>
      <button class="btn btn-outline-secondary"
        onclick="navigator.clipboard.writeText('${token}')">Copy</button>
    </div>
    <small class="text-muted">
      Expires at: ${exp ? new Date(exp).toLocaleString() : "—"}
    </small>
  `
  );
}

function showPasswordResetModal(username, pwd) {
  if (!pwd) return showToast("⚠️ Password reset failed");

  openLocalModal(
    "Password Reset",
    `
    <p>Temporary password for <strong>${username}</strong>:</p>
    <div class="input-group mb-3">
      <input class="form-control" value="${pwd}" readonly>
      <button class="btn btn-outline-secondary"
        onclick="navigator.clipboard.writeText('${pwd}')">Copy</button>
    </div>
  `
  );
}

/* ============================================================
   🚀 SETUP (MASTER FINAL – FULL)
============================================================ */
export function setupActionHandlers({
  entries,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  if (handlersBound) return;
  handlersBound = true;

  const tableBody = document.getElementById("userTableBody");
  const cardContainer = document.getElementById("userList");

  window.latestUserEntries = entries;

  tableBody?.addEventListener("click", handleActions);
  cardContainer?.addEventListener("click", handleActions);

  /* ================= PERMISSIONS ================= */
  function normalizePermissions(perms) {
    if (!perms) return [];
    if (typeof perms === "string") {
      try { return JSON.parse(perms); }
      catch { return perms.split(",").map(p => p.trim()); }
    }
    return Array.isArray(perms) ? perms : [];
  }

  const userPerms = new Set(
    normalizePermissions(user?.permissions || []).map(p =>
      String(p).toLowerCase().trim()
    )
  );

  const isSuperAdmin =
    (user?.role || "").toLowerCase().includes("superadmin") ||
    (user?.roleNames || []).some(r =>
      r.toLowerCase().includes("superadmin")
    );

  const hasPerm = key =>
    isSuperAdmin || userPerms.has(key.toLowerCase());

  /* ================= DISPATCH ================= */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestUserEntries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/users/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ User not found");

    const cls = btn.classList;

    /* ================= CORE ================= */

    if (cls.contains("view-btn")) {
      if (!hasPerm("users:view")) return showToast("⛔ No permission");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("users:edit")) return showToast("⛔ No permission");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("users:delete")) return showToast("⛔ No permission");
      return handleDelete(entry);
    }

    /* ================= STATUS ACTIONS ================= */

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("users:edit")) return showToast("⛔ No permission");
      return handleToggleStatus(entry);
    }

    if (cls.contains("reset-password-btn")) {
      if (!hasPerm("users:reset_password"))
        return showToast("⛔ No permission");
      return handleResetPassword(entry);
    }

    if (cls.contains("generate-token-btn")) {
      if (!hasPerm("users:generate_token"))
        return showToast("⛔ No permission");
      return handleGenerateResetToken(entry);
    }

    if (cls.contains("unlock-btn")) {
      if (!hasPerm("users:unlock"))
        return showToast("⛔ No permission");
      return handleUnlock(entry);
    }

    if (cls.contains("revoke-sessions-btn")) {
      if (!hasPerm("users:revoke_sessions"))
        return showToast("⛔ No permission");
      return handleRevokeSessions(entry);
    }

    if (cls.contains("restore-btn")) {
      if (!hasPerm("users:restore"))
        return showToast("⛔ No permission");
      return handleRestore(entry);
    }
  }

  /* ================= HANDLERS ================= */

  function handleView(entry) {
    openLocalModal("User Info", renderCard(entry, visibleFields, user));
  }

  function handleEdit(entry) {
    sharedState?.currentEditIdRef && (sharedState.currentEditIdRef.value = entry.id);
    sessionStorage.setItem("userEditId", entry.id);
    sessionStorage.setItem("userEditPayload", JSON.stringify(entry));
    window.location.href = "add-user.html";
  }

  async function handleDelete(entry) {
    if (!(await showConfirm(`Delete "${entry.username}"?`))) return;

    try {
      showLoading();
      await authFetch(`/api/users/${entry.id}`, { method: "DELETE" });
      showToast("✅ Deleted");
      window.latestUserEntries = [];
      await loadEntries(currentPage);
    } finally {
      hideLoading();
    }
  }

  async function handleRestore(entry) {
    if (!(await showConfirm("Restore this user?"))) return;

    try {
      showLoading();
      await authFetch(`/api/users/${entry.id}/restore`, { method: "PUT" });
      showToast("✅ User restored");
      window.latestUserEntries = [];
      await loadEntries(currentPage);
    } finally {
      hideLoading();
    }
  }

  async function handleToggleStatus(entry) {
    if (!(await showConfirm("Toggle user status?"))) return;

    try {
      showLoading();
      await authFetch(`/api/users/${entry.id}/toggle-status`, { method: "PUT" });
      showToast("✅ Status updated");
      window.latestUserEntries = [];
      await loadEntries(currentPage);
    } finally {
      hideLoading();
    }
  }

  async function handleResetPassword(entry) {
    if (!(await showConfirm("Reset password?"))) return;

    const res = await authFetch(`/api/users/${entry.id}/reset-password`, { method: "PUT" });
    const json = await res.json();
    showPasswordResetModal(entry.username, json.data?.tempPassword);
  }

  async function handleGenerateResetToken(entry) {
    if (!(await showConfirm("Generate reset token?"))) return;

    const res = await authFetch(`/api/users/generate-reset-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: entry.id }),
    });

    const json = await res.json();
    showTokenModal(entry.username, json.data?.token, json.data?.exp);
  }

  async function handleUnlock(entry) {
    if (!(await showConfirm("Unlock user?"))) return;

    try {
      showLoading();
      await authFetch(`/api/users/${entry.id}/unlock`, { method: "PUT" });
      showToast("✅ Unlocked");
      window.latestUserEntries = [];
      await loadEntries(currentPage);
    } finally {
      hideLoading();
    }
  }

  async function handleRevokeSessions(entry) {
    if (!(await showConfirm("Revoke sessions?"))) return;

    try {
      showLoading();
      await authFetch(`/api/users/${entry.id}/revoke-sessions`, { method: "PUT" });
      showToast("✅ Sessions revoked");
      window.latestUserEntries = [];
      await loadEntries(currentPage);
    } finally {
      hideLoading();
    }
  }

  /* ================= GLOBAL HELPERS ================= */

  const findEntry = id =>
    (window.latestUserEntries || []).find(x => String(x.id) === String(id));

  window.viewUser = id => {
    if (!hasPerm("users:view")) return showToast("⛔ No permission");
    const e = findEntry(id);
    if (e) handleView(e);
  };

  window.editUser = id => {
    if (!hasPerm("users:edit")) return showToast("⛔ No permission");
    const e = findEntry(id);
    if (e) handleEdit(e);
  };

  window.deleteUser = id => {
    if (!hasPerm("users:delete")) return showToast("⛔ No permission");
    const e = findEntry(id);
    if (e) handleDelete(e);
  };

  /* ================= MODAL CLOSE ================= */
  document.getElementById("closeViewModal")?.addEventListener("click", () => {
    document.getElementById("viewModal")?.classList.add("hidden");
  });
}