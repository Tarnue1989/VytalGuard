// 📦 STATUS ACTION MATRIX – COMPACT ENTERPRISE (SPACE OPTIMIZED)

export const STATUS_ACTION_MATRIX = {
  /* 🩺 CLINICAL */
  consultation:{open:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},
  triage_record:{open:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},
  ekg_record:{pending:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["review","finalize","void"],reviewed:["finalize","void"],finalized:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},
  delivery_record:{scheduled:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},

  /* 📅 APPOINTMENT */
  appointment:{
    scheduled:["edit","activate","cancel","no-show","void"],
    in_progress:["complete","cancel","void"],
    completed:["verify","void"],
    verified:[],cancelled:["restore"],no_show:["restore"],voided:["restore"],deleted:[]
  },

  /* 🏥 INSURANCE */
  insurance_provider:{active:["edit","toggle-status","delete"],inactive:["edit","toggle-status","delete"],deleted:["restore"]},
  patient_insurances:{active:["edit","toggle-status","delete","print"],inactive:["edit","toggle-status","delete"],cancelled:["restore"],deleted:["restore"]},

  insurance_claim:{
    draft:["edit","submit","delete","view-invoice","print-invoice"],
    submitted:["review","view-invoice","print-invoice"],
    in_review:["approve","partial-approve","reject","view-invoice","print-invoice"],
    approved:["process-payment","view-invoice","print-invoice"],
    partially_approved:["process-payment","view-invoice","print-invoice"],
    processing_payment:["mark-paid","view-invoice","print-invoice"],
    paid:["reverse-payment","view-invoice","print-invoice"],
    rejected:["view-invoice"],
    cancelled:["view-invoice"],
    voided:["view-invoice"],
    reversed:["view-invoice"]
  },

  /* 💰 DEPOSIT / PAYMENT */
  deposit:{
    pending:["edit","clear","cancel","void","print"],
    cleared:["apply","void","reverse","print"],
    applied:["apply","reverse","verify","void","print"],
    verified:["print"],cancelled:["restore"],reversed:["restore"],voided:["restore"],deleted:["restore"]
  },
  /* 💰 CASH CLOSING */
  cash_closing:{
    locked:["view","print","reopen"],
    open:["view","print"]
  },
  payment:{
    pending:["edit","complete","cancel","void","delete"],
    completed:["verify","void","print"],
    verified:["print"],cancelled:["restore"],reversed:["restore"],voided:["restore"],deleted:["restore"]
  },

  /* 🧾 INVOICE */
  invoice:{
    draft:["edit","void"],
    unpaid:["collect","deposit","waiver","void","print"],
    partial:["collect","deposit","waiver","refund","void","print"],
    paid:["refund","reverse","print"],
    cancelled:["restore"],voided:["restore"],deleted:["restore"]
  },

  /* 💸 DISCOUNTS */
  discount:{
    draft:["edit","toggle-status","void"],
    active:["toggle-status","finalize","void","print"],
    inactive:["toggle-status","void","print"],
    finalized:["void","restore","print"],
    voided:["restore"],deleted:["restore"]
  },

  discount_waiver:{
    pending:["edit","approve","reject","void","delete"],
    approved:["finalize","void","print"],
    applied:["void","print"],
    finalized:["print","void","restore"],
    rejected:["restore","print"],
    voided:["restore"],deleted:["restore"]
  },

  /* 💵 REFUNDS */
  refund:{
    pending:["edit","approve","reject","cancel","void","delete"],
    approved:["process","cancel","void"],
    processed:["print"],
    reversed:["restore"],rejected:["restore"],cancelled:["restore"],voided:["restore"],deleted:["restore"]
  },

  refund_deposits:{
    pending:["review","edit","cancel","void","print"],
    review:["approve","reject","cancel","void","print"],
    approved:["process","void","print"],
    processed:["print"],
    reversed:["restore","print"],
    voided:["restore"],rejected:[],cancelled:[]
  },

  /* 🧪 MEDICAL */
  surgery:{scheduled:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},

  ultrasound_record:{
    pending:["edit","start","cancel","void"],
    in_progress:["complete","cancel","void"],
    completed:["verify","void"],
    verified:["finalize","void"],
    finalized:["void"],cancelled:["void"],voided:[]
  },

  lab_request:{draft:["edit","submit","delete","void"],pending:["edit","cancel","void"],approved:["process","void"],processed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},
  lab_result:{draft:["edit","submit","delete","void"],pending:["edit","start","cancel","void"],in_progress:["complete","cancel","void"],completed:["review","void"],reviewed:["verify","void"],verified:[],cancelled:["void"],voided:["restore"]},

  vital:{open:["edit","start","cancel","void"],in_progress:["complete","finalize","cancel","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},

  medical_record:{draft:["edit","review","delete","void"],reviewed:["finalize","void"],finalized:["verify","void"],verified:["void"],voided:["restore"]},

  prescription:{draft:["edit","submit","delete","void"],issued:["cancel","void"],dispensed:["complete","verify","void"],completed:["verify","void"],verified:["void"],cancelled:["void"],voided:["restore"]},

  pharmacy_transaction:{
    pending:["dispense","cancel","void","delete"],
    dispensed:["verify","void"],
    partially_dispensed:["verify","void"],
    returned:["verify"],
    cancelled:["restore"],voided:["restore"],deleted:["restore"]
  },

  maternity_visit:{
    scheduled:["edit","start","cancel","void"],
    in_progress:["complete","cancel","void"],
    completed:["review","finalize","void"],
    reviewed:["finalize","void"],
    finalized:["verify","void"],
    verified:["void"],cancelled:["void"],voided:["restore"]
  },
  /* 💸 EXPENSE (FINAL ENTERPRISE) */
  expense:{
    draft:["edit","submit","delete","void"],
    pending:["edit","approve","cancel","void"],
    approved:["post","void"],
    posted:["reverse"],
    cancelled:["restore"],
    voided:["restore"],
    reversed:["restore"]
  },
    /* 💰 PAYROLL */
  payroll:{
    draft:["edit","approve","delete","void"],
    approved:["pay","void"],
    paid:["void"],
    voided:["restore"]
  },
  /* 📊 PATIENT CHART */
  patientcharts:{active:["summary","revalidate","print","void"],stale:["summary","revalidate","print","void"],invalid:["summary","revalidate","print","restore"],voided:["restore"]},
  patientchart_cache:{active:["summary","revalidate","print"],stale:["summary","revalidate","print"],invalid:["summary","revalidate","print","restore"],voided:["restore"],deleted:["restore"]},
  patientchart_view_logs:{logged:["view"],reviewed:["view","verify"],verified:["view"],voided:["restore"]},

  /* 🧾 REGISTRATION / ORDER */
  registration_log:{
    draft:["edit","submit","delete","void"],
    pending:["edit","activate","cancel","void"], // ✅ added verify
    active:["complete","cancel","void"],
    completed:["void"],
    verified:["void"],
    cancelled:["void"],
    voided:["restore"]
  },
  order:{
    draft:["edit","submit","delete","void"],
    pending:["activate","cancel","void"],
    in_progress:["complete","cancel","void"],
    completed:["verify","void"],
    verified:["finalize","void"],
    finalized:["void"],cancelled:["void"],voided:["restore"]
  },

  /* 🏭 CORE ENTITIES */
  supplier:{active:["edit","toggle-status","delete"],inactive:["edit","toggle-status","delete"],deleted:["restore"]},
  billable_item:{active:["edit","toggle-status","delete"],inactive:["edit","toggle-status","delete"],voided:["restore"],deleted:["restore"]},
  billing_trigger:{active:["edit","toggle-status","delete"],inactive:["edit","toggle-status","delete"],deleted:["restore"]},

  /* 🏭 INVENTORY */
  central_stock:{active:["edit","toggle-status","lock","delete"],inactive:["edit","toggle-status","lock","delete"],deleted:["restore"]},
  stock_request:{draft:["edit","submit","delete","void"],pending:["edit","approve","reject","cancel","void"],approved:["issue","cancel","void"],issued:["fulfill","void"],fulfilled:["void"],cancelled:["void"],voided:["restore"]},

  /* 🧩 MASTER */
  master_item:{active:["edit","toggle-status","delete"],inactive:["edit","toggle-status","delete"],deleted:["restore"]},
  master_item_category:{active:["edit","toggle-status","delete"],inactive:["edit","toggle-status","delete"]},

  /* 👨‍💼 ADMIN */
  employee:{active:["edit","toggle","delete"],inactive:["edit","toggle","delete"],terminated:["edit","toggle","delete"],deleted:["restore"]},
  facility:{active:["edit","toggle","delete"],inactive:["edit","toggle","delete"],deleted:["restore"]},
  organization:{active:["edit","toggle","delete"],inactive:["edit","toggle","delete"],deleted:["restore"]},
  patient:{active:["edit","toggle","delete"],inactive:["edit","toggle","delete"],cancelled:["edit","toggle","delete"],voided:["restore"],deleted:["restore"]},

  role:{active:["edit","toggle-status","delete"],inactive:["edit","toggle-status","delete"],deleted:["restore"]},
  permission:{active:["edit"]},
  department:{active:["edit","toggle-status","delete"],inactive:["edit","toggle-status","delete"],deleted:["restore"]},

  /* 👤 USER */
  user:{
    active:["edit","toggle-status","reset-password","generate-token","revoke-sessions","delete"],
    inactive:["edit","toggle-status","restore"],
    locked:["unlock","reset-password","revoke-sessions"],
    deleted:["restore"]
  }
};


/* ============================================================
   🧱 BUTTON BUILDER – FINAL ENTERPRISE (COMPACT + CONSISTENT)
============================================================ */

/* ================= BUTTON ================= */
function buildButton(a,t,i,c,id){
  return `<button class="btn btn-outline-${c} btn-sm ${a}-btn"
    type="button" data-id="${id}" data-action="${a}"
    data-bs-toggle="tooltip" data-bs-title="${t}" aria-label="${t}">
    <i class="fa-solid ${i}"></i></button>`;
}

/* ================= ICONS ================= */
const ICONS = {
  view:"fa-eye",edit:"fa-pen-to-square",
  start:"fa-play",activate:"fa-bolt","no-show":"fa-user-xmark",
  dispense:"fa-capsules","partial-dispense":"fa-circle-half-stroke",
  complete:"fa-check-circle",review:"fa-magnifying-glass",
  verify:"fa-badge-check",finalize:"fa-flag-checkered",
  apply:"fa-link",process:"fa-gears",reverse:"fa-rotate-left",
  clear:"fa-broom",revert:"fa-rotate-back",
  collect:"fa-money-bill",deposit:"fa-piggy-bank",
  waiver:"fa-file-invoice",refund:"fa-money-bill-transfer",
  approve:"fa-circle-check",reject:"fa-circle-xmark",cancel:"fa-ban",
  void:"fa-xmark-circle",restore:"fa-arrow-rotate-right",delete:"fa-trash",
  print:"fa-print",
  pay:"fa-money-bill-wave", reopen:"fa-rotate-right",
  "view-invoice":"fa-file-invoice",
  "print-invoice":"fa-print",

  // ✅ ONLY THIS PART CHANGED
  "toggle-status":"fa-toggle-on",
  toggle:"fa-toggle-on",

  lock:"fa-lock",unlock:"fa-lock-open",
  "reset-password":"fa-key","generate-token":"fa-ticket","revoke-sessions":"fa-right-from-bracket",
  summary:"fa-file-medical",revalidate:"fa-arrows-rotate",
  submit:"fa-paper-plane",issue:"fa-truck",fulfill:"fa-box-check",
  "process-payment":"fa-credit-card","mark-paid":"fa-dollar-sign"
};

/* ================= COLORS ================= */
const COLORS = {
  view:"primary",edit:"success",start:"primary",complete:"success",
  review:"warning",verify:"info",finalize:"dark",
  apply:"primary",process:"info",reverse:"warning",clear:"success",revert:"secondary",
  approve:"success",reject:"danger",cancel:"warning",
  void:"danger",restore:"primary",delete:"danger",
  print:"info","toggle-status":"secondary",
  lock:"secondary",unlock:"warning", pay:"success",  reopen:"warning",
  "reset-password":"warning","generate-token":"info","revoke-sessions":"danger",
  "view-invoice":"primary",
  "print-invoice":"info",
};

/* ================= ORDER ================= */
const ORDER = [
  "view","view-invoice","edit","start","activate",
  "dispense","partial-dispense",
  "complete","review","verify","finalize",
  "apply","process","reverse","clear","revert",
  "approve","reject","cancel","void",
  "toggle-status","lock","unlock",
  "restore","delete","print","print-invoice",
  "reset-password","generate-token","revoke-sessions"
];
const actionLabels = {
  view:"View",edit:"Edit",
  start:"Start",complete:"Complete",review:"Review",verify:"Verify",finalize:"Finalize",
  apply:"Apply",process:"Process",reverse:"Reverse",clear:"Clear",revert:"Revert",
  approve:"Approve",reject:"Reject",cancel:"Cancel",
  void:"Void",restore:"Restore",delete:"Delete",
  print:"Print",
  "toggle-status":"Activate / Deactivate",
  lock:"Lock",unlock:"Unlock",
  "reset-password":"Reset Password",
  "generate-token":"Generate Token",
  "revoke-sessions":"Revoke Sessions",
  submit:"Submit",issue:"Issue",fulfill:"Fulfill",
  "process-payment":"Process Payment","mark-paid":"Mark Paid",
  "view-invoice":"Invoice",
  "print-invoice":"Print Invoice",
};

/* ================= MAIN ================= */
export function buildActionButtons({module,status,entry,entryId,user,permissionPrefix}){
  if(!module||!entryId||!user)return "";

  const isSuperAdmin =
    user?.role?.toLowerCase().includes("superadmin") ||
    (user?.roleNames||[]).some(r=>r.toLowerCase().includes("superadmin"));

  const perms=new Set((user?.permissions||[]).map(p=>p.toLowerCase().trim()));

  let allowed=[...(new Set(STATUS_ACTION_MATRIX[module]?.[status]||[]))];

  /* ===== NORMALIZE ===== */
  if(module==="patient")allowed=allowed.map(a=>a==="toggle"?"toggle-status":a);

  if(module==="central_stock"){
    allowed=entry?.is_locked
      ? allowed.filter(a=>a!=="lock").concat("unlock")
      : allowed.filter(a=>a!=="unlock");

    allowed=allowed.map(a=>a==="toggle"?"toggle-status":a);
  }

  /* ===== CONTEXT ===== */
  const isDeposit=module==="deposit";
  const isDiscount=module==="discount";
  const isDiscountWaiver=module==="discount_waiver"||module==="discount-waiver";
  const isRefund=module==="refund";
  const isRefundDeposit=module==="refund_deposits";
  const isPharmacyTx=module==="pharmacy_transaction";
  const isUser=module==="user";

  /* ===== RULES ===== */
  if(isDeposit){
    const r=parseFloat(entry?.remaining_balance||0);
    if(["cleared","applied"].includes(status)&&r<=0)allowed=allowed.filter(a=>a!=="apply");
    if(r>0)allowed=allowed.filter(a=>a!=="verify");
  }

  if(isRefund&&["reversed","cancelled","rejected","voided"].includes(status))
    allowed=allowed.filter(a=>!["process","approve"].includes(a));

  if(isRefundDeposit&&["reversed","voided"].includes(status))
    allowed=allowed.filter(a=>!["approve","process"].includes(a));

  if(isUser&&entry?.is_system)
    allowed=allowed.filter(a=>a!=="toggle-status");

  /* ===== SORT ===== */
  allowed.sort((a,b)=>(ORDER.indexOf(a)===-1?999:ORDER.indexOf(a))-(ORDER.indexOf(b)===-1?999:ORDER.indexOf(b)));

  /* ===== BUILD ===== */
  let html="";

  for(const act of allowed){
    let backend = act.replaceAll("-", "_");
    const permKey=`${permissionPrefix}:${backend}`;

    if(isSuperAdmin||perms.has(permKey)){
      html+=buildButton(
        act,
        (actionLabels[act] || act),
        ICONS[act]||"fa-circle-question",
        COLORS[act]||"secondary",
        entryId
      );
    }
  }

  return `<div class="d-inline-flex gap-1">${html}</div>`;
}