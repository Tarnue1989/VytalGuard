import { Role, Permission } from "../models/index.js";
import { accessViolationService } from "./accessViolationService.js";
import { logger } from "../utils/logger.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (THIS FILE ONLY)
   true  = debug ON for authz
   false = debug OFF for authz
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("authz", DEBUG_OVERRIDE);

/* ============================================================
   🧭 ACTION MAP
   Maps common CRUD actions to permission suffixes
============================================================ */
const ACTION_MAP = {
  read: "view",
  list: "view",
  list_lite: "view",
  create: "create",
  update: "edit",
  delete: "delete",
};

/* ============================================================
   🔧 Helper — getRolePermissions
   (SYSTEM-SAFE, DB-TRUTH BASED)
============================================================ */
export async function getRolePermissions(
  roleIds = [],
  { user } = {}
) {
  if (!roleIds.length) return [];

  const roles = await Role.scope("active").findAll({
    where: { id: roleIds },
    include: [
      {
        model: Permission,
        as: "permissions",
        through: { attributes: [] },
      },
    ],
  });

  const isSuperAdmin = Boolean(
    user?.roles?.some(
      (r) =>
        r.role_type === "system" &&
        (r.normalized === "superadmin" || r.code === "superadmin")
    )
  );

  // 🚫 HARD FILTER — system roles only allowed for superadmin
  const allowedRoles = roles.filter((role) => {
    if (role.role_type === "system") {
      return isSuperAdmin;
    }
    return true;
  });

  return allowedRoles.flatMap((r) =>
    r.permissions.map((p) => p.key)
  );
}

/* ============================================================
   🔐 AUTHZ SERVICE
============================================================ */
export const authzService = {
  /**
   * Check if a user has permission for module + action
   */
  async checkPermission({ user, module, action, res }) {
    /* ============================================================
       🧪 DEBUG — USER CONTEXT AT AUTHZ ENTRY
    ============================================================ */
    debug.log("AUTHZ ENTRY → user context", {
      userId: user?.id,
      organization_id: user?.organization_id,
      facility_id: user?.facility_id,
      facility_ids: user?.facility_ids,
      roleNames: user?.roleNames,
      roles: user?.roles?.map((r) => ({
        id: r.id,
        name: r.name,
        normalized: r.normalized,
        role_type: r.role_type,
        code: r.code,
      })),
    });

    if (!user) {
      if (res) res.status(401).json({ message: "Unauthorized" });
      return false;
    }

    /* ============================================================
       🔹 Determine SYSTEM USER (DB truth)
    ============================================================ */
    const isSystemUser = Boolean(
      user.roles?.some(
        (r) =>
          r.role_type === "system" &&
          (r.normalized === "superadmin" || r.code === "superadmin")
      )
    );

    debug.log("AUTHZ SYSTEM CHECK", {
      userId: user.id,
      isSystemUser,
    });

    // 🛡️ SYSTEM ROLE BYPASS (AUDIT-CRITICAL → ALWAYS LOG)
    if (isSystemUser) {
      logger.info(
        `🛡️ [authzService] System-role bypass for user=${user.id} (${module}:${action})`
      );
      return true;
    }

    /* ============================================================
       🔹 Normalize action and module
    ============================================================ */
    const normalizedAction = ACTION_MAP[action] || action;

    let normalizedModule = module
      .trim()
      .toLowerCase()
      .replace(/-/g, "_")
      .replace(/\s+/g, "_");

    if (!normalizedModule.endsWith("s")) {
      normalizedModule += "s";
    }

    const permissionKey = `${normalizedModule}:${normalizedAction}`;
    const altKey = permissionKey.replace(/_/g, "-");

    debug.log("PERMISSION KEY RESOLUTION", {
      module,
      normalizedModule,
      normalizedAction,
      permissionKey,
    });

    /* ============================================================
       🔹 Gather permissions (CUSTOM ROLES ONLY)
    ============================================================ */
    let userPermissions = new Set(user.permissions || []);

    if (Array.isArray(user.roles) && user.roles.length > 0) {
      const safeRoleIds = user.roles
        .filter((r) => r.role_type !== "system")
        .map((r) => r.id)
        .filter(Boolean);

      debug.log("ROLE IDS USED FOR PERMISSION LOOKUP", {
        userId: user.id,
        safeRoleIds,
      });

      if (safeRoleIds.length > 0) {
        const dbPerms = await getRolePermissions(safeRoleIds, { user });
        dbPerms.forEach((perm) => userPermissions.add(perm));
      }
    }

    userPermissions = [...userPermissions];

    debug.log("FINAL PERMISSION SET", {
      userId: user.id,
      permissions: userPermissions,
    });

    /* ============================================================
       🔹 Permission evaluation
    ============================================================ */
    const isAllowed =
      userPermissions.includes("*") ||
      userPermissions.includes(permissionKey) ||
      userPermissions.includes(altKey);

    if (!isAllowed) {
      await accessViolationService.logViolation({
        module,
        action: normalizedAction,
        user,
        reason: `Permission denied. Needed ${permissionKey}`,
      });

      // 🚨 SECURITY LOG — ALWAYS ON
      logger.warn(
        `🚫 [authzService] DENIED user=${user.id} (${module}:${action}) → ${permissionKey}`
      );

      if (res) {
        res.status(403).json({
          message: `Access denied: Requires ${permissionKey}`,
        });
      }
      return false;
    }

    // ✅ SECURITY / AUDIT LOG — ALWAYS ON
    logger.info(
      `✅ [authzService] ALLOWED user=${user.id} → ${permissionKey}`
    );
    return true;
  },
};
