// 📁 js/dashboard/modules-tab.js

import { authFetch } from "../authSession.js";

/* =========================================================
   🧩 Modules & Settings – TILE GRID RENDERER (uCertify Style)
========================================================= */

export async function loadModulesTab(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="card shadow-sm">
      <div class="card-header">
        <h5 class="mb-0">Modules & Settings</h5>
      </div>
      <div class="card-body">
        <div class="modules-grid" id="modulesGrid"></div>
      </div>
    </div>
  `;

  const grid = container.querySelector("#modulesGrid");

  try {
    const res = await authFetch(`/api/features/available-modules`);
    if (!res.ok) throw new Error("Failed to load modules");

    const data = await res.json();
    const records = Array.isArray(data.data?.records)
      ? data.data.records
      : [];

    renderModuleTiles(records, grid);
  } catch (err) {
    console.error("❌ Modules tab load failed:", err);
    grid.innerHTML = `<div class="text-danger">Failed to load modules.</div>`;
  }
}

/* =========================================================
   🧱 Tile Renderer (recursive, SAFE)
========================================================= */

function renderModuleTiles(modules = [], container) {
  container.innerHTML = "";

  modules.forEach((m) => {
    const tile = document.createElement("div");
    tile.className = "module-tile";

    tile.innerHTML = `
      <div class="module-icon">
        <i class="${m.icon || "ri-grid-line"}"></i>
      </div>

      <div class="module-name">
        ${m.name}
      </div>

      <div class="module-helper">
        ${m.children?.length ? "View sub-modules" : "Open module"}
      </div>
    `;

    // 📂 Parent modules → drill-down
    if (m.children?.length) {
      tile.classList.add("has-children");

      tile.addEventListener("click", () => {
        container.innerHTML = `
          <div class="mb-3">
            <button
              class="btn btn-sm btn-outline-secondary"
              id="backToModules">
              ← Back
            </button>
          </div>
        `;

        renderModuleTiles(m.children, container);

        container
          .querySelector("#backToModules")
          .addEventListener("click", () =>
            renderModuleTiles(modules, container)
          );
      });

    // 📄 Leaf module → navigate
    } else if (m.route) {
      tile.addEventListener("click", () => {
        window.location.href = m.route;
      });
    }

    container.appendChild(tile);
  });
}
