/* ============================================================
   🔐 Frontend Role Resolver (Canonical)
   ------------------------------------------------------------
   • Single source of truth for role scope
   • Mirrors backend role semantics
   • Used by ALL forms (role, department, staff, billing)
============================================================ */

export function resolveUserRole() {
  // 1️⃣ Prefer explicit roleNames array (most accurate)
  const roleNamesRaw =
    JSON.parse(localStorage.getItem("roleNames") || "[]");

  const roleNames = roleNamesRaw.map(r => r.toLowerCase());

  if (roleNames.includes("superadmin")) return "superadmin";
  if (roleNames.includes("organization_admin")) return "organization_admin";
  if (roleNames.includes("facility_admin")) return "facility_admin";

  // 2️⃣ Fallback to legacy single role
  const legacyRole =
    (localStorage.getItem("userRole") || "").toLowerCase();

  if (legacyRole.includes("super")) return "superadmin";
  if (legacyRole.includes("organization_admin")) return "organization_admin";
  if (legacyRole.includes("facility_admin")) return "facility_admin";

  return "staff";
}

/* ============================================================
   🧭 Scope helpers (clean + readable)
============================================================ */

export function isSuperAdmin() {
  return resolveUserRole() === "superadmin";
}

export function isOrgAdmin() {
  return resolveUserRole() === "organization_admin";
}

export function isFacilityAdmin() {
  return resolveUserRole() === "facility_admin";
}

export function isFacilityScopedUser() {
  const role = resolveUserRole();
  return role === "facility_admin" || role === "staff";
}

/* ============================================================
   🏢 Context helpers
============================================================ */

export function getOrganizationId() {
  return (
    localStorage.getItem("organizationId") ||
    JSON.parse(atob(localStorage.getItem("accessToken")?.split(".")[1] || ""))
      ?.organization_id ||
    null
  );
}

export function getFacilityId() {
  return (
    localStorage.getItem("facilityId") ||
    JSON.parse(atob(localStorage.getItem("accessToken")?.split(".")[1] || ""))
      ?.facility_id ||
    null
  );
}
