// Centralized enterprise-grade role normalization & privilege helpers

/* ============================================================
   🔧 Role Normalization
============================================================ */
export function getUserRoles(user) {
  if (!user) return [];

  let roles = [];

  // Preferred: explicit roleNames array (from auth payload)
  if (Array.isArray(user.roleNames) && user.roleNames.length) {
    roles = user.roleNames;

  // Legacy / fallback fields
  } else if (typeof user.role === "string" && user.role.length) {
    roles = [user.role];

  } else if (typeof user.role_name === "string" && user.role_name.length) {
    roles = [user.role_name];
  }

  return roles
    .filter(Boolean)
    .map((r) => String(r).toLowerCase().trim());
}

/* ============================================================
   🧱 Core Role Checks
============================================================ */
export function isSuperAdmin(user) {
  const roles = getUserRoles(user);
  return roles.some((r) =>
    ["superadmin", "systemadmin", "root"].includes(r)
  );
}

/**
 * 🔑 Org-level users (ORG-WIDE scope, facility OPTIONAL)
 * Includes: org_owner, organization_admin, org_admin
 */
export function isOrgLevelUser(user) {
  const roles = getUserRoles(user);
  return roles.some((r) =>
    [
      "org_owner",
      "organizationowner",
      "organization_admin",
      "org_admin",
    ].includes(r)
  );
}

/**
 * 🔁 BACKWARD-COMPATIBILITY ALIAS
 * DO NOT REMOVE (used across controllers)
 */
export const isOrgOwner = isOrgLevelUser;

export function isFacilityHead(user) {
  const roles = getUserRoles(user);
  return roles.includes("facility_head") || roles.includes("facilityhead");
}

/* ============================================================
   🧩 Generic Match Helper
============================================================ */
export function hasRole(user, targetRoles = []) {
  if (!Array.isArray(targetRoles) || !targetRoles.length) return false;

  const roles = getUserRoles(user);
  return targetRoles.some((r) =>
    roles.includes(String(r).toLowerCase().trim())
  );
}

/* ============================================================
   🚀 Elevated Access (visibility / scope bypass)
============================================================ */
export function hasElevatedAccess(user) {
  return (
    isSuperAdmin(user) ||
    isOrgLevelUser(user) ||
    isFacilityHead(user)
  );
}

/* ============================================================
   🧾 Default Export (optional convenience)
============================================================ */
export default {
  getUserRoles,
  isSuperAdmin,
  isOrgLevelUser,
  isOrgOwner,        // 👈 compatibility alias
  isFacilityHead,
  hasRole,
  hasElevatedAccess,
};
