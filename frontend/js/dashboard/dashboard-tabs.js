// 📁 js/dashboard/dashboard-tabs.js

import { initLiveDashboard } from "./dashboard-init.js";
import { loadModulesTab } from "./modules-tab.js";

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll("#dashboardTabs button");

  // ⚠️ IMPORTANT:
  // We no longer destroy DOM with innerHTML swapping.
  // We toggle visibility instead.
  const dashboardSection = document.querySelector(
    '[data-dashboard-section="dashboard"]'
  );
  const modulesSection = document.querySelector(
    '[data-dashboard-section="modules"]'
  );

  if (!tabs.length || !dashboardSection || !modulesSection) {
    console.warn("Dashboard tabs: required sections not found");
    return;
  }

  /* ===============================
     🔀 TAB CLICK HANDLING
     =============================== */
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;

      if (tab === "dashboard") {
        showDashboard();
      }

      if (tab === "modules") {
        showModules();
      }
    });
  });

  /* ===============================
     ✅ DEFAULT LOAD
     =============================== */
  showDashboard();

  /* ===============================
     🧠 DASHBOARD SHOW
     =============================== */
  function showDashboard() {
    dashboardSection.style.display = "block";
    modulesSection.style.display = "none";

    // ✅ Re-init dashboard ONLY once
    if (!dashboardSection.dataset.loaded) {
      dashboardSection.dataset.loaded = "1";
      initLiveDashboard();
    }
  }

  /* ===============================
     📦 MODULES & SETTINGS SHOW
     =============================== */
  function showModules() {
    dashboardSection.style.display = "none";
    modulesSection.style.display = "block";

    // ✅ Lazy-load modules tab ONCE
    if (!modulesSection.dataset.loaded) {
      modulesSection.dataset.loaded = "1";
      loadModulesTab(modulesSection);
    }
  }
});
