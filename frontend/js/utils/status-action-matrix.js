// 📦 status-action-matrix.js – Enterprise Master Pattern Aligned (Full + Compact)
// ============================================================================
// 🧠 STATUS → ACTION MATRIX + BUTTON BUILDER (Unified Enterprise Standard)
// ----------------------------------------------------------------------------
// 🔹 Covers all modules: Clinical, Billing, Inventory, Master Data, Admin, etc.
// 🔹 Standardized lifecycle actions (toggle-status, void, restore, delete, etc.)
// 🔹 Context-aware button labels (Deposit / Refund / Refund Deposit / Waiver)
// ============================================================================

export const STATUS_ACTION_MATRIX = {
  /* ======================== 🩺 CLINICAL ======================== */
  consultation:{open:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},
  triage_record:{open:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},
  ekg_record:{pending:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["review","finalize","void"],reviewed:["finalize","void"],finalized:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},
  delivery_record:{scheduled:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},

  /* ======================== 📅 APPOINTMENT ======================== */
  appointment:{
    scheduled:["edit","activate","cancel","no-show","void"],
    in_progress:["complete","cancel","void"],
    completed:["verify","void"],
    verified:[],
    cancelled:["restore"],
    no_show:["restore"],
    voided:["restore"],
    deleted:[]
  },


  /* ======================== 💰 DEPOSIT ======================== */
  deposit:{
    pending:["edit","clear","cancel","void","delete"],
    cleared:["apply","void","reverse"],
    applied:["apply","reverse","verify","void","print"],
    verified:["print"],
    cancelled:["restore"],
    reversed:["restore"],
    voided:["restore"],
    deleted:["restore"],
  },

  /* ======================== 💳 PAYMENT ======================== */
  payment:{
    pending:["edit","complete","cancel","void","delete"],
    completed:["verify","void","print"],
    verified:["print"],
    cancelled:["restore"],
    reversed:["restore"],
    voided:["restore"],
    deleted:["restore"],
  },

  /* ======================== 🧾 INVOICE ======================== */
  invoice:{
    unpaid:["collect","cancel","void","print"],
    partial:["collect","void","print"],
    paid:["print"],
    cancelled:["restore"],
    voided:["restore"],
    deleted:["restore"]
  },

  /* ======================== 💸 DISCOUNT ======================== */
  discount:{
    draft:["edit","toggle-status","delete","void"],
    active:["toggle-status","finalize","void"],
    inactive:["toggle-status","void"],
    finalized:["void","restore","print"],
    voided:["restore"],
    deleted:["restore"]
  },

  /* ======================== 💸 DISCOUNT WAIVER ======================== */
  discount_waiver:{
    pending:["edit","approve","reject","void","delete"],
    approved:["finalize","void","print"],
    applied:["void","print"],
    rejected:["restore"],
    voided:["restore"],
    finalized:["print","void","restore"],
    deleted:["restore"],
  },

  /* ======================== 💵 REFUND (payment refunds) ======================== */
  refund:{
    pending:["edit","approve","reject","cancel","void","delete"],
    approved:["process","cancel","void"],
    processed:["reverse","void","print"],
    reversed:["restore"],
    rejected:["restore"],
    cancelled:["restore"],
    voided:["restore"],
    deleted:["restore"],
  },

  /* ======================== 💰 REFUND DEPOSIT (DEPOSIT REFUNDS) ======================== */
    refund_deposit: {
      pending:   ["review", "edit", "cancel", "void"],
      review:    ["approve", "reject", "cancel", "void"],
      approved:  ["process", "void"],
      processed: ["reverse"],

      // ❌ NO restore here
      rejected:  [],
      cancelled: [],

      // ✅ restore allowed
      reversed:  ["restore"],
      voided:    ["restore"],
    },



  /* ======================== 🩹 SURGERY ======================== */
  surgery:{scheduled:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},

  /* ======================== 🩻 ULTRASOUND ======================== */
  ultrasound_record: {
    pending:      ["edit", "start", "cancel", "void"],
    in_progress:  ["complete", "cancel", "void"],
    completed:    ["verify", "void"],
    verified:     ["finalize", "void"],
    finalized:    ["void"],
    cancelled:    ["void"],
    voided:       []
  },

  /* ======================== 🧪 LAB ======================== */
  lab_request:{draft:["edit","submit","delete","void"],pending:["edit","cancel","void"],approved:["process","void"],processed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},
  lab_result:{draft:["edit","submit","delete","void"],pending:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["review","void"],reviewed:["verify","void"],verified:[],cancelled:["void"],voided:["restore"]},

  /* ======================== 🩸 VITAL ======================== */
  vital:{open:["edit","start","cancel","void"],in_progress:["complete","finalize","cancel","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},

  /* ======================== 🧠 MEDICAL RECORD ======================== */
  medical_record:{draft:["edit","review","delete","void"],reviewed:["finalize","void"],finalized:["verify","void"],verified:["void"],voided:["restore"]},

  /* ======================== 💊 PRESCRIPTION ======================== */
  prescription:{draft:["edit","submit","delete","void"],issued:["cancel","void"],dispensed:["complete","verify","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},

  /* ======================== 💊 PHARMACY TX ======================== */
  pharmacy_transaction:{
    pending:["dispense","cancel","void","delete"],
    dispensed:["verify","void"],
    partially_dispensed:["verify","void"],
    returned:["verify"],
    /*verified:["view"],*/
    cancelled:["restore"],
    voided:["restore"],
    deleted:["restore"]
  },
  /* ======================== 🤰 MATERNITY VISIT ======================== */
  maternity_visit: {
    scheduled:   ["edit","start","cancel","void"],
    in_progress: ["complete","cancel","void"],
    completed:   ["review","finalize","void"],
    reviewed:    ["finalize","void"],
    finalized:   ["verify","void"],
    verified:    ["void"],
    cancelled:   ["void"],
    voided:      ["restore"]
  },


  /* ======================== 🩺 PATIENT CHART ======================== */
  patientcharts:{
    active:["summary","revalidate","print","void"],
    stale:["summary","revalidate","print","void"],
    invalid:["summary","revalidate","print","restore"],
    voided:["restore"]
  },

  patientchart_cache:{
    active:["summary","revalidate","print"],
    stale:["summary","revalidate","print"],
    invalid:["summary","revalidate","print","restore"],
    voided:["restore"],
    deleted:["restore"]
  },

  patientchart_view_logs:{
    logged:["view"],
    reviewed:["view","verify"],
    verified:["view"],
    voided:["restore"]
  },

  /* ======================== 🧾 REGISTRATION ======================== */
  registration_log:{
    draft:["edit","submit","delete","void"],
    pending:["edit","activate","cancel","void"],
    active:["complete","cancel","void"],
    completed:["verify","void"],
    verified:["void"],
    cancelled:["void"],
    voided:["restore"]
  },
  /* ======================== 🏭 SUPPLIER ======================== */
  supplier: {
    active:   ["edit", "toggle-status", "delete"],
    inactive: ["edit", "toggle-status", "delete"],
    deleted:  ["restore"],
  },

  /* ======================== 💰 BILLING ======================== */
  billable_item: {
    active:   ["edit","toggle-status","delete"],
    inactive: ["edit","toggle-status","delete"],
    voided:   ["restore"],
    deleted:  ["restore"]
  },


  /* ======================== ⚡ BILLING TRIGGER ======================== */
  billing_trigger:{
    active:   ["edit","toggle-status","delete"],
    inactive: ["edit","toggle-status","delete"],
    deleted:  ["restore"]
  },

  /* ======================== 🏭 INVENTORY ======================== */
  central_stock: {
    active:   ["edit","toggle-status","lock","delete"],
    inactive: ["edit","toggle-status","lock","delete"],
    deleted:  ["restore"]
  },
  stock_request:{draft:["edit","submit","delete","void"],pending:["edit","approve","reject","cancel","void"],approved:["issue","cancel","void"],issued:["fulfill","void"],fulfilled:["void"],cancelled:["void"],voided:["restore"]},

  /* ======================== 🧩 MASTER DATA ======================== */
  master_item:{
    active:["edit","toggle-status","delete"],
    inactive:["edit","toggle-status","delete"],
    deleted:["restore"]
  },
  master_item_category:{
    active:["edit","toggle-status","delete"],
    inactive:["edit","toggle-status","delete"],
  },
  /* ======================== 👨‍💼 EMPLOYEE ======================== */
  employee:{active:["edit","toggle","delete"],inactive:["edit","toggle","delete"],terminated:["edit","toggle","delete"],deleted:["restore"]},

  /* ======================== 🏥 FACILITY ======================== */
  facility:{active:["edit","toggle","delete"],inactive:["edit","toggle","delete"],deleted:["restore"]},

  /* ======================== 🏢 ORGANIZATION ======================== */
  organization:{active:["edit","toggle","delete"],inactive:["edit","toggle","delete"],deleted:["restore"]},

  /* ======================== 🧍 PATIENT ======================== */
  patient:{active:["edit","toggle","delete"],inactive:["edit","toggle","delete"],cancelled:["edit","toggle","delete"],voided:["restore"],deleted:["restore"]},

  /* ======================== 🛡️ ADMIN ======================== */
  role:{
    active:["edit","toggle-status","delete"],
    inactive:["edit","toggle-status","delete"],
    deleted:["restore"]
  },
  permission:{active:["edit"]},
  department: {
    active:   ["edit","toggle-status","delete"],
    inactive: ["edit","toggle-status","delete"],
    deleted:  ["restore"]
  },

  /* ======================== 👤 USER ======================== */
  user:{
    active:["edit","toggle-status","reset-password","generate-token","revoke-sessions","delete"],
    inactive:["edit","toggle-status","restore"],
    locked:["unlock","reset-password","revoke-sessions"],
    deleted:["restore"]
  },

};


/* ============================================================
   🧱 BUTTON BUILDER HELPERS
============================================================ */
function buildButton(action, title, icon, color, id) {
  return `
  <button class="btn btn-outline-${color} btn-sm ${action}-btn"
      type="button" data-id="${id}" data-action="${action}"
      data-bs-toggle="tooltip" data-bs-title="${title}" aria-label="${title}">
      <i class="fas ${icon}" aria-hidden="true"></i>
  </button>`;
}

export function buildActionButtons({
  module,
  status,
  entry,
  entryId,
  user,
  permissionPrefix
}) {
  /* ========================= SAFETY ========================= */
  if (!module || !entryId || !user) return "";

  const isSuperAdmin =
    user?.role?.toLowerCase().includes("superadmin") ||
    (user?.roleNames || []).some(r =>
      r.toLowerCase().includes("superadmin")
    );

  const perms = new Set(
    (user?.permissions || []).map(p => p.toLowerCase().trim())
  );

  let allowed = STATUS_ACTION_MATRIX[module]?.[status] || [];
  /* ========================= NORMALIZE PATIENT TOGGLE ========================= */
  if (module === "patient") {
    allowed = allowed.map(a =>
      a === "toggle" ? "toggle-status" : a
    );
  }

  /* ========================= NORMALIZE INVENTORY ACTIONS ========================= */
  /* ========================= INVENTORY LOCK STATE ========================= */
  if (module === "central_stock") {
    if (entry?.is_locked === true) {
      allowed = allowed
        .filter(a => a !== "lock")
        .concat("unlock");
    } else {
      allowed = allowed
        .filter(a => a !== "unlock");
    }
  }

  
  if (module === "central_stock") {
    allowed = allowed.map(a =>
      a === "toggle" ? "toggle-status" : a
    );
  }

  /* ========================= CONTEXT FLAGS ========================= */
  const isDeposit        = module === "deposit";
  const isDiscount       = module === "discount";
  const isDiscountWaiver = module === "discount_waiver" || module === "discount-waiver";
  const isRefund         = module === "refund";
  const isRefundDeposit  = module === "refund_deposit";
  const isPharmacyTx     = module === "pharmacy_transaction";
  const isUser           = module === "user";

  /* ========================= RULE ADJUSTMENTS ========================= */

  // Deposit
  if (isDeposit) {
    const remaining = parseFloat(entry?.remaining_balance || 0);
    if (["cleared", "applied"].includes(status) && remaining <= 0)
      allowed = allowed.filter(a => a !== "apply");
    if (remaining > 0)
      allowed = allowed.filter(a => a !== "verify");
  }

  // Refund
  if (isRefund && ["reversed","cancelled","rejected","voided"].includes(status))
    allowed = allowed.filter(a => !["process","approve"].includes(a));

  // Refund Deposit
  if (isRefundDeposit && ["reversed","voided"].includes(status))
    allowed = allowed.filter(a => !["approve","process"].includes(a));

  // System user safety
  if (isUser && entry?.is_system)
    allowed = allowed.filter(a => a !== "toggle-status");

  /* ========================= ORDER ========================= */
  const ORDER = [
    "view","edit","start",
    "dispense","partial-dispense",
    "complete","review","verify","finalize",
    "apply","process","reverse","clear","revert",
    "approve","reject","cancel","void",
    "toggle-status","lock","unlock",
    "restore","delete","print",
    "reset-password","generate-token","revoke-sessions"
  ];

  allowed.sort(
    (a, b) =>
      (ORDER.indexOf(a) === -1 ? 999 : ORDER.indexOf(a)) -
      (ORDER.indexOf(b) === -1 ? 999 : ORDER.indexOf(b))
  );

  /* ========================= ICONS ========================= */
  const icons = {
    /* 👁️ Core */
    view: "fa-eye",
    edit: "fa-pen",
    start: "fa-play",
    activate: "fa-calendar-check",
    "no-show": "fa-user-slash",

    /* 💊 Pharmacy / Clinical */
    dispense: "fa-pills",
    "partial-dispense": "fa-divide",

    /* ✅ Workflow */
    complete: "fa-check",
    review: "fa-search",
    verify: "fa-clipboard-check",
    finalize: "fa-flag-checkered",

    /* 🔗 Processing */
    apply: "fa-link",
    process: "fa-gears",
    reverse: "fa-rotate-left",
    clear: "fa-check-double",
    revert: "fa-undo-alt",

    /* 👍 Decisions */
    approve: "fa-thumbs-up",
    reject: "fa-thumbs-down",
    cancel: "fa-ban",

    /* 🚫 Destructive */
    void: "fa-times-circle",
    restore: "fa-undo",
    delete: "fa-trash",

    /* 🖨️ Output */
    print: "fa-print",

    /* 🔄 Status toggle (generic modules) */
    "toggle-status":
      status === "active" ? "fa-user-slash" : "fa-user-check",

    /* 🏭 INVENTORY (Central Stock) */
    toggle:
      status === "active" ? "fa-toggle-off" : "fa-toggle-on",

    lock:   "fa-lock",
    unlock: "fa-lock-open",

    /* 👤 User / Security */
    "reset-password": "fa-key",
    "generate-token": "fa-ticket-alt",
    "revoke-sessions": "fa-sign-out-alt",

    /* 🧠 System */
    summary: "fa-file-medical",
    revalidate: "fa-sync-alt",
  };

  /* ========================= TITLES ========================= */
  const titles = {
    /* 👁️ Core */
    view: "View",
    edit: "Edit",

    /* ▶️ Lifecycle */
    start: "Start",
    complete: "Complete",
    review: "Review",
    verify: "Verify",
    finalize: "Finalize",

    /* 📅 Appointment */
    activate:
      module === "appointment" ? "Activate Appointment"
    : module === "registration_log" ? "Activate Registration"
    : "Activate",
    "no-show": "Mark No Show",

    /* 🔗 Processing */
    clear: isDeposit ? "Clear Deposit" : "Clear Record",
    revert: "Revert to Pending",

    apply: isDeposit ? "Apply Deposit"
        : isDiscountWaiver ? "Apply Waiver"
        : isDiscount ? "Apply Discount"
        : isRefund ? "Apply Refund"
        : isPharmacyTx ? "Apply Pharmacy Transaction"
        : module === "invoice" ? "Apply Invoice"
        : "Apply",

    process: isRefundDeposit ? "Process Deposit Refund"
          : isRefund ? "Process Refund"
          : isDiscountWaiver ? "Process Waiver"
          : isPharmacyTx ? "Process Pharmacy Transaction"
          : module === "invoice" ? "Process Invoice"
          : "Process",

    reverse: isRefundDeposit ? "Reverse Deposit Refund"
          : isRefund ? "Reverse Refund"
          : isDeposit ? "Reverse Deposit"
          : isDiscountWaiver ? "Reverse Waiver"
          : isDiscount ? "Reverse Discount"
          : isPharmacyTx ? "Reverse Transaction"
          : module === "invoice" ? "Reverse Invoice"
          : "Reverse",

    /* 👍 Decisions */
    approve: isRefundDeposit ? "Approve Deposit Refund"
          : isRefund ? "Approve Refund"
          : "Approve",

    reject: isRefundDeposit ? "Reject Deposit Refund"
          : isRefund ? "Reject Refund"
          : "Reject",

    cancel: isRefundDeposit ? "Cancel Deposit Refund"
          : isRefund ? "Cancel Refund"
          : "Cancel",

    /* 🖨️ Output */
    print: isRefundDeposit ? "Print Deposit Refund Receipt"
        : isRefund ? "Print Refund Receipt"
        : isDeposit ? "Print Deposit Receipt"
        : module === "invoice" ? "Print Invoice"
        : "Print",

    /* 🔄 Status (generic) */
    "toggle-status":
      status === "active" ? "Deactivate" : "Activate",

    /* 🏭 INVENTORY (Central Stock) */
    toggle:
      status === "active" ? "Deactivate Stock" : "Activate Stock",
    lock:
      entry?.is_locked === true ? "Unlock Stock" : "Lock Stock",

    unlock:
      entry?.is_locked === true ? "Unlock Stock" : "Lock Stock",


    /* 👤 User / Security */
    "reset-password": "Reset Password",
    "generate-token": "Generate Reset Token",
    "revoke-sessions": "Revoke Sessions",
  };


  /* ========================= BUILD ========================= */
  let html = "";

  if (perms.has(`${permissionPrefix}:view`) || isSuperAdmin) {
    html += buildButton(
      "view",
      titles.view,
      icons.view,
      "primary",
      entryId
    );
  }

  for (const act of allowed) {
    let backend = act;

    /* =========================
      NORMALIZE TO DB PERMS
    ========================= */
  if (act === "toggle-status") {
    backend = "toggle_status";
  }
    /* =========================
      MODULE-SPECIFIC OVERRIDES
    ========================= */
    if (module === "user" && act === "toggle-status") {
      backend = "edit";
    }
    if (module === "supplier" && act === "toggle-status") {
      backend = "update";
    }
    /* =========================
      INVENTORY LOCK
    ========================= */
    if (act === "lock" || act === "unlock") {
      backend = "update";
    }
    const permKey = `${permissionPrefix}:${backend}`;

    if (isSuperAdmin || perms.has(permKey)) {
      html += buildButton(
        act,
        titles[act] || act,
        icons[act] || "fa-cog",
        {
          view: "primary",
          edit: "success",
          start: "primary",
          complete: "success",
          review: "warning",
          verify: "info",
          finalize: "dark",
          apply: "primary",
          process: "info",
          reverse: "warning",
          clear: "success",
          revert: "secondary",
          approve: "success",
          reject: "danger",
          cancel: "warning",
          void: "danger",
          restore: "primary",
          delete: "danger",
          print: "info",
          "toggle-status": "secondary",
          unlock: "warning",
          "reset-password": "warning",
          "generate-token": "info",
          "revoke-sessions": "danger"
        }[act] || "secondary",
        entryId
      );
    }
  }

  return `<div class="d-inline-flex gap-1">${html}</div>`;
}


/* ============================================================
   Action Labels Default (GLOBAL FALLBACK)
   Used ONLY when titles[action] is missing
   ⚠️ Must remain generic + inventory-safe
============================================================ */
const actionLabels = {
  /* 👁️ Base */
  view: "View",
  edit: "Edit",

  /* ▶️ Lifecycle */
  start: "Start",
  complete: "Complete",
  review: "Review",
  verify: "Verify",
  finalize: "Finalize",

  /* 🔗 Processing (generic fallback only) */
  apply: "Apply",
  process: "Process",
  reverse: "Reverse",
  clear: "Clear",
  revert: "Revert",

  /* 👍 Decisions */
  approve: "Approve",
  reject: "Reject",
  cancel: "Cancel",

  /* 🚫 Destructive */
  void: "Void",
  restore: "Restore",
  delete: "Delete",

  /* 🖨️ Output */
  print: "Print",

  /* 🔄 Status (neutral fallback) */
  "toggle-status": "Activate / Deactivate",

  /* 🏭 INVENTORY-SAFE FALLBACKS */
  lock: "Lock",
  unlock: "Unlock",

  /* 👤 USER / SECURITY (fallback only — titles override this) */
  "reset-password": "Reset Password",
  "generate-token": "Generate Reset Token",
  "revoke-sessions": "Revoke Sessions",

  /* 🧠 Advanced / system */
  summary: "Summary",
  revalidate: "Revalidate",
};

