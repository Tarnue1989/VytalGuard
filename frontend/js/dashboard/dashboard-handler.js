// 📁 frontend/js/dashboard/dashboard-handler.js
import { restoreSession, getUser, logout, logoutAll, authFetch } from "../authSession.js";

/* -------------------- Route resolver -------------------- */
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
  if (m?.route) return m.route;
  if (m?.key && ROUTE_MAP[m.key]) return ROUTE_MAP[m.key];
  return `/${String(m?.key || "").replace(/_/g, "-")}-list.html`;
}

/* =========================================================
   🔐 LOGOUT MODAL HANDLER
========================================================= */
function openLogoutModal(message, onConfirm) {
  const modal = document.getElementById("logoutConfirmModal");
  const msg = document.getElementById("logoutMessage");
  const confirmBtn = document.getElementById("confirmLogoutBtn");
  const cancelBtn = document.getElementById("cancelLogoutBtn");

  if (!modal) return;

  msg.textContent = message;
  modal.classList.remove("hidden");

  confirmBtn.onclick = null;
  cancelBtn.onclick = null;

  confirmBtn.onclick = async () => {
    modal.classList.add("hidden");
    await onConfirm();
  };

  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
  };
}

/* -------------------- Init -------------------- */
export async function initDashboardSession() {
  const ok = await restoreSession();
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

    const sidebarName = document.querySelector(".sidebar-profile .profile-name");
    if (sidebarName) sidebarName.textContent = displayName;

    const headerName = document.querySelector("#userSettings h6");
    if (headerName) headerName.textContent = displayName;

    const headerRole = document.querySelector("#userSettings span.small");
    if (headerRole) headerRole.textContent = role;
  }

  // ✅ Load sidebar
  await loadSidebarModules();

  /* =========================================================
     🔥 NEW LOGOUT HOOK (MODAL BASED)
  ========================================================= */
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      openLogoutModal("Log out from this device only?", async () => {
        await logout();
      });
    });
  }

  const logoutAllBtn = document.getElementById("logoutAllBtn");
  if (logoutAllBtn) {
    logoutAllBtn.addEventListener("click", () => {
      openLogoutModal("Log out from ALL devices?", async () => {
        await logoutAll();
      });
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
    setupSubmenuToggles();
  } catch (err) {
    console.error("❌ Failed to load sidebar modules:", err);
  }
}

/* -------------------- Render Sidebar -------------------- */
export function renderSidebarModules(modules, container = null) {
  const sidebarMenu = container || document.querySelector(".sidebar-menu");
  if (!sidebarMenu) return;

  if (!container) sidebarMenu.innerHTML = "";

  modules.forEach((m) => {
    const li = document.createElement("li");

    if (Array.isArray(m.children) && m.children.length > 0) {
      li.innerHTML = `
        <a href="javascript:void(0)" class="nav-link has-submenu" aria-expanded="false">
          <i class="${m.icon || "ri-folder-line"}"></i>
          <span>${m.name}</span>
          <i class="ri-arrow-down-s-line submenu-caret"></i>
        </a>
        <ul class="submenu"></ul>
      `;

      const submenu = li.querySelector(".submenu");
      renderSidebarModules(m.children, submenu);
    } else {
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

/* -------------------- Submenu Toggle -------------------- */
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