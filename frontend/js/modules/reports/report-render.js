// ============================================================================
// 📊 VytalGuard – Report Renderer (Enterprise Master Pattern | Pro Format)
// Professional Summary Cards • Responsive Table • Trend Chart • Meta Footer
// ============================================================================
import { showToast } from "../../utils/index.js";
import { initTooltips } from "../../utils/ui-utils.js";
import {
  REPORT_COLORS,
  REPORT_CHART_CONFIG,
  getSummaryCardConfig,
} from "./report-constants.js";

/* ============================================================
   🎛️ Main Entrypoint
============================================================ */
export function renderReportResults(response) {
  const summaryContainer = document.getElementById("reportSummary");
  const tableHead = document.getElementById("reportTableHead");
  const tableBody = document.getElementById("reportTableBody");

  summaryContainer.innerHTML = "";
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  if (!response || !response.data) {
    showToast("Invalid report response", "error");
    return;
  }

  const { data } = response;
  const grouped = data.grouped || [];
  const trend = data.trend || [];
  const summary = data.summary || {};
  const scope = data.scope || {};

  /* ============================================================
     🧾 SUMMARY CARDS (Professional KPI Layout)
  ============================================================ */
  const totalCount =
    summary.total_count || grouped.reduce((a, b) => a + (b.count || 1), 0);
  const cards = [];

  // 🔹 Total Records card (primary KPI)
  cards.push(
    makeSummaryCard({
      label: "Total Records",
      icon: "fa-database",
      color: REPORT_COLORS.primary,
      value: totalCount.toLocaleString(),
    })
  );

  // 🔹 Per-status breakdown
  const groupedStatus = {};
  grouped.forEach((r) => {
    const label = (r.status_label || r.status || "—").toUpperCase();
    groupedStatus[label] = (groupedStatus[label] || 0) + (r.count || 1);
  });

  for (const [label, val] of Object.entries(groupedStatus)) {
    const pct = ((val / totalCount) * 100).toFixed(1) + "%";
    cards.push(
      makeSummaryCard({
        label,
        icon: "fa-circle",
        color: REPORT_COLORS.secondary,
        value: `${val} (${pct})`,
      })
    );
  }

  const cardsHTML = `<div class="summary-card-grid">${cards.join("")}</div>`;

  /* ============================================================
     📈 TREND CHART (Adaptive)
  ============================================================ */
  let chartHTML = "";
  if (trend.length) {
    chartHTML = `
      <div class="trend-section mt-3">
        <h6 class="mb-2 fw-semibold text-primary">
          <i class="fas fa-chart-line me-1"></i> Trend Overview
        </h6>
        <div class="chart-container" style="height:260px;">
          <canvas id="trendChart"></canvas>
        </div>
      </div>`;
  }

  /* ============================================================
     🧭 META FOOTER (Report Context)
  ============================================================ */
  const metaHTML = `
    <div class="report-meta small text-muted mt-3 border-top pt-2">
      <i class="fas fa-info-circle me-1"></i>
      <strong>${data.type?.toUpperCase() || "-"}</strong> Report |
      Records: <strong>${totalCount}</strong> |
      Org: <strong>${scope.organization_id || "-"}</strong> |
      Facility: <strong>${scope.facility_id || "-"}</strong> |
      Generated: <strong>${new Date().toLocaleString()}</strong>
    </div>`;

  summaryContainer.innerHTML = `${cardsHTML}${chartHTML}${metaHTML}`;

  /* ============================================================
     📋 DATA TABLE (Compact Professional Layout)
  ============================================================ */
  if (grouped.length) {
    const rows = Object.entries(groupedStatus).map(([status, val]) => ({
      Status: status,
      Count: val,
      "% of Total": ((val / totalCount) * 100).toFixed(1) + "%",
    }));

    tableHead.innerHTML = `
      <tr>
        <th>Status</th>
        <th>Count</th>
        <th>% of Total</th>
      </tr>
    `;

    tableBody.innerHTML = rows
      .map(
        (r) => `
        <tr>
          <td><span class="status-dot ${r.Status.toLowerCase()}"></span>${r.Status}</td>
          <td>${r.Count}</td>
          <td>${r["% of Total"]}</td>
        </tr>`
      )
      .join("");
  } else {
    tableBody.innerHTML = `
      <tr><td colspan="3" class="text-center text-muted py-3">
        <i class="fas fa-info-circle me-1"></i>No records found for selected filters.
      </td></tr>`;
  }

  /* ============================================================
     📊 RENDER TREND CHART
  ============================================================ */
  if (trend.length) {
    const ctx = document.getElementById("trendChart")?.getContext("2d");
    if (ctx) {
      if (window.trendChartInstance) window.trendChartInstance.destroy();

      const labels = trend.map((d) => d.date || d.label || "");
      const values = trend.map((d) => d.sum_value || d.count || 0);

      window.trendChartInstance = new Chart(ctx, {
        type: REPORT_CHART_CONFIG.defaultType,
        data: {
          labels,
          datasets: [
            {
              label: "Trend",
              data: values,
              borderColor: REPORT_COLORS.primary,
              backgroundColor: REPORT_COLORS.primary,
              ...REPORT_CHART_CONFIG.lineOptions,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: REPORT_COLORS.gridLine } },
            y: { grid: { color: REPORT_COLORS.gridLine } },
          },
        },
      });
    }
  }

  initTooltips();
}

/* ============================================================
   🧱 Summary Card Builder
============================================================ */
function makeSummaryCard({ label, icon, color, value }) {
  return `
    <div class="summary-card shadow-sm">
      <div class="summary-dot" style="background:${color};"></div>
      <div class="summary-content">
        <div class="summary-title">
          <i class="fa ${icon} me-1" style="color:${color}"></i>${label}
        </div>
        <div class="summary-value" style="color:${color};">${value}</div>
      </div>
    </div>`;
}
