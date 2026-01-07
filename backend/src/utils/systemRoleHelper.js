// utils/systemRoleHelper.js

const SYSTEM_ROLE_NAMES = new Set([
  "superadmin",
  "system admin",
  "root",
  "organization_admin",
]);

export function isSystemRole(role) {
  if (!role) return false;

  const name = (role.name || "").trim().toLowerCase();

  return (
    SYSTEM_ROLE_NAMES.has(name) &&
    role.organization_id == null &&
    role.facility_id == null
  );
}
