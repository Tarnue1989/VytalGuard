import {
  isSuperAdmin,
  isOrgAdmin,
  isFacilityAdmin,
  getOrganizationId,
  getFacilityId,
} from "./roleResolver.js";

export function applyRequestScope(payload = {}) {
  const scoped = { ...payload };

  /* 🔐 SUPERADMIN */
  if (isSuperAdmin()) {
    if (!("organization_id" in scoped)) {
      scoped.organization_id = getOrganizationId() ?? null;
    }
    if (!("facility_id" in scoped)) {
      scoped.facility_id = getFacilityId() ?? null;
    }
    return scoped;
  }

  /* 🏢 ORG ADMIN */
  if (isOrgAdmin()) {
    // org comes from token
    delete scoped.organization_id;

    // facility OPTIONAL but KEY MUST EXIST
    if (!("facility_id" in scoped)) {
      scoped.facility_id = null;
    }
    return scoped;
  }

  /* 🏥 FACILITY ADMIN / STAFF */
  delete scoped.organization_id;

  if (!("facility_id" in scoped)) {
    scoped.facility_id = getFacilityId() ?? null;
  }

  return scoped;
}
