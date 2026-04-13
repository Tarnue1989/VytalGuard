// 📁 utils/auditLogger.js

import { EntityStatusHistory } from "../models/index.js";

export async function logStatusChange({
  entity_type,
  entity_id,
  status,
  previous_status = null,
  action,
  user = null,
  note = null,
  metadata = null,
}) {
  try {
    if (!entity_type || !entity_id || !status || !action) {
      console.warn("⚠️ Audit skipped: missing required fields");
      return;
    }

    await EntityStatusHistory.create({
      entity_type,
      entity_id,

      organization_id: user?.organization_id || null,
      facility_id: user?.facility_id || null,

      status,
      previous_status,
      action,

      changed_by_id: user?.id || null,

      note,
      metadata,
    });

  } catch (err) {
    console.error("❌ Audit log failed:", err.message);
  }
}