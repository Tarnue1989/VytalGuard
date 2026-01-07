// 📁 backend/src/services/permissionService.js
import { User, Role, Permission } from "../models/index.js";

/**
 * Fetch all permissions for a user.
 * Works via UserFacility → Role → RolePermission → Permission
 */
export async function getPermissionsForUser(userId, { includeDeleted = false } = {}) {
  const user = await User.findByPk(userId, {
    include: [
      {
        association: "roles", // from User.belongsToMany(Role, { through: UserFacility })
        include: [{ association: "permissions" }], // Role → Permission
      },
    ],
    paranoid: !includeDeleted,
  });

  if (!user) return [];

  // Flatten permissions across roles
  const allPermissions = user.roles.flatMap((role) =>
    role.permissions ? role.permissions.map((p) => p.key) : []
  );

  // Return unique permission keys
  return [...new Set(allPermissions)];
}

/**
 * Check if user has a specific permission.
 */
export async function hasPermission(userId, permissionKey) {
  const permissions = await getPermissionsForUser(userId);
  return permissions.includes(permissionKey);
}
