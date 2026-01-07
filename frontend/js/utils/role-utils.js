/* ============================================================
   🔐 Frontend Role Utilities (Single Source of Truth)
============================================================ */

/**
 * Resolve normalized role name from storage / token
 * @returns {"superadmin" | "organization_admin" | "facility_admin" | "staff"}
 */
export function resolveUserRole() {
  const raw = (localStorage.getItem("userRole") || "").toLowerCase();

  if (raw.includes("superadmin")) return "superadmin";
  if (raw.includes("organization_admin")) return "organization_admin";
  if (raw.includes("facility_admin")) return "facility_admin";

  return "staff";
}

export function isSuperAdmin() {
  return resolveUserRole() === "superadmin";
}

export function isOrgAdmin() {
  return resolveUserRole() === "organization_admin";
}

export function isFacilityAdmin() {
  return resolveUserRole() === "facility_admin";
}

/**
 * Get org id from token or storage
 */
export function getOrgId() {
  return (
    localStorage.getItem("organizationId") ||
    (() => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) return null;
        return JSON.parse(atob(token.split(".")[1]))?.organization_id || null;
      } catch {
        return null;
      }
    })()
  );
}

/**
 * Get facility id from token
 */
export function getFacilityId() {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;
    return JSON.parse(atob(token.split(".")[1]))?.facility_id || null;
  } catch {
    return null;
  }
}
