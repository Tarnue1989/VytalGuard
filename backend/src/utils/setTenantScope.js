// 📁 utils/applyTenantWhere.js
import { Op } from "sequelize";

export function applyTenantWhere(where, req, options = {}) {
  const { useFacilityJoin = false } = options;

  /* ================= SUPERADMIN ================= */
  if (req.user?.roleNames?.includes("superadmin")) {
    return where;
  }

  /* ================= ORGANIZATION ================= */
  const orgId = req.user?.organization_id;
  if (!orgId) {
    throw new Error("Tenant scope missing: organization_id");
  }

  where.organization_id = orgId;

  /* ================= FACILITY ================= */

  // 🔥 CASE 1: NORMAL MODULES (facility_id column exists)
  if (!useFacilityJoin) {
    if (
      Array.isArray(req.user.facility_ids) &&
      req.user.facility_ids.length > 0
    ) {
      where[Op.or] = [
        { facility_id: { [Op.in]: req.user.facility_ids } },
        { facility_id: null },
      ];
    }
  }

  // 🔥 CASE 2: USER MODULE (uses JOIN)
  else {
    if (
      Array.isArray(req.user.facility_ids) &&
      req.user.facility_ids.length > 0
    ) {
      where[Op.and] = where[Op.and] || [];

      where[Op.and].push({
        "$facilities.id$": {
          [Op.in]: req.user.facility_ids,
        },
      });
    }
  }

  return where;
}