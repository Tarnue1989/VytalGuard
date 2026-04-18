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
import { getGreetingMeta } from "../utils/greeting.js";
/* ====================== ⭐ TOP KPI KEYS ====================== */
const TOP_KPI_KEYS = [
  "patients",
  "appointments",
  "payments",
  "invoices",
];

/* ====================== 📊 Chart Registry ====================== */
const SPARKLINE_CHARTS = {};
/* ====================== 🚨 NEEDS ATTENTION RULES ====================== */
function splitClinicalKpis(kpis = []) {
  const needsAttention = [];
  const normal = [];

  kpis.forEach(k => {
    const s = k.summary || {};

  const hasAttention =
    (s.pending ?? 0) > 0 ||
    (s.in_progress ?? 0) > 0 ||
    (s.scheduled ?? 0) > 0 ||
    (s.unpaid ?? 0) > 0 ||
    (s.no_show ?? 0) > 0 ||
    (s.total_emergency ?? 0) > 0;


    if (hasAttention) needsAttention.push(k);
    else normal.push(k);
  });

  return { needsAttention, normal };
}
let calDate = new Date();

function renderDashboardCalendar() {
  const grid = document.getElementById("dashboard-calendar");
  const title = document.getElementById("cal-title");
  if (!grid || !title) return;

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const today = new Date();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  title.textContent = `${monthNames[month]} ${year}`;
  grid.innerHTML = "";

  const headers = ["S","M","T","W","T","F","S"];
  headers.forEach(h => {
    grid.innerHTML += `<div class="calendar-day header">${h}</div>`;
  });

  for (let i = 0; i < firstDay; i++) {
    grid.innerHTML += `<div class="calendar-day muted"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday =
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    grid.innerHTML += `
      <div class="calendar-day ${isToday ? "today" : ""}">
        ${d}
      </div>`;
  }
}

document.getElementById("cal-prev")?.addEventListener("click", () => {
  calDate.setMonth(calDate.getMonth() - 1);
  renderDashboardCalendar();
});

document.getElementById("cal-next")?.addEventListener("click", () => {
  calDate.setMonth(calDate.getMonth() + 1);
  renderDashboardCalendar();
});

document.addEventListener("DOMContentLoaded", renderDashboardCalendar);

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

  const greetingMeta = getGreetingMeta(u);
  const displayName = fullName || "User";

  const headerName = document.getElementById("headerName");
  if (headerName) {
    headerName.textContent = displayName;
  }

  const sidebarRole = document.getElementById("sidebarRole");
  if (sidebarRole) sidebarRole.textContent = u.department || u.role || "";

  const roleMap = {
    admin: "Super Admin",
    superadmin: "Super Admin",
    doctor: "Doctor",
    nurse: "Nurse"
  };

  const rawRole =
    (u.roleNames?.[0] || u.storedRole || u.role || "").toLowerCase();

  const headerRole = document.getElementById("headerRole");
  if (headerRole) {
    headerRole.textContent = roleMap[rawRole] || rawRole || "";
  }

  const greetingEl = document.getElementById("breadcrumbGreeting");
  if (greetingEl) {
    greetingEl.innerHTML = `
      <i class="${greetingMeta.icon} me-1 text-${greetingMeta.theme}"></i>
      ${greetingMeta.text}, ${displayName}
    `;
  }
  
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
document.addEventListener("click", (e) => {
  const card = e.target.closest("[data-kpi-card]");
  if (!card) return;

  const wrapper = card.closest(".kpi-accordion-item");

  // close others
  document.querySelectorAll(".kpi-accordion-item.open").forEach(el => {
    if (el !== wrapper) el.classList.remove("open");
  });

  wrapper.classList.toggle("open");
});

/* ========================================================================
   🧠 Core Live Dashboard Loader (FINAL – WITH LOCAL SEARCH)
   ======================================================================== */
export function initLiveDashboard() {
  const dateInput = document.getElementById("abc");

  /* ===== KPI CONTAINERS ===== */
  const clinicalContainer = document.getElementById("clinical-kpis");
  const adminContainer = document.getElementById("admin-kpis");
  const topKpiContainer = document.getElementById("top-kpis");

  const chartContainer = document.getElementById("dashboard-charts");
  const queueContainer = document.getElementById("dashboard-queues");
  const alertContainer = document.getElementById("dashboard-alerts");

  if (!clinicalContainer) return;

  /* ===== DASHBOARD SEARCH ===== */
  const dashboardSearch = document.getElementById("dashboardSearch");
  let DASHBOARD_KPIS_CACHE = [];

  /* ---------- Date Helper ---------- */
  function getDateRange() {
    if (!dateInput || !dateInput.value) return {};
    const parts = dateInput.value.split(" - ");
    if (parts.length !== 2) return {};
    return { start_date: parts[0], end_date: parts[1] };
  }

  /* ---------- KPI Filter ---------- */
  function filterKpis(kpis, query) {
    if (!query) return kpis;
    const q = query.toLowerCase();
    return kpis.filter(k =>
      k.label?.toLowerCase().includes(q) ||
      k.key?.toLowerCase().includes(q) ||
      k.category?.toLowerCase().includes(q)
    );
  }

  /* ---------- TOP KPI STRIP ---------- */
  function renderTopKpis(container, kpis = [], currencySymbol = "") {
    if (!container) return;
    container.innerHTML = "";

    kpis.forEach(k => {
      const color = KPI_COLOR_MAP[k.key] || "primary";
      const icon = KPI_ICON_MAP[k.key] || "ri-bar-chart-line";
      const total =
        k.key === "payments"
          ? (k.summary?.total_amount ?? 0)
          : (k.total ?? 0);

      const card = document.createElement("div");
      card.className = "card shadow-sm border-0";

      card.innerHTML = `
        <div class="card-body d-flex justify-content-between align-items-center">
          <div>
            <div class="text-muted small">${k.label}</div>
            <div class="fs-3 fw-bold text-${color}">
              ${
                k.key === "payments"
                  ? `${currencySymbol || "$"}${Number(total).toLocaleString()}`
                  : Number(total).toLocaleString()
              }
            </div>
          </div>
          <i class="${icon} fs-1 text-${color} opacity-75"></i>
        </div>
      `;

      container.appendChild(card);
    });
  }
  /* ---------- Count Animation ---------- */
  function animateCount(el) {
    if (!el) return;

    const target = Number(el.dataset.count || 0);
    let current = 0;

    if (target === 0) {
      el.textContent = "0";
      return;
    }

    const step = Math.max(1, Math.ceil(target / 30));

    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = current.toLocaleString();
    }, 20);
  }
  /* ---------- Sparkline Renderer ---------- */
  function renderSparkline(containerId, series = [], color = "#0d6efd") {
    const el = document.getElementById(containerId);
    if (!el || !series.length) return;

    if (SPARKLINE_CHARTS[containerId]) {
      SPARKLINE_CHARTS[containerId].destroy();
    }

    const chart = new ApexCharts(el, {
      chart: {
        type: "line",
        height: 40,
        sparkline: { enabled: true },
        animations: { enabled: false }
      },
      stroke: { width: 2, curve: "smooth" },
      series: [{ data: series }],
      colors: [color],
      tooltip: { enabled: false }
    });

    chart.render();
    SPARKLINE_CHARTS[containerId] = chart;
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

      new ApexCharts(div, {
        chart: {
          type: c.type || "bar",height: window.innerWidth < 768 ? 140 : 160,
          height: window.innerWidth < 768 ? 180 : 240,
          toolbar: { show: false }
        },
        series: [{ name: c.label, data: c.data.series[0] }],
        xaxis: { categories: c.data.labels },
        colors: ["#0d6efd"],
        dataLabels: { enabled: false },
        stroke: { width: 3, curve: "smooth" }
      }).render();
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
          x => `
          <li class="list-group-item small d-flex justify-content-between align-items-center">
            <span>${x.patient || ""}</span>
            <small class="text-muted">${x.test || ""}</small>
          </li>`
        )
        .join("");

      card.innerHTML = `
        <div class="card-header bg-light py-2">
          <strong>${q.label || "Queue"}</strong>
        </div>
        <ul class="list-group list-group-flush">
          ${items || `<li class="list-group-item small text-muted">No items</li>`}
        </ul>
      `;

      queueContainer.appendChild(card);
    });
  }
  /* ---------- Alerts ---------- */
  function renderAlerts(alerts = []) {
    if (!alertContainer) return;

    alertContainer.innerHTML = "";

    if (!alerts.length) {
      alertContainer.innerHTML = `
        <div class="alert alert-light small text-muted">
          No alerts at this time
        </div>
      `;
      return;
    }

    alerts.forEach((a) => {
      const el = document.createElement("div");
      el.className = `alert alert-${a.type || "info"} mb-2 small`;
      el.innerHTML = `
        <i class="ri-error-warning-line me-2"></i>
        ${a.message || ""}
      `;
      alertContainer.appendChild(el);
    });
  }

/* ---------- KPI Renderer (COLLAPSIBLE / ACCORDION) ---------- */
function renderKpis(
  kpis = [],
  currencySymbol = "",
  startDate = "",
  endDate = "",
  type = "clinical"
) {
  const container = type === "admin" ? adminContainer : clinicalContainer;
  const showTrend = type !== "admin";

  if (!kpis.length) return;

  kpis.forEach((k, i) => {
    const summary = k.summary || {};
    const color = KPI_COLOR_MAP[k.key] || KPI_COLOR_MAP.default;
    const icon = KPI_ICON_MAP[k.key] || KPI_ICON_MAP.default;
    const total = k.total ?? k.count ?? 0;

    /* ---- CRITICAL BADGES ONLY (summary view) ---- */
    const criticalStatuses = showTrend
      ? Object.entries(summary)
          .filter(([st, val]) =>
            ["pending", "unpaid", "total_emergency"].includes(st) && val > 0
          )
          .map(([st, val]) => {
            const formatted = formatKeyLabel(st);
            const badgeClass = getBadgeStyle(val, color);
            return `<span class="${badgeClass}">${formatted}: ${val}</span>`;
          })
          .join("")
      : "";

    /* ---- FULL BADGES (expanded view) ---- */
    const allStatuses = showTrend
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

    const wrapper = document.createElement("div");
    wrapper.className = "kpi-accordion-item";

    wrapper.innerHTML = `
      <div class="card kpi-card compact border-${color} shadow-sm" data-kpi-card>

        <!-- ===== SUMMARY (always visible) ===== -->
        <div class="card-body p-3 kpi-summary">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <i class="${icon} text-${color}"></i>
              <span class="kpi-title">${k.label || ""}</span>
            </div>

            <div class="d-flex align-items-center gap-2">
              <div class="kpi-value text-${color}" data-count="${total}">0</div>
              <i class="ri-arrow-down-s-line kpi-chevron"></i>
            </div>
          </div>

          ${criticalStatuses ? `
            <div class="kpi-badges mt-1">
              ${criticalStatuses}
            </div>` : ""}
        </div>

        <!-- ===== DETAILS (collapsed by default) ===== -->
        <div class="kpi-details">
          <div class="px-3 pb-3">

            ${allStatuses ? `
              <div class="kpi-badges mb-2">
                ${allStatuses}
              </div>` : ""}

            ${showTrend ? `
              <div class="d-flex justify-content-between align-items-end mb-2">
                <div class="kpi-dates">${startDate} - ${endDate}</div>
                <div id="${chartId}" class="kpi-spark"></div>
              </div>` : ""}

            <a href="${toAppPath(k.link)}" class="kpi-link">
              View ${k.label?.toLowerCase() || "records"} →
            </a>

          </div>
        </div>
      </div>
    `;

    container.appendChild(wrapper);

    animateCount(wrapper.querySelector("[data-count]"));

    /* ---- Sparkline (only when expanded) ---- */
    if (showTrend) {
      wrapper.addEventListener("click", () => {
        if (!wrapper.classList.contains("open")) return;
        setTimeout(
          () => renderSparkline(chartId, k.trend || [], `var(--bs-${color})`),
          50
        );
      });
    }
  });
}

  /* ---------- Unified Renderer ---------- */
  function renderFromKpis(kpis, currencySymbol = "", startDate = "", endDate = "") {
    topKpiContainer.innerHTML = "";
    clinicalContainer.innerHTML = "";
    adminContainer.innerHTML = "";

    const topKpis = kpis.filter(k => TOP_KPI_KEYS.includes(k.key));
    const clinicalKpis = kpis.filter(
      k => k.category === "Clinical" && !TOP_KPI_KEYS.includes(k.key)
    );
    const adminKpis = kpis.filter(k => k.category === "Administration");

    if (topKpis.length) {
      renderTopKpis(topKpiContainer, topKpis, currencySymbol);
    }

    const { needsAttention, normal } = splitClinicalKpis(clinicalKpis);

    if (needsAttention.length) {
      const h = document.createElement("div");
      h.className = "mb-2";
      h.innerHTML = `
        <h6 class="text-danger fw-bold">
          <i class="ri-alarm-warning-line me-1"></i> Needs Attention
        </h6>`;
      clinicalContainer.appendChild(h);

      renderKpis(needsAttention, currencySymbol, startDate, endDate, "clinical");
    }

    renderKpis(normal, currencySymbol, startDate, endDate, "clinical");
    renderKpis(adminKpis, currencySymbol, "", "", "admin");
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

      const res = await authFetch(`/api/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);

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

      DASHBOARD_KPIS_CACHE = kpis;

      const startDateFmt = payloadStart
        ? moment(payloadStart).format("MMM D, YYYY")
        : "";
      const endDateFmt = payloadEnd
        ? moment(payloadEnd).format("MMM D, YYYY")
        : "";

      renderFromKpis(kpis, currency_symbol, startDateFmt, endDateFmt);

      if (!light) {
        renderCharts(charts);
        renderQueues(queues);
        renderAlerts(alerts);
      }
    } catch (err) {
      console.error("❌ Dashboard load failed:", err);
    }
  }

  /* ---------- SEARCH ---------- */
  if (dashboardSearch) {
    dashboardSearch.addEventListener("input", () => {
      const q = dashboardSearch.value.trim();
      const filtered = filterKpis(DASHBOARD_KPIS_CACHE, q);
      renderFromKpis(filtered);
    });
  }

  /* ---------- Live Refresh ---------- */
  loadDashboard();
  setInterval(() => loadDashboard(true), 90 * 1000);

  /* ---------- Date Change ---------- */
  if (dateInput) {
    dateInput.addEventListener("change", () => loadDashboard());
    if (window.$) {
      $(dateInput).on("apply.daterangepicker", () => loadDashboard());
    }
  }
}

// 📱 Mobile side-card toggle
document.addEventListener("click", (e) => {
  const header = e.target.closest(".side-card-header");
  if (!header) return;

  if (window.innerWidth > 768) return;

  const card = header.closest(".side-card");
  card.classList.toggle("collapsed");
});
