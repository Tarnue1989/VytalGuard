// 📁 utils/resolveOrgFacility.js
import {
  isSuperAdmin,
  isOrgLevelUser,
} from "./role-utils.js";

import { Invoice } from "../models/index.js";

/* ============================================================
   🏢 ROLE-BASED ORG / FACILITY RESOLUTION (WRITE SCOPE — FINAL)
   🔒 LEDGER-SAFE + TENANT-SAFE
   ------------------------------------------------------------
   Resolution priority:
   1️⃣ Invoice (strongest — immutable truth)
   2️⃣ Explicit payload (SUPERADMIN ONLY)
   3️⃣ User session (STRICT enforcement)
   4️⃣ Fail closed
============================================================ */
export async function resolveOrgFacility({ user, value = {}, body = {} }) {
  let orgId = null;
  let facilityId = null;

  if (!user) {
    throw new Error("resolveOrgFacility: user is required");
  }

  /* ==========================================================
     1️⃣ INVOICE-BASED RESOLUTION (HIGHEST PRIORITY)
  ========================================================== */
  const invoiceId =
    value.invoice_id ||
    body.invoice_id ||
    null;

  if (invoiceId) {
    const invoice = await Invoice.findByPk(invoiceId, {
      attributes: ["organization_id", "facility_id"],
    });

    if (!invoice) {
      throw new Error("resolveOrgFacility: invalid invoice reference");
    }

    return {
      orgId: invoice.organization_id,
      facilityId: invoice.facility_id,
    };
  }

  /* ==========================================================
     2️⃣ SUPER ADMIN (CAN OVERRIDE)
  ========================================================== */
  if (isSuperAdmin(user)) {
    orgId = value.organization_id || body.organization_id || null;
    facilityId = value.facility_id || body.facility_id || null;
  }

  /* ==========================================================
     3️⃣ NON-SUPER USERS (STRICT TENANT ENFORCEMENT)
  ========================================================== */
  else {
    orgId = user.organization_id || null;

    /* ========================================================
       🔥 CRITICAL RULE
       IF facility_id EXISTS → ALWAYS RESTRICT
    ======================================================== */
    if (user.facility_id) {
      facilityId = user.facility_id;
    }

    /* ========================================================
       TRUE ORG LEVEL (NO facility_id)
    ======================================================== */
    else if (isOrgLevelUser(user)) {
      // allow facility from payload ONLY if provided
      facilityId = value.facility_id || body.facility_id || null;
    }

    /* ========================================================
       MULTI-FACILITY SUPPORT (FUTURE SAFE)
    ======================================================== */
    else if (
      Array.isArray(user.facility_ids) &&
      user.facility_ids.length > 0
    ) {
      facilityId = user.facility_ids[0];
    }
  }

  /* ==========================================================
     🚨 HARD SAFETY — FAIL CLOSED
  ========================================================== */
  if (!orgId) {
    throw new Error("resolveOrgFacility: organization_id unresolved");
  }

  if (!facilityId) {
    throw new Error("resolveOrgFacility: facility_id unresolved");
  }

  return { orgId, facilityId };
}