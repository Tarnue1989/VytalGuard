// 📁 utils/resolveOrgFacility.js
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "./role-utils.js";

import { Invoice } from "../models/index.js";

/* ============================================================
   🏢 ROLE-BASED ORG / FACILITY RESOLUTION (WRITE SCOPE)
   🔒 LEDGER-SAFE + INVOICE-AWARE (MASTER)
   ------------------------------------------------------------
   Resolution priority:
   1️⃣ Invoice (ledger-derived, strongest source of truth)
   2️⃣ Explicit payload (SUPERADMIN ONLY)
   3️⃣ User session
   4️⃣ Fail closed
============================================================ */
export async function resolveOrgFacility({ user, value = {}, body = {} }) {
  let orgId = null;
  let facilityId = null;

  /* ==========================================================
     1️⃣ INVOICE-BASED RESOLUTION (LEDGER DERIVED – MASTER)
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

    orgId = invoice.organization_id;
    facilityId = invoice.facility_id;
  }

  /* ==========================================================
     2️⃣ EXPLICIT PAYLOAD (SUPERADMIN ONLY)
  ========================================================== */
  if (!orgId && isSuperAdmin(user)) {
    orgId = value.organization_id || body.organization_id || null;
  }

  if (!facilityId && isSuperAdmin(user)) {
    facilityId = value.facility_id || body.facility_id || null;
  }

  /* ==========================================================
     3️⃣ USER SESSION FALLBACK (NON-SUPER)
  ========================================================== */
  if (!orgId) {
    orgId = user.organization_id || null;
  }

  if (!facilityId) {
    // Facility-level user
    if (user.facility_id) {
      facilityId = user.facility_id;
    }

    // Org admin with multiple facilities
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
