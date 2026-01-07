// 📁 utils/resolveOrgFacility.js
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "./role-utils.js";

/* ============================================================
   🏢 ROLE-BASED ORG / FACILITY RESOLUTION (WRITE SCOPE)
   ============================================================ */
export function resolveOrgFacility({ user, value = {}, body = {} }) {
  let orgId = user?.organization_id || null;
  let facilityId = null;

  if (isSuperAdmin(user)) {
    orgId = value.organization_id || body.organization_id || null;
    facilityId = value.facility_id || body.facility_id || null;
  } 
  else if (isOrgLevelUser(user)) {
    orgId = user.organization_id;
    facilityId = value.facility_id || null;
  } 
  else if (isFacilityHead(user)) {
    orgId = user.organization_id;
    facilityId = user.facility_id;
  } 
  else {
    orgId = user.organization_id;
    facilityId = user.facility_id || null;
  }

  return { orgId, facilityId };
}
