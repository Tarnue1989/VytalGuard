import "dotenv/config";

import { Role } from "../models/index.js";
import { grantAllOrgPermissions } from "../services/roleProvisioningService.js";

const ORG_ADMIN_NAMES = [
  "organization admin",
  "organization_admin",
  "org admin",
  "org_admin",
  "organization owner",
  "organization_owner",
  "org owner",
  "org_owner",
];

const normalize = (v) =>
  String(v || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

async function run() {
  try {
    console.log("🔄 Backfilling Org Admin permissions...");

    const roles = await Role.findAll({
      where: { role_type: "custom" },
    });

    for (const role of roles) {
      const normalized = normalize(role.name);

      const isOrgAdmin = ORG_ADMIN_NAMES
        .map(normalize)
        .includes(normalized);

      if (!isOrgAdmin || !role.organization_id) continue;

      console.log(
        `✅ Granting permissions → ${role.name} (${role.organization_id})`
      );

      await grantAllOrgPermissions({
        role_id: role.id,
        organization_id: role.organization_id,
      });
    }

    console.log("🎉 Org Admin permission backfill completed.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  }
}

run();
