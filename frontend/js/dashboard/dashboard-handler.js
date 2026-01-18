// 📁 frontend/js/dashboard/dashboard-handler.js
import { restoreSession, getUser, logout, authFetch } from "../authSession.js";

/* -------------------- Route resolver -------------------- */
// Explicit maps for files whose names don't match the key 1:1
const ROUTE_MAP = {
  departments: "/department-list.html",
  facilities: "/facilities-list.html",
  feature_access: "/feature-access-list.html",
  feature_modules: "/feature-module-list.html",
  organizations: "/organization-list.html",
  roles: "/role-list.html",
  users: "/users-list.html",
};

function resolveRoute(m) {
  if (m?.route) return m.route; // ✅ prefer DB route
  if (m?.key && ROUTE_MAP[m.key]) return ROUTE_MAP[m.key];
  // Generic safe fallback
  return `/${String(m?.key || "").replace(/_/g, "-")}-list.html`;
}

/* -------------------- Init -------------------- */
export async function initDashboardSession() {
  const ok = await restoreSession(); // ✅ ensure session is valid
  if (!ok) {
    window.location.href = "/login.html";
    return;
  }

  const user = getUser();
  if (user) {
    const displayName =
      user.name ||
      `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
      "User";

    const role = user.role || "";

    // Sidebar profile name
    const sidebarName = document.querySelector(".sidebar-profile .profile-name");
    if (sidebarName) sidebarName.textContent = displayName;

    // Header user name
    const headerName = document.querySelector("#userSettings h6");
    if (headerName) headerName.textContent = displayName;

    // Header role
    const headerRole = document.querySelector("#userSettings span.small");
    if (headerRole) headerRole.textContent = role;
  }

  // ✅ Load sidebar after session + user info
  await loadSidebarModules();

  // Logout hook
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await logout();
    });
  }
}

/* -------------------- Load Sidebar Modules -------------------- */
async function loadSidebarModules() {
  try {
    const res = await authFetch("/api/features/available-modules");
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

    const data = await res.json();
    const records = Array.isArray(data.data?.records)
      ? data.data.records
      : [];

    renderSidebarModules(records);

    // Wire submenu toggles after DOM render
    setupSubmenuToggles();
  } catch (err) {
    console.error("❌ Failed to load sidebar modules:", err);
  }
}

/* -------------------- Render Sidebar -------------------- */
export function renderSidebarModules(modules, container = null) {
  const sidebarMenu = container || document.querySelector(".sidebar-menu");
  if (!sidebarMenu) return;

  // Only clear root menu
  if (!container) sidebarMenu.innerHTML = "";

  modules.forEach((m) => {
    const li = document.createElement("li");

    if (Array.isArray(m.children) && m.children.length > 0) {
      // 📂 Parent with submenu
      li.innerHTML = `
        <a href="javascript:void(0)" class="nav-link has-submenu" aria-expanded="false">
          <i class="${m.icon || "ri-folder-line"}"></i>
          <span>${m.name}</span>
          <i class="ri-arrow-down-s-line submenu-caret" aria-hidden="true"></i>
        </a>
        <ul class="submenu"></ul>
      `;

      const submenu = li.querySelector(".submenu");
      renderSidebarModules(m.children, submenu); // 🔁 recursion
    } else {
      // 📄 Leaf node
      const href = resolveRoute(m);
      li.innerHTML = `
        <a href="${href}" class="nav-link">
          <i class="${m.icon || "ri-file-line"}"></i>
          <span>${m.name}</span>
        </a>
      `;
    }

    sidebarMenu.appendChild(li);
  });
}

/* -------------------- Submenu Toggle Wiring -------------------- */
function setupSubmenuToggles() {
  document.querySelectorAll(".nav-link.has-submenu").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      const expanded = link.getAttribute("aria-expanded") === "true";
      link.setAttribute("aria-expanded", String(!expanded));

      const parentLi = link.closest("li");
      if (parentLi) parentLi.classList.toggle("open", !expanded);
    });
  });
}
