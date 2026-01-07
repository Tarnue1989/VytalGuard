import {
  Role,
  Permission,
  RolePermission,
  FeatureModule,
  FeatureAccess,
} from "../models/index.js";

/* ============================================================
   🔍 INTERNAL: Detect ORG ADMIN role (STRICT)
   - NO name guessing
   - NO system roles
============================================================ */
function isOrgAdminRole(role) {
  if (!role) return false;

  if (role.role_type === "system") return false;

  if (role.code !== "ORG_ADMIN") return false;

  // Org admin MUST be org-wide
  return !!role.organization_id && role.facility_id === null;
}

/* ============================================================
   🔐 CORE: Sync ONE org admin role (KEEP NAME)
============================================================ */
export async function syncOrgAdminForRole(roleId) {
  const role = await Role.findByPk(roleId);
  if (!isOrgAdminRole(role)) return;

  console.log("🚀 [AUTO-PROVISION] Org admin sync start", {
    roleId: role.id,
    organization_id: role.organization_id,
  });

  const organization_id = role.organization_id;

  /* ---------- PERMISSIONS ---------- */
  const permissions = await Permission.findAll({
    attributes: ["id"],
    raw: true,
  });

  if (permissions.length) {
    await RolePermission.bulkCreate(
      permissions.map((p) => ({
        role_id: role.id,
        permission_id: p.id,
        organization_id,
        facility_id: null,
      })),
      { ignoreDuplicates: true }
    );
  }

  /* ---------- FEATURE MODULES ---------- */
  const modules = await FeatureModule.findAll({
    attributes: ["id"],
    raw: true,
  });

  if (modules.length) {
    await FeatureAccess.bulkCreate(
      modules.map((m) => ({
        role_id: role.id,
        module_id: m.id,
        organization_id,
        facility_id: null,
        status: "active",
      })),
      { ignoreDuplicates: true }
    );
  }

  console.log("✅ [AUTO-PROVISION] Org admin sync complete", {
    roleId: role.id,
  });
}

/* ============================================================
   🏢 ORG CREATED → sync org admin roles
============================================================ */
export async function syncOrgAdminForOrganization(organization_id) {
  const roles = await Role.findAll({
    where: { organization_id },
  });

  for (const role of roles) {
    if (isOrgAdminRole(role)) {
      await syncOrgAdminForRole(role.id);
    }
  }
}

/* ============================================================
   🧩 MODULE CREATED → grant to ALL org admins
============================================================ */
export async function syncOrgAdminsForModule(moduleKey) {
  const module = await FeatureModule.findOne({
    where: { key: moduleKey },
  });
  if (!module) return;

  const roles = await Role.findAll({
    where: {
      role_type: "custom",
      code: "ORG_ADMIN",
    },
  });

  for (const role of roles) {
    await FeatureAccess.findOrCreate({
      where: {
        role_id: role.id,
        module_id: module.id,
        organization_id: role.organization_id,
        facility_id: null,
      },
      defaults: {
        status: "active",
      },
    });
  }
}
