// 📁 js/dashboard/modules-tab.js

import { authFetch } from "../authSession.js";

/* =========================================================
   🧩 Modules & Settings – ENTERPRISE FINAL (LOCKED)
========================================================= */

let ALL_GROUPS = {};
let ACTIVE_CATEGORY = null;

/* =========================================================
   🚀 ENTRY
========================================================= */
export async function loadModulesTab(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="card modules-card border-0">

      <!-- 🔥 HEADER -->
      <div class="card-header modules-header">

        <div class="modules-title">
          <h5>Modules & Settings</h5>
          <span class="modules-sub">Quick access & configuration</span>
        </div>

        <div class="modules-search-wrap">
          <i class="ri-search-line"></i>
          <input
            type="search"
            id="moduleSearch"
            placeholder="Search modules..."
          />
        </div>

      </div>

      <!-- CATEGORY BAR -->
      <div class="modules-categories-wrap">
        <div id="moduleCategories" class="modules-categories"></div>
      </div>

      <!-- CONTENT -->
      <div class="card-body">
        <div id="modulesContent" class="modules-grid elite"></div>
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

    // default category
    ACTIVE_CATEGORY = Object.keys(ALL_GROUPS)[0] || null;
    setActiveCategory(ACTIVE_CATEGORY, categoryBar, content);

    /* 🔍 Search (scoped) */
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      const source = ALL_GROUPS[ACTIVE_CATEGORY] || [];

      const filtered = q
        ? source.filter(m =>
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
   🧠 HELPERS
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
   🧭 CATEGORY TABS (NO BOOTSTRAP)
========================================================= */
function renderCategoryTabs(container, categories = [], content) {
  container.innerHTML = "";

  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "module-category-btn";
    btn.dataset.category = cat;

    btn.innerHTML = `
      ${cat}
      <span class="badge bg-secondary ms-1">
        ${ALL_GROUPS[cat]?.length || 0}
      </span>
    `;

    btn.addEventListener("click", () => {
      setActiveCategory(cat, container, content);
    });

    container.appendChild(btn);
  });
}

/* =========================================================
   🎯 SET ACTIVE CATEGORY (CLEAN)
========================================================= */
function setActiveCategory(category, bar, content) {
  ACTIVE_CATEGORY = category;

  bar.querySelectorAll("button").forEach(b => {
    b.classList.toggle(
      "active",
      b.dataset.category === category
    );
  });

  renderModuleTiles(ALL_GROUPS[category] || [], content);
}

/* =========================================================
   🧱 MODULE TILES (SAFE + RECURSIVE)
========================================================= */
function renderModuleTiles(modules = [], container) {
  container.innerHTML = "";

  modules.forEach(m => {
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
            ? "View sub-modules"
            : m.route
            ? "Open module"
            : "Configuration"
        }
      </div>
    `;

    /* 📂 Parent → drill-down */
    if (Array.isArray(m.children) && m.children.length) {
      tile.classList.add("has-children");

      tile.addEventListener("click", () => {
        container.innerHTML = `
          <div class="mb-3">
            <button class="btn btn-sm btn-outline-secondary" id="backBtn">
              ← Back
            </button>
          </div>
        `;

        renderModuleTiles(m.children, container);

        container.querySelector("#backBtn").addEventListener("click", () => {
          renderModuleTiles(ALL_GROUPS[ACTIVE_CATEGORY] || [], container);
        });
      });

    /* 📄 Leaf → navigate */
    } else if (m.route) {
      tile.addEventListener("click", () => {
        window.location.href = m.route;
      });
    } else {
      tile.classList.add("disabled");
    }

    container.appendChild(tile);
  });
}