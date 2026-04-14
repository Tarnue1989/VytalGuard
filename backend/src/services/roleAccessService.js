// 📁 backend/src/services/roleAccessService.js
// ============================================================================
// 🔐 Role Access Service – Enterprise (FeatureAccess + RolePermission UPSERT)
// ----------------------------------------------------------------------------
// ✔ Handles module assignment (FeatureAccess)
// ✔ Handles permission UPSERT (add/remove diff only)
// ✔ Enforces module ↔ permission integrity
// ✔ Multi-tenant safe (org + facility)
// ✔ Transaction-safe (REQUIRED)
// ============================================================================

import { Op } from "sequelize";
import {
  FeatureAccess,
  RolePermission,
  Permission,
  FeatureModule,
} from "../models/index.js";

import { FEATURE_ACCESS_STATUS } from "../constants/enums.js";

/* ============================================================================
   🧠 MAIN SERVICE
============================================================================ */
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

  /* ============================================================
     🔍 LOAD MODULES
  ============================================================ */
  const modules = await FeatureModule.findAll({
    where: { id: { [Op.in]: module_ids } },
    attributes: ["id", "key", "tenant_scope", "visibility"],
    transaction,
  });

  if (modules.length !== module_ids.length) {
    throw new Error("One or more modules not found");
  }

  const moduleKeys = modules.map(m => m.key);

  /* ============================================================
     🔒 VALIDATE MODULES
  ============================================================ */
  for (const m of modules) {
    if (m.visibility === "hidden") {
      throw new Error("Cannot assign hidden module");
    }
  }

  /* ============================================================
     🧹 REPLACE FEATURE ACCESS (MODULES)
  ============================================================ */
  await FeatureAccess.destroy({
    where: {
      role_id,
      organization_id,
      facility_id,
    },
    force: true,
    transaction,
  });

  const featurePayload = module_ids.map(module_id => ({
    role_id,
    module_id,
    organization_id,
    facility_id,
    status: FEATURE_ACCESS_STATUS.ACTIVE,
    created_by_id: user?.id || null,
  }));

  await FeatureAccess.bulkCreate(featurePayload, { transaction });

  /* ============================================================
     🔍 LOAD PERMISSIONS (BY KEYS)
  ============================================================ */
  const incomingPerms = await Permission.findAll({
    where: { key: { [Op.in]: permission_keys } },
    attributes: ["id", "module"],
    transaction,
  });

  /* ============================================================
     🔒 VALIDATE PERMISSION ↔ MODULE
  ============================================================ */
  for (const p of incomingPerms) {
    if (!moduleKeys.includes(p.module)) {
      throw new Error(
        `Permission '${p.module}' not allowed (module not selected)`
      );
    }
  }

  /* ============================================================
     📦 EXISTING ROLE PERMISSIONS
  ============================================================ */
  const existing = await RolePermission.findAll({
    where: {
      role_id,
      organization_id,
      facility_id,
    },
    attributes: ["permission_id"],
    transaction,
  });

  const existingIds = new Set(existing.map(e => e.permission_id));
  const incomingIds = new Set(incomingPerms.map(p => p.id));

  /* ============================================================
     🔄 DIFF LOGIC
  ============================================================ */
  const toAdd = [];
  const toRemove = [];

  for (const id of incomingIds) {
    if (!existingIds.has(id)) toAdd.push(id);
  }

  for (const id of existingIds) {
    if (!incomingIds.has(id)) toRemove.push(id);
  }

  /* ============================================================
     🧹 REMOVE ONLY UNCHECKED
  ============================================================ */
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

  /* ============================================================
     ➕ ADD ONLY NEW
  ============================================================ */
  if (toAdd.length) {
    const payload = toAdd.map(permission_id => ({
      role_id,
      permission_id,
      organization_id,
      facility_id,
      created_by_id: user?.id || null,
    }));

    await RolePermission.bulkCreate(payload, { transaction });
  }

  /* ============================================================
     ✅ RETURN SUMMARY
  ============================================================ */
  return {
    modules_assigned: module_ids.length,
    permissions_added: toAdd.length,
    permissions_removed: toRemove.length,
  };
}