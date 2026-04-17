// 📁 backend/src/services/roleAccessService.js

import { Op } from "sequelize";
import {
  FeatureAccess,
  RolePermission,
  Permission,
  FeatureModule,
} from "../models/index.js";

import { FEATURE_ACCESS_STATUS } from "../constants/enums.js";

/* ============================================================================ */
export async function upsertRoleAccess({
  role_id,
  module_ids = [],
  permission_keys = [],
  organization_id,
  facility_id = null,
  user,
  transaction,
}) {
  if (!role_id) throw new Error("Missing role_id");
  if (!organization_id) throw new Error("Missing organization_id");

  /* ============================================================ */
  const modules = await FeatureModule.findAll({
    where: { id: { [Op.in]: module_ids } },
    attributes: ["id", "key", "tenant_scope", "visibility"],
    transaction,
  });

  if (modules.length !== module_ids.length) {
    throw new Error("One or more modules not found");
  }

  const moduleKeys = modules.map((m) => m.key);

  /* ============================================================ */
  // 🔥 CLEANUP OLD MODULE PERMISSIONS
  const allowedPermissions = await Permission.findAll({
    where: { module: moduleKeys },
    attributes: ["id"],
    transaction,
  });

  const allowedPermissionIds = new Set(
    allowedPermissions.map((p) => p.id)
  );

  const existingAll = await RolePermission.findAll({
    where: { role_id, organization_id, facility_id },
    attributes: ["permission_id"],
    transaction,
  });

  const invalidPermissionIds = existingAll
    .map((e) => e.permission_id)
    .filter((id) => !allowedPermissionIds.has(id));

  if (invalidPermissionIds.length) {
    await RolePermission.destroy({
      where: {
        role_id,
        permission_id: { [Op.in]: invalidPermissionIds },
        organization_id,
        facility_id,
      },
      force: true,
      transaction,
    });
  }

  /* ============================================================ */
  for (const m of modules) {
    if (m.visibility === "hidden") {
      throw new Error("Cannot assign hidden module");
    }
  }

  /* ============================================================ */
  await FeatureAccess.destroy({
    where: { role_id, organization_id, facility_id },
    force: true,
    transaction,
  });

  const featurePayload = module_ids.map((module_id) => ({
    role_id,
    module_id,
    organization_id,
    facility_id,
    status: FEATURE_ACCESS_STATUS.ACTIVE,
    created_by_id: user?.id || null,
  }));

  await FeatureAccess.bulkCreate(featurePayload, { transaction });

  /* ============================================================ */
  const incomingPerms = await Permission.findAll({
    where: { key: { [Op.in]: permission_keys } },
    attributes: ["id", "key"],
    transaction,
  });

  /* ============================================================ */
  // 🔥 FIXED VALIDATION (handles singular/plural automatically)
  for (const p of incomingPerms) {
    let permissionModule = p.key.split(":")[0];

    // 🔥 HANDLE IRREGULAR PLURALS
    const MODULE_KEY_MAP = {
      feature_accesses: "feature_access",
      feature_modules: "feature_modules", // safe
      organization_brandings: "organization_branding",
      insurance_providers: "insurance_provider",
      finance_reports: "finance",
    };

    const normalizedModule =
      MODULE_KEY_MAP[permissionModule] || permissionModule;

    const isMatch = moduleKeys.some((modKey) => {
      return (
        normalizedModule === modKey ||         // exact
        normalizedModule === modKey + "s" ||   // plural
        normalizedModule + "s" === modKey      // singular
      );
    });

    if (!isMatch) {
      throw new Error(
        `Permission '${permissionModule}' not allowed (module not selected)`
      );
    }
  }

  /* ============================================================ */
  const existing = await RolePermission.findAll({
    where: { role_id, organization_id, facility_id },
    attributes: ["permission_id"],
    transaction,
  });

  const existingIds = new Set(existing.map((e) => e.permission_id));
  const incomingIds = new Set(incomingPerms.map((p) => p.id));

  /* ============================================================ */
  const toAdd = [];
  const toRemove = [];

  for (const id of incomingIds) {
    if (!existingIds.has(id)) toAdd.push(id);
  }

  for (const id of existingIds) {
    if (!incomingIds.has(id)) toRemove.push(id);
  }

  /* ============================================================ */
  if (toRemove.length) {
    await RolePermission.destroy({
      where: {
        role_id,
        permission_id: { [Op.in]: toRemove },
        organization_id,
        facility_id,
      },
      transaction,
    });
  }

  /* ============================================================ */
  if (toAdd.length) {
    const payload = toAdd.map((permission_id) => ({
      role_id,
      permission_id,
      organization_id,
      facility_id,
      created_by_id: user?.id || null,
    }));

    await RolePermission.bulkCreate(payload, {
      transaction,
      ignoreDuplicates: true,
    });
  }

  /* ============================================================ */
  return {
    modules_assigned: module_ids.length,
    permissions_added: toAdd.length,
    permissions_removed: toRemove.length,
  };
}