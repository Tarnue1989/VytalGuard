// 📦 insurance-claim-render.js – Entity Card System (INSURANCE CLAIM | FINAL FIXED)

import { FIELD_LABELS_INSURANCE_CLAIM } from "./insurance-claims-constants.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";
import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================ */
const SORTABLE_FIELDS=new Set([
  "organization_id","facility_id","patient_id","provider_id","invoice_id",
  "invoice_total","insurance_amount","patient_amount",
  "amount_claimed","amount_approved","amount_paid",
  "status","created_at","updated_at"
]);

let sortBy=localStorage.getItem("insuranceClaimSortBy")||"";
let sortDir=localStorage.getItem("insuranceClaimSortDir")||"asc";

function toggleSort(field){
  if(sortBy===field)sortDir=sortDir==="asc"?"desc":"asc";
  else{sortBy=field;sortDir="asc";}
  localStorage.setItem("insuranceClaimSortBy",sortBy);
  localStorage.setItem("insuranceClaimSortDir",sortDir);
  window.setInsuranceClaimSort?.(sortBy,sortDir);
  window.loadInsuranceClaimPage?.(1);
}

/* ============================================================ */
function getInsuranceClaimActionButtons(entry,user){
  return buildActionButtons({
    module:"insurance_claim",
    status:(entry.status||"").toLowerCase(),
    entry,entryId:entry.id,user,
    permissionPrefix:"insurance_claims"
  });
}

/* ============================================================ */
export function renderDynamicTableHead(visibleFields){
  const thead=document.getElementById("dynamicTableHead");
  const table=thead?.closest("table");
  if(!thead||!table)return;

  thead.innerHTML="";
  const tr=document.createElement("tr");

  visibleFields.forEach(field=>{
    const th=document.createElement("th");
    th.dataset.key=field;

    const label=FIELD_LABELS_INSURANCE_CLAIM[field]||field.replace(/_/g," ");

    if(field==="actions"){
      th.textContent="Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    if(SORTABLE_FIELDS.has(field)){
      let icon="ri-arrow-up-down-line";
      if(sortBy===field)icon=sortDir==="asc"?"ri-arrow-up-line":"ri-arrow-down-line";
      th.classList.add("sortable");
      th.innerHTML=`<span>${label}</span><i class="${icon} sort-icon"></i>`;
      th.onclick=()=>toggleSort(field);
    }else{
      th.innerHTML=`<span>${label}</span>`;
    }

    tr.appendChild(th);
  });

  thead.appendChild(tr);

  let colgroup=table.querySelector("colgroup");
  if(colgroup)colgroup.remove();

  colgroup=document.createElement("colgroup");
  visibleFields.forEach(()=>{
    const col=document.createElement("col");
    col.style.width="160px";
    colgroup.appendChild(col);
  });
  table.prepend(colgroup);

  enableColumnResize(table);
  enableColumnDrag({table,visibleFields,onReorder:()=>window.loadInsuranceClaimPage?.(1)});
}

/* ============================================================ */
const safe=v=>(v!==null&&v!==undefined&&v!==""?v:"—");

function renderUserName(u){
  if(!u)return"—";
  return[u.first_name,u.middle_name,u.last_name].filter(Boolean).join(" ")||u.full_name||"—";
}

function renderPatient(entry){
  if(!entry.patient)return"—";
  const p=entry.patient;
  return`${p.pat_no||"—"} - ${[p.first_name,p.middle_name,p.last_name].filter(Boolean).join(" ")}`;
}

function renderProvider(entry){
  return entry.provider?.name||"—";
}

