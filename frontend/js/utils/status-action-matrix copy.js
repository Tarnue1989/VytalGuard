/* ============================================================
   🧠 STATUS → ACTION MATRIX + BUTTON BUILDER (Full Enterprise Pattern)
   Aligned with Central Stock, Clinical, Lab Request, Lab Result, and Admin modules
============================================================ */

export const STATUS_ACTION_MATRIX = {
  /* ========================
     🩺 CLINICAL MODULES
  ======================== */
  consultation: {
    open: ["edit", "start", "cancel", "void"],
    in_progress: ["complete", "cancel", "void"],
    completed: ["verify", "void"],
    verified: ["void"],
    cancelled: ["void"],
    voided: ["restore"],
  },

  triage_record: {
    open: ["edit", "start", "cancel", "void"],
    in_progress: ["complete", "cancel", "void"],
    completed: ["verify", "void"],
    verified: ["void"],
    cancelled: ["void"],
    voided: ["restore"],
  },

  ekg_record: {
    pending: ["edit", "start", "cancel", "void"],
    in_progress: ["complete", "cancel", "void"],
    completed: ["verify", "void"],
    verified: ["void"],
    finalized: ["void"],
    cancelled: ["void"],
    voided: ["restore"],
  },

  delivery_record: {
    scheduled: ["edit", "start", "cancel", "void"],
    in_progress: ["complete", "cancel", "void"],
    completed: ["verify", "void"],
    verified: ["void"],
    cancelled: ["void"],
    voided: ["restore"],
  },

  /* ========================
     🩻 ULTRASOUND MODULE
  ======================== */
  ultrasound_record: {
    pending: ["edit", "start", "cancel", "void"],
    in_progress: ["complete", "cancel", "void"],
    completed: ["verify", "finalize", "void"],
    verified: ["finalize", "void"],
    finalized: ["void"],
    cancelled: ["void"],
    voided: ["restore"],
  },

  /* ========================
     🧪 LAB REQUEST MODULE
  ======================== */
  lab_request: {
    draft: ["edit", "submit", "delete", "void"],
    pending: ["edit", "cancel", "void"],
    approved: ["process", "void"],
    processed: ["verify", "void"],
    verified: ["void"],
    cancelled: ["void"],
    voided: ["restore"],
  },

  /* ========================
     🧫 LAB RESULT MODULE (FULL SYNC)
  ======================== */
  lab_result: {
    draft: ["edit", "submit", "delete", "void"],
    pending: ["edit", "start", "cancel", "void"], // ✅ Added "start"
    in_progress: ["complete", "cancel", "void"],
    completed: ["review", "verify", "void"], // ✅ Includes "review"
    reviewed: ["verify", "void"],
    verified: ["void"],
    cancelled: ["void"],
    voided: ["restore"],
  },

  /* ========================
     🧾 REGISTRATION MODULES
  ======================== */
  registration_log: {
    draft: ["edit", "submit", "delete", "void"],
    pending: ["edit", "activate", "cancel", "void"],
    active: ["complete", "cancel", "void"],
    completed: ["verify", "void"],
    verified: ["void"],
    cancelled: ["void"],
    voided: ["restore"],
  },

  /* ========================
     🏢 ADMIN MODULES
  ======================== */
  department: {
    active: ["edit", "toggle", "delete"],
    inactive: ["edit", "toggle", "delete"],
    deleted: ["restore"],
  },

  /* ========================
     💰 BILLING MODULES
  ======================== */
  billable_item: {
    active: ["edit", "toggle", "history", "delete"],
    inactive: ["edit", "toggle", "delete"],
    deleted: ["restore"],
  },

  /* ========================
     🏭 INVENTORY MODULES
  ======================== */
  central_stock: {
    active: ["edit", "toggle", "lock", "delete"],
    inactive: ["edit", "toggle", "lock", "delete"],
    locked: ["unlock"],
    deleted: ["restore"],
  },

  stock_request: {
    draft: ["edit", "submit", "delete", "void"],
    pending: ["edit", "approve", "reject", "cancel", "void"],
    approved: ["issue", "cancel", "void"],
    issued: ["fulfill", "void"],
    fulfilled: ["verify", "void"],
    cancelled: ["void"],
    voided: ["restore"],
  },
};

