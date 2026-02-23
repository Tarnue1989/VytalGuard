import { Role, Permission } from "../models/index.js";
import { accessViolationService } from "./accessViolationService.js";
import { logger } from "../utils/logger.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (THIS FILE ONLY)
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("authz", DEBUG_OVERRIDE);

/* ============================================================
   🧭 ACTION MAP
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
   🛡️ SAFE STRING UTILS (CRITICAL FIX)
============================================================ */
const safeString = (v) => (typeof v === "string" ? v : "");
const safeTrim = (v) => safeString(v).trim();

/* ============================================================
   🔧 Helper — getRolePermissions
============================================================ */
export async function getRolePermissions(roleIds = [], { user } = {}) {
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

  // 🚫 System roles only usable by superadmin
  const allowedRoles = roles.filter((role) => {
    if (role.role_type === "system") return isSuperAdmin;
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
  async checkPermission({ user, module, module_key, action, res }) {
    /* ============================================================
       🧪 DEBUG — USER CONTEXT
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
       🔹 SYSTEM USER CHECK
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

    // 🛡️ System-role bypass
    if (isSystemUser) {
      logger.info(
        `🛡️ [authzService] System-role bypass for user=${user.id}`
      );
      return true;
    }

    /* ============================================================
       🔹 NORMALIZATION (FIXED)
       Accepts BOTH module and module_key safely
    ============================================================ */
    const rawModule = safeTrim(module || module_key);
    const normalizedAction = ACTION_MAP[action] || action;

    let normalizedModule = rawModule
      .toLowerCase()
      .replace(/-/g, "_")
      .replace(/\s+/g, "_");

    if (!normalizedModule.endsWith("s")) {
      normalizedModule += "s";
    }

    const permissionKey = `${normalizedModule}:${normalizedAction}`;
    const altKey = permissionKey.replace(/_/g, "-");

    debug.log("PERMISSION KEY RESOLUTION", {
      rawModule,
      normalizedModule,
      normalizedAction,
      permissionKey,
    });

    /* ============================================================
       🔹 COLLECT PERMISSIONS
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
       🔹 PERMISSION CHECK
    ============================================================ */
    const isAllowed =
      userPermissions.includes("*") ||
      userPermissions.includes(permissionKey) ||
      userPermissions.includes(altKey);

    if (!isAllowed) {
      await accessViolationService.logViolation({
        module: normalizedModule,
        action: normalizedAction,
        user,
        reason: `Permission denied. Needed ${permissionKey}`,
      });

      logger.warn(
        `🚫 [authzService] DENIED user=${user.id} → ${permissionKey}`
      );

      if (res) {
        res.status(403).json({
          message: `Access denied: Requires ${permissionKey}`,
        });
      }
      return false;
    }

    logger.info(
      `✅ [authzService] ALLOWED user=${user.id} → ${permissionKey}`
    );
    return true;
  },
};
