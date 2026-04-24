// 📁 js/dashboard/modules-tab.js

import { authFetch } from "../authSession.js";

/* =========================================================
   🎨 CATEGORY STYLES (ICON + COLOR)
========================================================= */
const CATEGORY_STYLES = {
  "Pharmacy & Store": { icon: "ri-capsule-line", color: "#16a34a" },
  "Patient Entry": { icon: "ri-user-heart-line", color: "#2563eb" },
  "System Engine": { icon: "ri-settings-3-line", color: "#7c3aed" },
  "Special Care": { icon: "ri-hospital-line", color: "#dc2626" },
  "System Setup": { icon: "ri-tools-line", color: "#475569" },
  "Billing & Payments": { icon: "ri-money-dollar-circle-line", color: "#059669" },
  "Insurance & Discounts": { icon: "ri-shield-check-line", color: "#0ea5e9" },
  "Doctor Care": { icon: "ri-stethoscope-line", color: "#ea580c" },
  "Finance": { icon: "ri-bank-line", color: "#0284c7" },
  "Lab & Tests": { icon: "ri-flask-line", color: "#9333ea" },
  "Patient Records": { icon: "ri-file-medical-line", color: "#0f766e" },
  "Finance & Reports": { icon: "ri-bar-chart-line", color: "#1d4ed8" },
  "Nursing / Triage": { icon: "ri-first-aid-kit-line", color: "#be123c" },
};

/* =========================================================
   🔧 CATEGORY NORMALIZATION (FIX MISSING ICON ISSUE)
========================================================= */
const CATEGORY_LOOKUP = {
  "pharmacy & store": "Pharmacy & Store",
  "patient entry": "Patient Entry",
  "system engine": "System Engine",
  "special care": "Special Care",
  "system setup": "System Setup",
  "billing & payments": "Billing & Payments",
  "insurance & discounts": "Insurance & Discounts",
  "doctor care": "Doctor Care",
  "finance": "Finance",
  "lab & tests": "Lab & Tests",
  "patient records": "Patient Records",
  "finance & reports": "Finance & Reports",
  "nursing / triage": "Nursing / Triage",
};

/* =========================================================
   🧩 STATE
========================================================= */
let ALL_GROUPS = {};
let ACTIVE_CATEGORY = null;
let NAV_STACK = [];

