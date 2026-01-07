/* ========================================================================
   📊 Dynamic Dashboard (Enterprise Compact Edition – Professional Layout)
   ======================================================================== */
import { logout, logoutAll, getUser, authFetch } from "../authSession.js";
import {
  BASE_PATH,
  KPI_COLOR_MAP,
  KPI_ICON_MAP,
  DEFAULT_USER_AVATAR,
  DASHBOARD_THEME_CSS,
  formatKeyLabel,
  getBadgeStyle,
} from "./dashboard-constants.js";

/* -------------------- Utility Helpers -------------------- */
function toAppPath(p) {
  if (!p) return "#";
  if (/^https?:\/\//i.test(p)) return p;
  const clean = p.startsWith("/") ? p : "/" + p;
  return BASE_PATH === "/" ? clean : BASE_PATH.replace(/\/$/, "") + clean;
}

/* -------------------- Initialization -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderUserInfo();
  hookLogout();
  ensureDashboardTheme();
  initLiveDashboard();
});

/* -------------------- Render User Info -------------------- */
function renderUserInfo() {
  const u = getUser();
  if (!u) return;

  const fullName =
    u.name ||
    `${u.first_name ? u.first_name : ""} ${u.last_name ? u.last_name : ""}`.trim();
  const avatar =
    u.photoUrl || (u.employee && u.employee.photo) || DEFAULT_USER_AVATAR;

  const sidebarName = document.getElementById("sidebarName");
  if (sidebarName) sidebarName.textContent = fullName;

  const headerName = document.getElementById("headerName");
  if (headerName) headerName.textContent = fullName;

  const sidebarRole = document.getElementById("sidebarRole");
  if (sidebarRole) sidebarRole.textContent = u.department || u.role || "";

  const headerRole = document.getElementById("headerRole");
  if (headerRole) headerRole.textContent = u.department || u.role || "";

  ["sidebarAvatar", "headerAvatar"].forEach((id) => {
    const img = document.getElementById(id);
    if (img) {
      img.src = avatar;
      img.onerror = () => (img.src = DEFAULT_USER_AVATAR);
    }
  });

  const bc = document.getElementById("breadcrumbRole");
  if (bc) bc.textContent = u.department || u.role || "Dashboard";
}

/* -------------------- Logout Hooks -------------------- */
function hookLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (confirm("Log out from this device only?")) await logout();
    });
  }

  const logoutAllBtn = document.getElementById("logoutAllBtn");
  if (logoutAllBtn) {
    logoutAllBtn.addEventListener("click", async () => {
      if (confirm("Log out from ALL devices?")) await logoutAll();
    });
  }
}

/* -------------------- Load Dashboard Theme -------------------- */
function ensureDashboardTheme() {
  if (!document.getElementById("dashboard-theme-css")) {
    const link = document.createElement("link");
    link.id = "dashboard-theme-css";
    link.rel = "stylesheet";
    link.href = DASHBOARD_THEME_CSS;
    document.head.appendChild(link);
  }
}

/* ========================================================================
   🧠 Core Live Dashboard Loader
   ======================================================================== */
