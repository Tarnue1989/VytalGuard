import { Op } from "sequelize";
import { BillingTrigger } from "../models/index.js";

/**
 * shouldTriggerBillingDB
 * ------------------------------------------------------------
 * Determines whether billing is allowed for a feature module
 * based on entity status and tenant overrides.
 *
 * 🔒 FK-driven (feature_module_id ONLY)
 * 🔒 Facility → Org → System precedence
 */
export async function shouldTriggerBillingDB({
  feature_module_id,
  status,
  organization_id,
  facility_id,
}) {
  if (!feature_module_id) {
    throw new Error(
      "shouldTriggerBillingDB requires feature_module_id. String modules are not supported."
    );
  }

  if (!status) return false;

  const trigger = await BillingTrigger.findOne({
    where: {
      feature_module_id,
      trigger_status: status.toLowerCase(),
      is_active: true,

      [Op.or]: [
        // 1️⃣ Facility override
        { organization_id, facility_id },

        // 2️⃣ Org-level override
        { organization_id, facility_id: null },

        // 3️⃣ System default
        { organization_id: null, facility_id: null },
      ],
    },
    order: [
      ["facility_id", "DESC"],
      ["organization_id", "DESC"],
    ],
  });

  return Boolean(trigger);
}