/* =========================================================
   🚀 ENTRY
========================================================= */
export async function loadModulesTab(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="card modules-card border-0 shadow-sm">

      <div class="card-header modules-header d-flex justify-content-between align-items-center">
        <div>
          <h5 class="mb-0">Modules & Settings</h5>
          <small class="text-muted">Quick access & configuration</small>
        </div>

        <div class="modules-search-wrap position-relative">
          <i class="ri-search-line"></i>
          <input type="search" id="moduleSearch" placeholder="Search modules..." />
        </div>
      </div>

      <div class="modules-categories-wrap">
        <div id="moduleCategories" class="modules-categories"></div>
      </div>

      <div class="card-body">
        <div id="modulesContentWrapper">
          <div id="modulesBreadcrumb" class="modules-breadcrumb"></div>
          <div id="modulesContent" class="modules-grid elite"></div>
        </div>
      </div>

    </div>
  `;

  const searchInput = container.querySelector("#moduleSearch");
  const categoryBar = container.querySelector("#moduleCategories");
  const content = container.querySelector("#modulesContent");

  try {
    const res = await authFetch("/api/features/available-modules");
    if (!res.ok) throw new Error("Failed to load modules");

    const data = await res.json();
    const records = Array.isArray(data.data?.records)
      ? data.data.records
      : [];

    ALL_GROUPS = groupByCategory(records);

    renderCategoryTabs(categoryBar, Object.keys(ALL_GROUPS), content);

    ACTIVE_CATEGORY = Object.keys(ALL_GROUPS)[0] || null;
    NAV_STACK = [ACTIVE_CATEGORY]; 
    setActiveCategory(ACTIVE_CATEGORY, categoryBar, content);

    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      const source = ALL_GROUPS[ACTIVE_CATEGORY] || [];

      const filtered = q
        ? source.filter(
            (m) =>
              m.name?.toLowerCase().includes(q) ||
              m.key?.toLowerCase().includes(q)
          )
        : source;

      renderModuleTiles(filtered, content);
    });

  } catch (err) {
    console.error("❌ Modules tab load failed:", err);
    content.innerHTML = `<div class="text-danger">Failed to load modules.</div>`;
  }
}

/* =========================================================
   🧠 GROUP
========================================================= */
function groupByCategory(modules = []) {
  return modules.reduce((acc, m) => {
    const cat = m.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});
}

/* =========================================================
   🧭 CATEGORY TABS (FIXED)
========================================================= */
function renderCategoryTabs(container, categories = [], content) {
  container.innerHTML = "";

  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "module-category-btn";
    btn.dataset.category = cat;

    /* 🔥 FIX: normalize category */
    const normalized = (cat || "").trim().toLowerCase();
    const key = CATEGORY_LOOKUP[normalized];

    const style = CATEGORY_STYLES[key] || {
      icon: "ri-folder-line",
      color: "#64748b",
    };

    btn.innerHTML = `
      <i class="${style.icon}" style="color:${style.color}"></i>
      <span>${cat}</span>
      <span class="badge">${ALL_GROUPS[cat]?.length || 0}</span>
    `;

    btn.addEventListener("click", () => {
      NAV_STACK = [cat];   // 🔥 start breadcrumb
      setActiveCategory(cat, container, content);
    });

    container.appendChild(btn);
  });
}

/* =========================================================
   🎯 ACTIVE CATEGORY
========================================================= */
function setActiveCategory(category, bar, content) {
  ACTIVE_CATEGORY = category;

  bar.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", b.dataset.category === category);
  });

  renderModuleTiles(ALL_GROUPS[category] || [], content);
}

/* =========================================================
   🧱 MODULE TILES
========================================================= */
function renderModuleTiles(modules = [], container) {
  const wrapper = container.closest("#modulesContentWrapper");
  const breadcrumb = wrapper.querySelector("#modulesBreadcrumb");

  /* 🔥 SHOW BREADCRUMB */
  breadcrumb.innerHTML = NAV_STACK.map((step, i) => {
    if (i === NAV_STACK.length - 1) {
      return `<span class="crumb active">${step}</span>`;
    }
    return `<span class="crumb link" data-index="${i}">${step}</span>`;
  }).join(" <span class='sep'>›</span> ");

  /* 🔥 CLICK BREADCRUMB TO GO BACK */
  breadcrumb.querySelectorAll(".crumb.link").forEach(el => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.index);
      NAV_STACK = NAV_STACK.slice(0, idx + 1);

      const root = NAV_STACK[0];
      let current = ALL_GROUPS[root];

      for (let i = 1; i < NAV_STACK.length; i++) {
        const step = NAV_STACK[i];
        current = current.find(m => m.name === step)?.children || [];
      }

      renderModuleTiles(current, container);
    });
  });

  /* 🔥 RENDER CARDS */
  container.innerHTML = "";

  modules.forEach((m) => {
    const tile = document.createElement("div");
    tile.className = "module-tile";

    tile.innerHTML = `
      <div class="module-icon">
        <i class="${m.icon || "ri-grid-line"}"></i>
      </div>
      <div class="module-name">${m.name}</div>
      <div class="module-helper">
        ${
          m.children?.length
            ? "Open section"
            : m.route
            ? "Open module"
            : "Configuration"
        }
      </div>
    `;

    /* 🔥 SUB CATEGORY */
    if (Array.isArray(m.children) && m.children.length) {
      tile.addEventListener("click", () => {
        NAV_STACK.push(m.name);
        renderModuleTiles(m.children, container);
      });

    /* 🔥 NORMAL MODULE */
    } else if (m.route) {
      tile.addEventListener("click", () => {
        window.location.href = m.route;
      });
    }

    container.appendChild(tile);
  });
}