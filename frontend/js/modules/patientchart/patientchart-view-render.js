// 📘 patientchart-view-render.js – Enterprise Tabbed Renderer for Unified Patient Chart
// ============================================================================
// 🔹 Works with both cached and direct responses (chart_snapshot or data)
// 🔹 Displays compact high-level info for each section (Vitals, Labs, Meds, etc.)
// 🔹 Fully aligned with patientChartService.getFullChart()
// ============================================================================

import { formatDate as formatDateTime } from "../../utils/ui-utils.js";
import { safeText } from "../../utils/render-utils.js";

/* ============================================================
   🩺 MAIN ENTRY – RENDER FULL PATIENT CHART (TABBED)
============================================================ */
export function renderCard(chartResponse, visibleFields = {}, user = {}) {
  // ✅ Auto-detect cached vs direct response
  const chart =
    chartResponse?.chart_snapshot ||
    chartResponse?.data?.chart_snapshot ||
    chartResponse?.data ||
    chartResponse;

  if (!chart || !chart.patient)
    return `<p class="text-muted">No patient chart data available.</p>`;

  const tabs = [
    { id: "info", label: "Patient Info", icon: "ri-user-3-line" },
    { id: "visits", label: "Visits", icon: "ri-file-list-3-line" },
    { id: "timeline", label: "Timeline", icon: "ri-time-line" },
    { id: "labs", label: "Labs", icon: "ri-flask-line" },
    { id: "vitals", label: "Vitals", icon: "ri-heart-pulse-line" },
    { id: "medications", label: "Medications", icon: "ri-capsule-line" },
    { id: "ekgs", label: "EKG", icon: "ri-pulse-line" },
    { id: "deliveries", label: "Deliveries", icon: "ri-baby-line" },
    { id: "notes", label: "Notes", icon: "ri-sticky-note-line" },
    { id: "billing", label: "Billing", icon: "ri-bill-line" },
  ];

  /* ============================================================
     🧭 TAB HEADERS
  ============================================================ */
  let html = `
    <ul class="nav nav-tabs mb-3" id="patientChartTabs" role="tablist">
      ${tabs
        .map(
          (t, i) => `
          <li class="nav-item" role="presentation">
            <button class="nav-link ${i === 0 ? "active" : ""}" 
              id="${t.id}-tab" data-bs-toggle="tab" data-bs-target="#${t.id}-tab-pane" 
              type="button" role="tab" aria-controls="${t.id}-tab-pane" aria-selected="${i === 0}">
              <i class="${t.icon} me-1"></i>${t.label}
            </button>
          </li>`
        )
        .join("")}
    </ul>
  `;

  /* ============================================================
     🧩 TAB CONTENT PANES
  ============================================================ */
  html += `<div class="tab-content" id="patientChartTabsContent">`;

  // 👤 Patient Info
  html += `
    <div class="tab-pane fade show active" id="info-tab-pane" role="tabpanel">
      ${renderPatientInfo(chart.patient)}
      ${renderRegistrationLogs(chart.registration_logs)}
    </div>`;

  // 🩺 Visits
  html += `
    <div class="tab-pane fade" id="visits-tab-pane" role="tabpanel">
      ${renderVisits(chart.visits)}
      ${!chart.visits?.length ? `<p class="text-muted">No visits available.</p>` : ""}
    </div>`;

  // 🕒 Timeline
  html += `
    <div class="tab-pane fade" id="timeline-tab-pane" role="tabpanel">
      ${renderTimeline(chart.timeline)}
    </div>`;

  // 🧪 Labs
  html += `
    <div class="tab-pane fade" id="labs-tab-pane" role="tabpanel">
      ${renderLabRequests(chart.labs)}
    </div>`;

  // ❤️‍🩹 Vitals
  html += `
    <div class="tab-pane fade" id="vitals-tab-pane" role="tabpanel">
      ${renderVitals(chart.vitals)}
    </div>`;

  // 💊 Medications (NEW compact summary)
  html += `
    <div class="tab-pane fade" id="medications-tab-pane" role="tabpanel">
      ${renderMedications(chart.medications)}
    </div>`;

  // ⚡ EKG
  html += `
    <div class="tab-pane fade" id="ekgs-tab-pane" role="tabpanel">
      ${renderEkgs(chart.ekgs)}
    </div>`;

  // 🤰 Deliveries
  html += `
    <div class="tab-pane fade" id="deliveries-tab-pane" role="tabpanel">
      ${renderDeliveries(chart.deliveries)}
    </div>`;

  // 🗒️ Notes
  html += `
    <div class="tab-pane fade" id="notes-tab-pane" role="tabpanel">
      ${renderNotes(chart.notes)}
    </div>`;

  // 💳 Billing
  html += `
    <div class="tab-pane fade" id="billing-tab-pane" role="tabpanel">
      ${renderBilling(chart.billing)}
    </div>`;

  html += `</div>`;
  return html;
}