/* ============================================================ */
function renderValue(entry,field){
  switch(field){
    case"claim_number":return safe(entry.claim_number);

    case"status":{
      const s=(entry.status||"").toLowerCase();
      return`<span class="badge bg-primary">${s.toUpperCase()}</span>`;
    }

    case"organization":
    case"organization_id":return entry.organization?.name||"—";

    case"facility":
    case"facility_id":return entry.facility?.name||"—";

    case"patient":
    case"patient_id":return renderPatient(entry);

    case"provider":
    case"provider_id":return renderProvider(entry);

    /* ✅ FIXED */
    case"invoice":
    case"invoice_id":
      return entry.invoice?.invoice_number || "—";

    case"invoice_total":
    case"insurance_amount":
    case"patient_amount":
    case"amount_claimed":
    case"amount_approved":
    case"amount_paid":
      return entry[field]!=null
        ?`${getCurrencySymbol(entry.currency)} ${Number(entry[field]).toFixed(2)}`
        :"—";

    case"currency":return entry.currency||"—";

    case"payment_reference":
    case"rejection_reason":
    case"notes":return safe(entry[field]);

    case"createdBy":return renderUserName(entry.createdBy);
    case"updatedBy":return renderUserName(entry.updatedBy);
    case"deletedBy":return renderUserName(entry.deletedBy);

    case"created_at":
    case"updated_at":
    case"deleted_at":return entry[field]?formatDateTime(entry[field]):"—";

    default:return safe(entry[field]);
  }
}

/* ============================================================ */
export function renderCard(entry,visibleFields,user){
  const status=(entry.status||"").toLowerCase();

  const row=(label,value)=>{
    if(!value)return"";
    return`
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${safe(value)}</span>
      </div>
    `;
  };

  return`
    <div class="entity-card insurance-claim-card">

      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">${safe(entry.claim_number)}</div>
        </div>
        <span class="entity-status ${status}">${status.toUpperCase()}</span>
      </div>

      <div class="entity-card-body">
        ${row("Provider",renderProvider(entry))}

        ${row("Invoice",entry.invoice?.invoice_number)}

        ${row("Invoice Total",`${getCurrencySymbol(entry.currency)} ${Number(entry.invoice_total||0).toFixed(2)}`)}
        ${row("Insurance Amount",`${getCurrencySymbol(entry.currency)} ${Number(entry.insurance_amount||0).toFixed(2)}`)}
        ${row("Patient Amount",`${getCurrencySymbol(entry.currency)} ${Number(entry.patient_amount||0).toFixed(2)}`)}

        ${row("Amount Claimed",`${getCurrencySymbol(entry.currency)} ${Number(entry.amount_claimed||0).toFixed(2)}`)}
        ${row("Amount Approved",`${getCurrencySymbol(entry.currency)} ${Number(entry.amount_approved||0).toFixed(2)}`)}
        ${row("Amount Paid",`${getCurrencySymbol(entry.currency)} ${Number(entry.amount_paid||0).toFixed(2)}`)}
      </div>

      <details class="entity-section">
        <summary><strong>Details</strong></summary>
        <div class="entity-card-body">
          ${row("Claim Date",formatDateTime(entry.claim_date))}
          ${row("Response Date",formatDateTime(entry.response_date))}
        </div>
      </details>

      <details class="entity-section">
        <summary><strong>Audit</strong></summary>
        <div class="entity-card-body">
          ${row("Created By",renderUserName(entry.createdBy))}
          ${row("Created At",formatDateTime(entry.created_at))}
          ${row("Updated By",renderUserName(entry.updatedBy))}
          ${row("Updated At",formatDateTime(entry.updated_at))}
        </div>
      </details>

      <div class="entity-card-footer export-ignore">
        ${getInsuranceClaimActionButtons(entry,user)}
      </div>

    </div>
  `;
}

/* ============================================================ */
export function renderList({entries,visibleFields,viewMode,user}){
  const tableBody=document.getElementById("insuranceClaimTableBody");
  const cardContainer=document.getElementById("insuranceClaimList");
  const tableContainer=document.querySelector(".table-container");

  if(!tableBody||!cardContainer||!tableContainer)return;

  tableBody.innerHTML="";
  cardContainer.innerHTML="";

  if(viewMode==="table"){
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");
    renderDynamicTableHead(visibleFields);

    if(!entries.length){
      tableBody.innerHTML=`<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No insurance claims found.</td></tr>`;
      return;
    }

    entries.forEach(e=>{
      const tr=document.createElement("tr");
      tr.innerHTML=visibleFields.map(f=>
        f==="actions"
          ?`<td class="actions-cell">${getInsuranceClaimActionButtons(e,user)}</td>`
          :`<td>${renderValue(e,f)}</td>`
      ).join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  }else{
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    cardContainer.innerHTML=entries.length
      ?entries.map(e=>renderCard(e,visibleFields,user)).join("")
      :`<p class="text-center text-muted">No insurance claims found.</p>`;

    initTooltips(cardContainer);
  }
}