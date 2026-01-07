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
/* ====================== 📊 Chart Registry ====================== */
const SPARKLINE_CHARTS = {};
/* ====================== 🚨 NEEDS ATTENTION RULES ====================== */
function splitClinicalKpis(kpis = []) {
  const needsAttention = [];
  const normal = [];

  kpis.forEach(k => {
    const s = k.summary || {};

    const hasAttention =
      (s.pending && s.pending > 0) ||
      (s.scheduled && s.scheduled > 0) ||
      (s.unpaid && s.unpaid > 0) ||
      (s.low && s.low > 0);

    if (hasAttention) needsAttention.push(k);
    else normal.push(k);
  });

  return { needsAttention, normal };
}

/* ====================== ✅ NEW: ADMIN KPI KEYS ====================== */
const ADMIN_KEYS = [
  "organizations",
  "roles",
  "users",
  "feature_modules",
  "feature_accesses",
  "facilities",
  "departments",
  "master_items",
  "master_item_categories",
];

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
export function initLiveDashboard() {
  const dateInput = document.getElementById("abc");

  /* ===== ✅ NEW: SEPARATE KPI CONTAINERS ===== */
  const clinicalContainer = document.getElementById("clinical-kpis");
  const adminContainer = document.getElementById("admin-kpis");

  const chartContainer = document.getElementById("dashboard-charts");
  const queueContainer = document.getElementById("dashboard-queues");
  const alertContainer = document.getElementById("dashboard-alerts");

  if (!clinicalContainer) return;

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

      /* ===== ✅ SPLIT CLINICAL vs ADMIN ===== */
      const clinicalKpis = kpis.filter(k => !ADMIN_KEYS.includes(k.key));
      const adminKpis = kpis.filter(k => ADMIN_KEYS.includes(k.key));

      /* 🚨 Needs Attention split (clinical only) */
      const { needsAttention, normal } = splitClinicalKpis(clinicalKpis);

      /* 🔴 Needs Attention (only if exists) */
      if (needsAttention.length) {
        const header = document.createElement("div");
        header.className = "col-12 mb-2";
        header.innerHTML = `
          <h6 class="text-danger fw-bold">
            <i class="ri-alarm-warning-line me-1"></i>
            Needs Attention
          </h6>`;
        clinicalContainer.appendChild(header);

        renderKpis(needsAttention, currency_symbol, startDateFmt, endDateFmt, "clinical");
      }

      /* 🩺 Normal Clinical KPIs */
      renderKpis(normal, currency_symbol, startDateFmt, endDateFmt, "clinical");

      /* 🏛️ Admin KPIs (unchanged) */
      renderKpis(adminKpis, currency_symbol, "", "", "admin");


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
    const el = document.getElementById(id);

    if (
      typeof ApexCharts === "undefined" ||
      !el ||
      !Array.isArray(data) ||
      data.length < 2 ||
      data.every(v => v === 0)
    ) {
      return;
    }

    // ✅ Destroy existing chart before re-render
    if (SPARKLINE_CHARTS[id]) {
      SPARKLINE_CHARTS[id].destroy();
      delete SPARKLINE_CHARTS[id];
    }

    const options = {
      chart: {
        type: "line",
        height: 40,
        sparkline: { enabled: true },
        animations: { enabled: false } // 🚀 prevents flicker
      },
      stroke: { curve: "smooth", width: 2 },
      colors: [color],
      series: [{ data }],
      tooltip: { enabled: false }
    };

    const chart = new ApexCharts(el, options);
    chart.render();

    // ✅ store reference
    SPARKLINE_CHARTS[id] = chart;
  }

  /* ---------- KPI Renderer ---------- */
  function renderKpis(
    kpis = [],
    currencySymbol = "",
    startDate = "",
    endDate = "",
    type = "clinical"
  ) {
    const container = type === "admin" ? adminContainer : clinicalContainer;
    const showTrend = type !== "admin";

    container.innerHTML = "";
    if (!kpis.length) return;

    kpis.forEach((k, i) => {
      const summary = k.summary || {};
      const color = KPI_COLOR_MAP[k.key] || KPI_COLOR_MAP.default;
      const icon = KPI_ICON_MAP[k.key] || KPI_ICON_MAP.default;
      const total = k.total ?? k.count ?? 0;
      const value = Number(k.value || 0);
      let valueLine = "";

      if (
        ["payments", "deposits", "discounts", "discount_waivers"].includes(k.key) &&
        value > 0
      ) {
        valueLine = `<div class="fw-semibold text-${color} fs-6 mt-1">
          ${currencySymbol || "$"}${value.toLocaleString(undefined,{
            minimumFractionDigits:2,
            maximumFractionDigits:2
          })}
        </div>`;
      }

      const statuses = showTrend
        ? Object.entries(summary)
            .filter(([st]) => st !== "total" && typeof summary[st] === "number")
            .map(([st, val]) => {
              const formatted = formatKeyLabel(st);
              const badgeClass = getBadgeStyle(val, color);
              return `<span class="${badgeClass}">${formatted}: ${val}</span>`;
            })
            .join("")
        : "";

      const chartId = `spark-${type}-${i}`;

      const card = document.createElement("div");
      card.className = "fade-in";

      card.innerHTML = `
        <div class="card kpi-card compact border-${color} h-100 shadow-sm">
          <div class="card-body p-3">

            <!-- HEADER: icon + title LEFT, number RIGHT -->
            <div class="d-flex justify-content-between align-items-start mb-1">
              <div class="d-flex align-items-center gap-2">
                <i class="${icon} text-${color}"></i>
                <span class="kpi-title">${k.label || ""}</span>
              </div>

              <div class="kpi-value text-${color}" data-count="${total}">
                0
              </div>
            </div>

            <!-- Status pills -->
            ${showTrend ? `<div class="kpi-badges mb-1">${statuses}</div>` : ""}

            <!-- Footer row -->
            ${showTrend ? `
              <div class="d-flex justify-content-between align-items-end mt-1">
                <div class="kpi-dates">
                  ${startDate} - ${endDate}
                </div>
                <div id="${chartId}" class="kpi-spark"></div>
              </div>
            ` : ""}

            <!-- Action -->
            <a href="${toAppPath(k.link)}" class="kpi-link mt-1 d-inline-block">
              View ${k.label?.toLowerCase() || "records"} →
            </a>

          </div>
        </div>
      `;

      container.appendChild(card);
      animateCount(card.querySelector("[data-count]"));

      if (showTrend) {
        setTimeout(() => renderSparkline(chartId, k.trend || [], "#0d6efd"), 100);
      }
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
        .map(x => `
          <li class="list-group-item small d-flex justify-content-between align-items-center">
            <span>${x.patient}</span>
            <small class="text-muted">${x.test}</small>
          </li>`).join("");
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
