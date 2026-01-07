// 📘 patientchart-summary-main.js – Hospital-Standard Patient Chart Summary Renderer
// -----------------------------------------------------------------------------
// Modern summary view matching Epic/Cerner-style HMS summary cards
// Uses clean Bootstrap/RemixIcon formatting and enriched demographic info
// -----------------------------------------------------------------------------

import { authFetch } from "../../authSession.js";
import {
  showToast,
  showLoading,
  hideLoading,
  formatDate,
  formatDateTime,
} from "../../utils/index.js";

// 🔙 Back navigation
document.getElementById("backToCharts")?.addEventListener("click", () => {
  window.location.href = "/patientchart-list.html";
});

// 🚀 Load patient chart summary
async function loadSummary() {
  const params = new URLSearchParams(window.location.search);
  const patientId =
    params.get("patient_id") || sessionStorage.getItem("selectedPatientChartId");
  if (!patientId) return showToast("❌ No patient selected.");

  showLoading();
  try {
    const res = await authFetch(`/api/patient-chart/patient/${patientId}/summary`);
    const data = await res.json();
    hideLoading();

    if (!res.ok) throw new Error(data.message || "Failed to load summary");

    renderSummary(data.data);
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast(err.message || "Failed to load summary");
  }
}

/* ============================================================
   🩺 Render Summary
============================================================ */
function renderSummary(summary) {
  const container = document.getElementById("patientChartSummary");
  if (!summary) {
    container.innerHTML = `<div class="alert alert-warning text-center py-2">No summary data available.</div>`;
    return;
  }

  const p = summary.patient || {};
  const consult = summary.lastConsultation || null;
  const vitals = summary.lastVitals || null;

  container.innerHTML = `
    <div class="card shadow-sm border-0 mb-3">
      <div class="card-header bg-light">
        <h5 class="mb-0 text-primary">
          <i class="ri-user-3-line me-1"></i> Patient Information
        </h5>
      </div>
      <div class="card-body small">
        <div class="row">
          <div class="col-md-6">
            <p class="mb-1"><strong>Name:</strong> ${p.full_name || "—"}</p>
            <p class="mb-1"><strong>Gender:</strong> ${p.gender || "—"}</p>
            <p class="mb-1"><strong>Date of Birth:</strong> ${
              p.date_of_birth ? formatDate(p.date_of_birth) : "—"
            }</p>
          </div>
          <div class="col-md-6">
            <p class="mb-1"><strong>Patient ID / MRN:</strong> ${
              p.pat_no || p.id || "—"
            }</p>
            <p class="mb-1"><strong>Age:</strong> ${p.age || "—"}</p>
            <p class="mb-1"><strong>Insurance #:</strong> ${
              p.insurance_number || "—"
            }</p>
          </div>
        </div>
      </div>
    </div>

    <div class="card shadow-sm border-0 mb-3">
      <div class="card-header bg-light">
        <h5 class="mb-0 text-primary">
          <i class="ri-stethoscope-line me-1"></i> Last Consultation
        </h5>
      </div>
      <div class="card-body small">
        ${
          consult
            ? `
          <p class="mb-1"><strong>Date:</strong> ${formatDateTime(
            consult.consultation_date
          )}</p>
          <p class="mb-1"><strong>Diagnosis:</strong> ${
            consult.diagnosis || "—"
          }</p>
          <p class="mb-1"><strong>Treatment:</strong> ${
            consult.treatment || "—"
          }</p>
          <p class="mb-0"><strong>Doctor:</strong> ${
            consult.doctor?.full_name || "—"
          }</p>
        `
            : `<p class="text-muted mb-0">No consultation record found.</p>`
        }
      </div>
    </div>

    <div class="card shadow-sm border-0 mb-3">
      <div class="card-header bg-light">
        <h5 class="mb-0 text-primary">
          <i class="ri-heart-pulse-line me-1"></i> Last Recorded Vitals
        </h5>
      </div>
      <div class="card-body small">
        ${
          vitals
            ? `
          <div class="row">
            <div class="col-md-4"><strong>BP:</strong> ${
              vitals.systolic || "—"
            }/${vitals.diastolic || "—"} mmHg</div>
            <div class="col-md-4"><strong>Pulse:</strong> ${
              vitals.pulse || "—"
            } bpm</div>
            <div class="col-md-4"><strong>Temp:</strong> ${
              vitals.temperature || "—"
            } °C</div>
          </div>
          <div class="row mt-1">
            <div class="col-md-4"><strong>Resp Rate:</strong> ${
              vitals.resp_rate || "—"
            }/min</div>
            <div class="col-md-4"><strong>O₂ Sat:</strong> ${
              vitals.spo2 || "—"
            }%</div>
            <div class="col-md-4"><strong>Date:</strong> ${
              vitals.recorded_at ? formatDateTime(vitals.recorded_at) : "—"
            }</div>
          </div>
        `
            : `<p class="text-muted mb-0">No vitals found.</p>`
        }
      </div>
    </div>

    <div class="text-end mt-3">
      <button id="viewFullChart" class="btn btn-outline-primary btn-sm">
        <i class="ri-file-list-3-line me-1"></i> View Full Chart
      </button>
    </div>
  `;

  // 🔗 Navigation to full chart view
  document.getElementById("viewFullChart")?.addEventListener("click", () => {
    window.location.href = `patientchart-view.html?patient_id=${p.id}`;
  });
}

// Initialize
loadSummary();