/* ============================================================
   👤 PATIENT INFO + REGISTRATION
============================================================ */
function renderPatientInfo(p) {
  if (!p) return "";
  return `
    <div class="section mb-4">
      <h5 class="text-primary mb-2"><i class="ri-user-3-line me-1"></i> Patient Information</h5>
      <div class="row small">
        <div class="col-md-6">
          <p><strong>Name:</strong> ${safeText(p.full_name || `${p.first_name || ""} ${p.last_name || ""}`)}</p>
          <p><strong>Gender:</strong> ${safeText(p.gender || "N/A")}</p>
          <p><strong>Age:</strong> ${safeText(p.age || "N/A")}</p>
        </div>
        <div class="col-md-6">
          <p><strong>Patient Code:</strong> ${safeText(p.patient_code || p.id || "N/A")}</p>
          <p><strong>Organization:</strong> ${safeText(p.organization_name || "—")}</p>
          <p><strong>Facility:</strong> ${safeText(p.facility_name || "—")}</p>
        </div>
      </div>
    </div>
  `;
}

function renderRegistrationLogs(logs = []) {
  if (!logs?.length) return "";
  return `
    <div class="section mb-4">
      <h6 class="text-primary"><i class="ri-calendar-event-line me-1"></i> Registration Logs</h6>
      <ul class="list-group small">
        ${logs
          .map(
            (r) => `
            <li class="list-group-item">
              <strong>${formatDateTime(r.registration_time)}</strong> – ${safeText(r.visit_reason || "—")}
              <span class="text-muted">(${safeText(r.patient_category || r.registration_method || "N/A")})</span>
            </li>`
          )
          .join("")}
      </ul>
    </div>
  `;
}

/* ============================================================
   🩺 VISITS + TIMELINE
============================================================ */
function renderVisits(visits = []) {
  if (!visits?.length) return "";
  return visits
    .map(
      (v, i) => `
      <div class="border rounded p-3 mb-3 bg-light-subtle">
        <h6 class="text-secondary mb-1">
          <i class="ri-calendar-line me-1"></i> Visit ${visits.length - i} – ${formatDateTime(v.date)}
        </h6>
        ${v.doctor ? `<p><strong>Doctor:</strong> ${safeText(v.doctor)}</p>` : ""}
        ${v.diagnosis ? `<p><strong>Diagnosis:</strong> ${safeText(v.diagnosis)}</p>` : ""}
        ${v.treatment ? `<p><strong>Treatment:</strong> ${safeText(v.treatment)}</p>` : ""}
        ${renderVitals(v.vitals)}
        ${renderLabRequests(v.labs)}
        ${renderNotes(v.notes)}
      </div>`
    )
    .join("");
}

function renderTimeline(timeline = []) {
  if (!timeline?.length)
    return `<p class="text-muted">No timeline events found.</p>`;
  return `
    <ul class="list-group list-group-flush small">
      ${timeline
        .map(
          (t) => `
          <li class="list-group-item">
            <strong>${formatDateTime(t.date)}</strong> –
            <span class="text-muted">${safeText(t.type)}:</span>
            ${safeText(t.summary || "No details")}
          </li>`
        )
        .join("")}
    </ul>
  `;
}

/* ============================================================
   🧪 LABS / ❤️‍🩹 VITALS / 💊 MEDICATIONS / ⚡ EKG / 🤰 DELIVERY / 🗒️ NOTES / 💳 BILLING
============================================================ */
function renderLabRequests(labs = []) {
  if (!labs?.length) return "";
  return labs
    .map(
      (l) => `
      <div class="border rounded p-2 mb-2 bg-light-subtle small">
        <p><strong>${safeText(l.test_name || "Lab Test")}:</strong> ${safeText(l.result || "Pending")}</p>
        <p><strong>Status:</strong> ${safeText(l.status || "N/A")}</p>
        <p class="text-muted">${formatDateTime(l.requested_at || l.created_at)}</p>
      </div>`
    )
    .join("");
}