/* ============================================================
   🧱 BUTTON BUILDER HELPERS
============================================================ */
function buildButton(action, title, icon, color, id) {
  return `
    <button class="btn btn-outline-${color} btn-sm ${action}-btn"
      data-id="${id}" data-bs-toggle="tooltip" data-bs-title="${title}">
      <i class="fas ${icon}"></i>
    </button>`;
}

/* ============================================================
   🎛️ UNIVERSAL BUILDER (Aligned with Consultation Master)
============================================================ */
export function buildActionButtons({
  module,
  status,
  entryId,
  user,
  permissionPrefix,
}) {
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().includes("superadmin")) ||
    (user?.roleNames || []).some((r) => r.toLowerCase().includes("superadmin"));

  const perms = new Set(
    (user?.permissions || []).map((p) => p.toLowerCase().trim())
  );

  const allowedActions = STATUS_ACTION_MATRIX[module]?.[status] || [];
  let html = "";

  // 🔹 Always allow View
  if (perms.has(`${permissionPrefix}:view`) || isSuperAdmin) {
    html += buildButton("view", "View", "fa-eye", "primary", entryId);
  }

  // 🔹 Lifecycle / Contextual Actions
  allowedActions.forEach((action) => {
    const permKey =
      action === "toggle"
        ? `${permissionPrefix}:toggle-status`
        : `${permissionPrefix}:${action}`;

    if (perms.has(permKey) || isSuperAdmin) {
      const icons = {
        view: "fa-eye",
        edit: "fa-pen",
        start: "fa-play",
        complete: "fa-check",
        review: "fa-search", // ✅ added
        verify: "fa-clipboard-check",
        finalize: "fa-flag-checkered",
        cancel: "fa-ban",
        void: "fa-times-circle",
        submit: "fa-paper-plane",
        activate: "fa-toggle-on",
        toggle: status === "active" ? "fa-toggle-off" : "fa-toggle-on",
        lock: "fa-lock",
        unlock: "fa-lock-open",
        restore: "fa-undo",
        delete: "fa-trash",
        history: "fa-clock-rotate-left",
        approve: "fa-thumbs-up",
        reject: "fa-thumbs-down",
        issue: "fa-dolly",
        fulfill: "fa-box-check",
        process: "fa-vial-circle-check",
      };

      const colors = {
        view: "primary",
        edit: "success",
        start: "primary",
        complete: "success",
        review: "warning", // ✅ added
        verify: "info",
        finalize: "dark",
        cancel: "warning",
        void: "danger",
        submit: "primary",
        activate: "success",
        toggle: status === "active" ? "secondary" : "warning",
        lock: "dark",
        unlock: "secondary",
        restore: "primary",
        delete: "danger",
        history: "info",
        approve: "success",
        reject: "danger",
        issue: "primary",
        fulfill: "info",
        process: "primary",
      };

      const titles = {
        ...actionLabels,
        review: "Review Lab Result", // ✅ added
        finalize: "Finalize Record",
        submit: "Submit for Review",
        complete: "Mark as Completed",
        verify: "Verify Final Result",
        activate: "Activate",
        toggle: status === "active" ? "Deactivate" : "Activate",
        approve: "Approve Request",
        reject: "Reject Request",
        issue: "Issue Items",
        fulfill: "Fulfill Request",
        process: "Mark as Processed",
      };

      html += buildButton(
        action,
        titles[action] || action,
        icons[action] || "fa-cog",
        colors[action] || "secondary",
        entryId
      );
    }
  });

  // ✅ Keep consistent Consultation Pattern layout
  return `<div class="d-inline-flex gap-1">${html}</div>`;
}

/* ============================================================
   🏷️ ACTION LABELS
============================================================ */
const actionLabels = {
  view: "View",
  edit: "Edit",
  start: "Start",
  complete: "Complete",
  review: "Review", // ✅ added
  verify: "Verify",
  finalize: "Finalize",
  cancel: "Cancel",
  void: "Void",
  submit: "Submit",
  activate: "Activate",
  toggle: "Toggle Status",
  lock: "Lock",
  unlock: "Unlock",
  restore: "Restore",
  delete: "Delete",
  history: "View History",
  approve: "Approve",
  reject: "Reject",
  issue: "Issue",
  fulfill: "Fulfill",
  process: "Process",
};
