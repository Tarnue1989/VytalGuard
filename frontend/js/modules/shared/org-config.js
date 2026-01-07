// 📁 org-config.js – Centralized Organization Config (static fallback only)
// Location: /js/modules/shared/org-config.js

/**
 * Static org info (until backend endpoint is ready).
 * Update values here if you want to change letterhead/export headers.
 */
const ORG_INFO = Object.freeze({
  name: "VytalGuard Health",
  address: "123 Main Street, Monrovia, Liberia",
  phone: "+231-770-000-000",
  email: "info@vytalguard.com",
  website: "https://vytalguard.com",
  logo: "/assets/images/logo.png", // ensure file exists in assets/images
});

/**
 * Returns org info (static for now).
 */
export function getOrgInfo() {
  return ORG_INFO;
}
