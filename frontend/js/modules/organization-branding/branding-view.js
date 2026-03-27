// 📁 branding-view.js – FINAL MASTER (FULL + EMAIL + ICONS)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";

/* ============================================================
   🔐 AUTH
============================================================ */
initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🧠 SAFE TEXT
============================================================ */
function setText(id, value = "—") {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "—";
}

/* ============================================================
   🖼️ IMAGE HANDLER
============================================================ */
function resolveImage(url) {
  if (!url) return null;

  if (url.startsWith("http")) return url;
  if (url.startsWith("/uploads/")) return url;

  return `/uploads/${url}`;
}

function setImage(id, url, fallback) {
  const el = document.getElementById(id);
  if (!el) return;

  const finalUrl = resolveImage(url);
  el.src = finalUrl || fallback;
}

/* ============================================================
   📥 LOAD BRANDING
============================================================ */
async function loadBranding() {
  try {
    showLoading();

    const res = await authFetch("/api/organization-branding");
    const json = await res.json();

    if (!res.ok) throw new Error(json.message);

    const data = json.data || {};

    /* ============================================================
       🖼️ LOGO
    ============================================================ */
    const logoSrc =
      data.logo_print_url ||
      data.logo_url ||
      "https://via.placeholder.com/120x60?text=Logo";

    setImage("previewLogo", logoSrc);

    /* ============================================================
       🔥 HEADER LOGO
    ============================================================ */
    const headerLogo = document.getElementById("appHeaderLogo");

    if (headerLogo) {
      headerLogo.src =
        resolveImage(data.logo_print_url || data.logo_url) ||
        "https://via.placeholder.com/120x40?text=Logo";
    }

    /* ============================================================
       🌐 FAVICON
    ============================================================ */
    if (data.favicon_url) {
      const favicon = document.querySelector("link[rel='shortcut icon']");
      if (favicon) {
        favicon.href = resolveImage(data.favicon_url);
      }
    }

    /* ============================================================
       🏷️ HEADER PREVIEW (🔥 FULL FIX)
    ============================================================ */
    setText("previewName", data.company_name || "Organization");

    // Address
    const previewAddress = document.getElementById("previewAddress");
    if (previewAddress) {
      previewAddress.innerHTML = data.contact?.address
        ? `📍 ${data.contact.address}`
        : "—";
    }

    // Phone
    const previewPhone = document.getElementById("previewPhone");
    if (previewPhone) {
      previewPhone.innerHTML = data.contact?.phone
        ? `📞 ${data.contact.phone}`
        : "—";
    }

    // 🔥 EMAIL (CLICKABLE)
    const previewEmail = document.getElementById("previewEmail");
    if (previewEmail) {
      previewEmail.innerHTML = data.contact?.email
        ? `📧 <a href="mailto:${data.contact.email}">${data.contact.email}</a>`
        : "—";
    }

    /* ============================================================
       📄 DETAILS PANEL
    ============================================================ */
    setText("viewAddress", data.contact?.address);
    setText("viewPhone", data.contact?.phone);
    setText("viewEmail", data.contact?.email);

    /* ============================================================
       🎨 THEME
    ============================================================ */
    setText("viewPrimary", data.theme?.primary);
    setText("viewSecondary", data.theme?.secondary);
    setText("viewSurface", data.theme?.surface);
    setText("viewText", data.theme?.text);

    /* ============================================================
       🏷️ STATUS
    ============================================================ */
    setText("viewStatus", data.status || "active");

  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load branding");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🔘 BUTTONS
============================================================ */
document.getElementById("editBtn")?.addEventListener("click", () => {
  window.location.href = "/add-organization-branding.html";
});

/* ============================================================
   🚀 INIT
============================================================ */
document.addEventListener("DOMContentLoaded", loadBranding);