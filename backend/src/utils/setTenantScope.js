// 📁 utils/applyTenantWhere.js
import { Op } from "sequelize";

export function applyTenantWhere(where, req) {
  if (req.user?.roleNames?.includes("superadmin")) {
    return where; // global
  }

  const orgId = req.user?.organization_id;
  if (!orgId) {
    throw new Error("Tenant scope missing: organization_id");
  }

  where.organization_id = orgId;

  // Facility-aware (optional)
  if (Array.isArray(req.user.facility_ids) && req.user.facility_ids.length > 0) {
    where[Op.or] = [
      { facility_id: { [Op.in]: req.user.facility_ids } },
      { facility_id: null }, // org-wide rows
    ];
  }

  return where;
}