function renderVitals(vitals = []) {
  if (!vitals?.length) return "";
  return vitals
    .map(
      (v) => `
      <div class="border rounded p-2 mb-2 bg-light-subtle small">
        <p><strong>${formatDateTime(v.created_at)}</strong></p>
        <p>BP: ${safeText(v.bp || `${v.systolic || ""}/${v.diastolic || ""}` || "—")}</p>
        <p>Pulse: ${safeText(v.pulse || "—")} bpm, Temp: ${safeText(v.temperature || "—")} °C</p>
        <p>Resp: ${safeText(v.resp_rate || "—")}, O₂ Sat: ${safeText(v.spo2 || "—")}%</p>
      </div>`
    )
    .join("");
}

function renderMedications(meds = []) {
  if (!meds?.length) return `<p class="text-muted">No medications found.</p>`;
  return meds
    .map(
      (m) => `
      <div class="border rounded p-2 mb-2 bg-light-subtle small">
        <p><strong>Date:</strong> ${formatDateTime(m.prescribed_at || m.created_at)}</p>
        ${m.doctor ? `<p><strong>Doctor:</strong> ${safeText(m.doctor.full_name || "—")}</p>` : ""}
        ${(m.items || [])
          .map(
            (i) =>
              `<p class="mb-0">
                💊 ${safeText(i.medication_name || "Medication")} 
                <span class="text-muted">(${safeText(i.dosage || "N/A")}, ${safeText(
                i.quantity || "—"
              )})</span>
              </p>`
          )
          .join("")}
      </div>`
    )
    .join("");
}

function renderEkgs(ekgs = []) {
  if (!ekgs?.length) return "";
  return ekgs
    .map(
      (e) => `
      <div class="border rounded p-2 mb-2 bg-light-subtle small">
        <p><strong>${formatDateTime(e.created_at)}</strong></p>
        <p><strong>Findings:</strong> ${safeText(e.findings || e.result || "—")}</p>
        <p><strong>Status:</strong> ${safeText(e.status || "N/A")}</p>
      </div>`
    )
    .join("");
}

function renderDeliveries(deliveries = []) {
  if (!deliveries?.length) return "";
  return deliveries
    .map(
      (d) => `
      <div class="border rounded p-2 mb-2 bg-light-subtle small">
        <p><strong>${formatDateTime(d.delivery_date)}</strong></p>
        <p><strong>Outcome:</strong> ${safeText(d.outcome || "—")}</p>
        <p><strong>Method:</strong> ${safeText(d.delivery_method || "—")}</p>
      </div>`
    )
    .join("");
}

function renderNotes(notes = []) {
  if (!notes?.length) return `<p class="text-muted">No notes available.</p>`;
  return notes
    .map(
      (n) => `
      <div class="border rounded p-2 mb-2 bg-light-subtle small">
        <p><strong>${safeText(n.author_name || "Staff")}:</strong> ${safeText(n.content || n.note || "")}</p>
        <p class="text-muted mb-0">${formatDateTime(n.created_at)}</p>
      </div>`
    )
    .join("");
}

function renderBilling(bills = []) {
  if (!bills?.length) return `<p class="text-muted">No billing records found.</p>`;
  return bills
    .map(
      (b) => `
      <div class="border rounded p-2 mb-2 bg-light-subtle small">
        <p><strong>Invoice:</strong> ${safeText(b.invoice_no || b.id)}</p>
        <p><strong>Date:</strong> ${formatDateTime(b.invoice_date)}</p>
        <p><strong>Amount:</strong> ${safeText(b.total_amount || "—")}</p>
        <p><strong>Status:</strong> ${safeText(b.status || "—")}</p>
      </div>`
    )
    .join("");
}

/* ============================================================
   ✅ Export main render entry for patientchart.js
============================================================ */
export function renderFullPatientChart(data, container) {
  if (!container) return;
  container.innerHTML = renderCard(data);
}
