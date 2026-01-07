// 📁 middleware/scopeFacility.js
import { setTenantScope } from "../utils/setTenantScope.js";
import { sequelize } from "../models/index.js";

export function scopeFacility(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const roles = req.user.roles || [];
    const roleNames = roles.map((r) => (r.name || "").toLowerCase());
    const roleNormalized = roles.map((r) => (r.normalized || "").toLowerCase());

    /* ============================================================
       🔥 EXCEPTION: INVOICE-ROOTED MODULES (PAYMENTS)
       Payments derive facility from Invoice, NOT request body
    ============================================================ */
    if (
      req.baseUrl.includes("/payments") &&
      ["POST", "PUT"].includes(req.method)
    ) {
      req.models = sequelize.models;
      return next();
    }

    /* ============================================================
       1️⃣ SUPER ADMIN — GLOBAL ACCESS (NO ORG / NO FACILITY)
    ============================================================ */
    if (
      roleNormalized.includes("superadmin") ||
      roleNames.includes("super admin") ||
      roleNormalized.includes("root")
    ) {
      const facilityId =
        req.query?.facility_id ||
        req.body?.facility_id ||
        null;

      req.user.facility_id = facilityId;
      req.facility_id = facilityId || null;

      req.models = facilityId
        ? setTenantScope(sequelize, facilityId)
        : sequelize.models;

      return next();
    }

    /* ============================================================
       2️⃣ ORG-LEVEL USERS (NO FACILITY REQUIRED)
       - organization_admin
       - org_owner
    ============================================================ */
    const isOrgLevel =
      roleNormalized.includes("organization_admin") ||
      roleNames.includes("organization admin") ||
      roleNormalized.includes("org_owner") ||
      roleNames.includes("org owner");

    if (isOrgLevel) {
      const orgId = req.user.organization_id;

      if (!orgId) {
        return res
          .status(403)
          .json({ message: "Organization context not found" });
      }

      // Attach org context
      req.organization_id = orgId;
      req.user.organization_id = orgId;

      // ❌ DO NOT REQUIRE FACILITY
      req.user.facility_id = null;
      req.facility_id = null;

      // Inject org into body/query safely
      if (req.body && typeof req.body === "object") {
        req.body.organization_id = orgId;
      }
      if (req.query && typeof req.query === "object") {
        req.query.organization_id = orgId;
      }

      // Org-scoped modules use base models
      req.models = sequelize.models;
      return next();
    }

    /* ============================================================
       3️⃣ FACILITY-LEVEL USERS (FACILITY REQUIRED)
    ============================================================ */
    if (!Array.isArray(req.user.facility_ids) || req.user.facility_ids.length === 0) {
      return res
        .status(403)
        .json({ message: "Facility context not found" });
    }

    const facilityId = req.user.facility_ids[0];

    if (!facilityId) {
      return res
        .status(403)
        .json({ message: "Facility context invalid" });
    }

    // Attach facility context
    req.user.facility_id = facilityId;
    req.facility_id = facilityId;

    if (req.body && typeof req.body === "object") {
      req.body.facility_id = facilityId;
    }
    if (req.query && typeof req.query === "object") {
      req.query.facility_id = facilityId;
    }

    req.models = setTenantScope(sequelize, facilityId);
    return next();

  } catch (err) {
    console.error("❌ Error in scopeFacility middleware:", err);
    return res
      .status(500)
      .json({ message: "Facility/Organization scope enforcement failed" });
  }
}
