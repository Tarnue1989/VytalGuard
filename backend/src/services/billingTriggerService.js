import { Op } from "sequelize";
import { BillingTrigger } from "../models/index.js";

export async function shouldTriggerBillingDB({
  module,
  status,
  organization_id,
  facility_id,
}) {
  const trigger = await BillingTrigger.findOne({
    where: {
      module_key: module.toLowerCase(),
      trigger_status: status.toLowerCase(),
      is_active: true,
      [Op.or]: [
        // Facility override
        { organization_id, facility_id },

        // Org override
        { organization_id, facility_id: null },

        // System default
        { organization_id: null, facility_id: null },
      ],
    },
    order: [
      ["facility_id", "DESC"],
      ["organization_id", "DESC"],
    ],
  });

  return !!trigger;
}
