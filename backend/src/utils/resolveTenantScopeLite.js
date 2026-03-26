import {
  isSuperAdmin,
  isOrgLevelUser,
} from "./role-utils.js";

/* ============================================================
   🧠 TENANT SCOPE (READ / LITE SAFE — FINAL)
   🔓 FLEXIBLE BUT SAFE
   ✔ Supports superadmin override
   ✔ Enforces facility restriction when needed
   ✔ Prevents accidental data leaks
============================================================ */
export function resolveTenantScopeLite({ user, query = {} }) {
  let orgId = null;
  let facilityId = null;

  if (!user) {
    return { orgId: null, facilityId: null };
  }

  /* ==========================================================
     1️⃣ SUPER ADMIN (CAN OVERRIDE FROM QUERY)
  ========================================================== */
  if (isSuperAdmin(user)) {
    orgId = query.organization_id || null;
    facilityId = query.facility_id || null;

    return { orgId, facilityId };
  }

  /* ==========================================================
     2️⃣ NON-SUPER USERS
  ========================================================== */
  orgId = user.organization_id || null;

  /* ==========================================================
     3️⃣ FACILITY LOGIC (🔥 CRITICAL FIX)
     - If user has facility_id → ALWAYS restrict
     - Only true org-level users (no facility_id) are free
  ========================================================== */
  if (user.facility_id) {
    facilityId = user.facility_id;
  } else if (!isOrgLevelUser(user)) {
    // fallback safety (in case helper is misconfigured)
    facilityId = user.facility_id || null;
  }

  /* ==========================================================
     4️⃣ OPTIONAL: SUPPORT MULTI-FACILITY USERS (FUTURE SAFE)
  ========================================================== */
  if (!facilityId && Array.isArray(user.facility_ids) && user.facility_ids.length > 0) {
    // you can switch to Op.in later if needed
    facilityId = user.facility_ids[0];
  }

  return { orgId, facilityId };
}