function initLiveDashboard() {
  const dateInput = document.getElementById("abc");
  const kpiContainer = document.getElementById("dashboard-kpis");
  const chartContainer = document.getElementById("dashboard-charts");
  const queueContainer = document.getElementById("dashboard-queues");
  const alertContainer = document.getElementById("dashboard-alerts");

  if (!kpiContainer) return;

  /* ---------- Date Helper ---------- */
  function getDateRange() {
    if (!dateInput || !dateInput.value) return {};
    const parts = dateInput.value.split(" - ");
    if (parts.length !== 2) return {};
    return { start_date: parts[0], end_date: parts[1] };
  }

  /* ---------- Main Loader ---------- */
  async function loadDashboard(light = false) {
    try {
      const { start_date, end_date } = getDateRange();
      const params = new URLSearchParams();
      if (start_date && end_date) {
        params.append("start_date", start_date);
        params.append("end_date", end_date);
      }
      if (light) params.append("light", "1");

      const res = await authFetch(`/api/dashboard?${params}`);
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      const data = await res.json();
      const {
        kpis = [],
        charts = [],
        queues = [],
        alerts = [],
        currency_symbol = "",
        start_date: payloadStart,
        end_date: payloadEnd,
      } = data;

      const startDateFmt = payloadStart
        ? moment(payloadStart).format("MMM D, YYYY")
        : "";
      const endDateFmt = payloadEnd
        ? moment(payloadEnd).format("MMM D, YYYY")
        : "";

      renderKpis(kpis, currency_symbol, startDateFmt, endDateFmt);

      if (!light) {
        renderCharts(charts);
        renderQueues(queues);
        renderAlerts(alerts);
      }
    } catch (err) {
      console.error("❌ Dashboard load failed:", err);
    }
  }

  /* ---------- Sparkline ---------- */
  function renderSparkline(id, data = [], color = "#0d6efd") {
    if (typeof ApexCharts === "undefined" || !document.getElementById(id)) return;
    const options = {
      chart: { type: "line", height: 40, sparkline: { enabled: true } },
      stroke: { curve: "smooth", width: 2 },
      colors: [color],
      series: [{ data: data.length ? data : [0, 2, 1, 3, 2, 4, 3] }],
      tooltip: { enabled: false },
    };
    const chart = new ApexCharts(document.getElementById(id), options);
    chart.render();
  }

  /* ---------- KPI Renderer ---------- */
  function renderKpis(kpis = [], currencySymbol = "", startDate = "", endDate = "") {
    kpiContainer.innerHTML = "";
    if (!kpis.length) {
      kpiContainer.innerHTML =
        '<div class="col-12 text-center text-muted py-4">No data available</div>';
      return;
    }

    kpis.forEach((k, i) => {
      const summary = k.summary || {};
      const color = KPI_COLOR_MAP[k.key] || KPI_COLOR_MAP.default;
      const icon = KPI_ICON_MAP[k.key] || KPI_ICON_MAP.default;
      const total = k.total ?? k.count ?? 0;
      const value = Number(k.value || 0);
      let valueLine = "";

      if (["payments", "deposits", "discounts", "discount_waivers"].includes(k.key) && value > 0) {
        valueLine = `<div class="fw-semibold text-${color} fs-6 mt-1">
          ${currencySymbol || "$"}${value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>`;
      }

      const statuses = Object.entries(summary)
        .filter(([st]) => st !== "total" && typeof summary[st] === "number")
        .map(([st, val]) => {
          const formatted = formatKeyLabel(st);
          const badgeClass = getBadgeStyle(val, color);
          return `<span class="${badgeClass}">${formatted}: ${val}</span>`;
        })
        .join("");

      const chartId = `spark-${i}`;

      const card = document.createElement("div");
      card.className = "col-xxl-3 col-xl-3 col-lg-4 col-md-4 col-sm-6 col-12 mb-3 fade-in";
      card.innerHTML = `
        <div class="card kpi-card border-${color} h-100 shadow-sm">
          <div class="card-body p-3 text-center">
            <div class="d-flex justify-content-center align-items-baseline mb-1">
              <span class="fw-bold text-uppercase text-${color} me-2">
                <i class="${icon} me-1"></i>${k.label || ""}
              </span>
              <h4 class="fw-bolder mb-0 text-${color}" data-count="${total}">0</h4>
            </div>
            ${valueLine}
            <div class="status-breakdown mt-1">${statuses}</div>
            <div id="${chartId}" class="sparkline mt-2"></div>

            <!-- 📅 Date Range Line -->
            <div class="d-flex justify-content-between align-items-center mt-2 date-range-line">
              <span class="start-date small text-muted fw-light">${startDate}</span>
              <span class="end-date small text-muted fw-light">${endDate}</span>
            </div>

            <a href="${toAppPath(k.link)}" class="btn btn-outline-${color} btn-xs mt-3">Open</a>
          </div>
        </div>`;
      kpiContainer.appendChild(card);
      animateCount(card.querySelector("h4"));
      setTimeout(() => renderSparkline(chartId, k.trend || [], "#0d6efd"), 100);
    });
  }

  /* ---------- Count Animation ---------- */
  function animateCount(el) {
    const target = Number(el.dataset.count || 0);
    let cur = 0;
    const step = target / 30;
    const timer = setInterval(() => {
      cur += step;
      if (cur >= target) {
        cur = target;
        clearInterval(timer);
      }
      el.textContent = Math.round(cur);
    }, 20);
  }

  /* ---------- Charts ---------- */
  function renderCharts(charts = []) {
    if (!chartContainer || typeof ApexCharts === "undefined") return;
    chartContainer.innerHTML = "";
    charts.forEach((c, i) => {
      const div = document.createElement("div");
      div.id = `chart-${i}`;
      div.className = "mb-4";
      chartContainer.appendChild(div);
      const opt = {
        chart: { type: c.type || "bar", height: 300, toolbar: { show: false } },
        series: [{ name: c.label, data: c.data.series[0] }],
        xaxis: { categories: c.data.labels },
        colors: ["#0d6efd"],
        dataLabels: { enabled: false },
        stroke: { width: 3, curve: "smooth" },
      };
      new ApexCharts(div, opt).render();
    });
  }

  /* ---------- Queues ---------- */
  function renderQueues(queues = []) {
    if (!queueContainer) return;
    queueContainer.innerHTML = "";
    queues.forEach((q) => {
      const card = document.createElement("div");
      card.className = "card mb-3 border-0 shadow-sm";
      const items = (q.items || [])
        .map(
          (x) => `
          <li class="list-group-item small d-flex justify-content-between align-items-center">
            <span>${x.patient}</span>
            <small class="text-muted">${x.test}</small>
          </li>`
        )
        .join("");
      card.innerHTML = `
        <div class="card-header bg-light py-2"><strong>${q.label}</strong></div>
        <ul class="list-group list-group-flush">${items}</ul>`;
      queueContainer.appendChild(card);
    });
  }

  /* ---------- Alerts ---------- */
  function renderAlerts(alerts = []) {
    if (!alertContainer) return;
    alertContainer.innerHTML = "";
    alerts.forEach((a) => {
      const el = document.createElement("div");
      el.className = `alert alert-${a.type || "info"} mb-2 small`;
      el.innerHTML = `<i class="ri-error-warning-line me-2"></i>${a.message}`;
      alertContainer.appendChild(el);
    });
  }

  /* ---------- Live Refresh ---------- */
  loadDashboard();
  setInterval(() => loadDashboard(true), 90 * 1000);

  /* ---------- Date Range Change ---------- */
  if (dateInput) {
    dateInput.addEventListener("change", () => loadDashboard());
    if (window.$ && typeof $ === "function") {
      $(dateInput).on("apply.daterangepicker", () => loadDashboard());
    }
  }
}
