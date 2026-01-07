// 📘 patientchart.js – Hospital-Standard Full Patient Chart View (Enterprise Edition v5)
// -----------------------------------------------------------------------------
// Adds Date Range Filter for temporal chart viewing
// High-reliability patient chart loader with audit, refresh, print, and filtering.
// Integrates Bootstrap modal confirmations (via showConfirm).
// -----------------------------------------------------------------------------

import {
  showLoading,
  hideLoading,
  showToast,
  initPageGuard,
  showConfirm,
} from "../../utils/index.js";
import { renderFullPatientChart } from "./patientchart-view-render.js";
import { printPatientChart } from "./patientchart-print.js";

const token = initPageGuard(["patientcharts:view"]);

/* ============================================================
   🚀 Initialize Page
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const patientId = params.get("patient_id");

  if (!patientId) {
    showToast("❌ No patient selected");
    return;
  }

  setupDateRangeHandlers(patientId);
  await loadPatientChart(patientId);
});

/* ============================================================
   📦 Load Unified Patient Chart (supports date filtering)
============================================================ */
async function loadPatientChart(patientId, fromDate = "", toDate = "") {
  try {
    showLoading("Loading patient chart...");

    // Build query string with optional date range
    const query = [];
    if (fromDate) query.push(`from=${encodeURIComponent(fromDate)}`);
    if (toDate) query.push(`to=${encodeURIComponent(toDate)}`);
    const url = `/api/patient-chart/patient/${patientId}${
      query.length ? "?" + query.join("&") : ""
    }`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const result = await res.json();
    const data = result?.data;

    if (!data || !data.patient) {
      showToast("⚠️ No chart data available");
      return;
    }

    // 🧩 Render chart dynamically
    const container = document.getElementById("patientChartContainer");
    renderFullPatientChart(data, container);

    // 🧾 Update header summary
    updateChartHeader(data, fromDate, toDate);
  } catch (err) {
    console.error("❌ Failed to load patient chart:", err);
    showToast("❌ Failed to load chart data");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🗓️ Date Range Filter Setup
============================================================ */
function setupDateRangeHandlers(patientId) {
  const fromInput = document.getElementById("filterFromDate");
  const toInput = document.getElementById("filterToDate");
  const applyBtn = document.getElementById("applyDateFilter");

  if (!fromInput || !toInput || !applyBtn) return;

  // Default: last 30 days
  const today = new Date();
  const thirtyAgo = new Date(today);
  thirtyAgo.setDate(today.getDate() - 30);
  fromInput.value = thirtyAgo.toISOString().slice(0, 10);
  toInput.value = today.toISOString().slice(0, 10);

  applyBtn.addEventListener("click", async () => {
    const from = fromInput.value;
    const to = toInput.value;
    if (from && to && new Date(from) > new Date(to))
      return showToast("⚠️ Invalid date range (From > To)");
    await loadPatientChart(patientId, from, to);
  });
}

/* ============================================================
   🩺 Header Summary (top of chart view)
============================================================ */
function updateChartHeader(data, from, to) {
  const p = data.patient || {};
  const org = data.organization || {};
  const fac = data.facility || {};
  const doctor = data.attending_physician || {};
  const header = document.getElementById("patientChartHeader");
  if (!header) return;

  header.innerHTML = `
    <div class="card shadow-sm border-0 mb-3">
      <div class="card-body py-3">
        <div class="d-flex justify-content-between align-items-center flex-wrap">
          <div>
            <h5 class="mb-1 text-primary">
              <i class="ri-user-3-line me-1"></i> ${p.full_name || "—"}
            </h5>
            <small class="text-muted">
              ${p.gender || "—"} | Age: ${p.age || "—"} | DOB: ${p.date_of_birth || "—"}
            </small><br>
            ${
              from || to
                ? `<small class="text-muted">Filtered ${
                    from ? "from " + from : ""
                  } ${to ? "to " + to : ""}</small>`
                : ""
            }
          </div>
          <div class="text-end">
            <small><strong>Facility:</strong> ${fac.name || "—"}</small><br>
            <small><strong>Doctor:</strong> ${doctor.full_name || "—"}</small><br>
            <small><strong>Printed:</strong> ${
              data.printed_at
                ? new Date(data.printed_at).toLocaleString()
                : new Date().toLocaleString()
            }</small>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   🧭 Button Handlers (Back / Refresh / Print)
============================================================ */
document.getElementById("backBtn")?.addEventListener("click", () => {
  window.location.href = "patientchart-list.html";
});

document.getElementById("refreshBtn")?.addEventListener("click", async () => {
  const params = new URLSearchParams(window.location.search);
  const patientId = params.get("patient_id");
  if (!patientId) return showToast("❌ No patient ID found");

  try {
    const confirmed = await showConfirm(
      "♻️ Refresh Patient Chart",
      "Are you sure you want to revalidate and reload the chart snapshot?"
    );
    if (!confirmed) return;

    showLoading("Refreshing chart snapshot...");
    const res = await fetch(
      `/api/patient-chart/patient/${patientId}/cache/invalidate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const result = await res.json();
    showToast(result?.message || "✅ Chart cache refreshed successfully");
    await loadPatientChart(patientId);
  } catch (err) {
    console.error("❌ Failed to refresh cache:", err);
    showToast("❌ Failed to refresh chart cache");
  } finally {
    hideLoading();
  }
});

document.getElementById("printBtn")?.addEventListener("click", async () => {
  const params = new URLSearchParams(window.location.search);
  const patientId = params.get("patient_id");
  if (!patientId) return showToast("❌ No patient selected for print");

  try {
    showLoading("Preparing printable chart...");
    const res = await fetch(`/api/patient-chart/patient/${patientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    hideLoading();

    if (!json?.data) throw new Error("Chart data missing");
    printPatientChart(json.data);
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("❌ Failed to load chart for printing");
  }
});
