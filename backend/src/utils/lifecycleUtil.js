// 📁 backend/src/utils/lifecycleUtil.js
// ============================================================================
// 🧠 Lifecycle Utility – Enterprise Master Pattern (GUARDED FINAL)
// ----------------------------------------------------------------------------
// - Atomic lifecycle transitions
// - Status + metadata + audit in ONE write
// - PAST-TENSE enforced (approved / voided / processed …)
// - Transaction enforced
// - Module agnostic
// ============================================================================

const ALLOWED_ACTIONS = new Set([
  "created",
  "reviewed",
  "approved",
  "processed",
  "rejected",
  "cancelled",
  "voided",
  "reversed",
  "restored",
  "verified",
  "finalized",
]);

export function applyLifecycleTransition({
  entity,          // Sequelize model instance
  action,          // MUST be past tense
  nextStatus,      // enum value
  user,
  reason = null,
  t,               // REQUIRED sequelize transaction
}) {
  if (!entity) {
    throw new Error("❌ Lifecycle entity is required");
  }

  if (!user?.id) {
    throw new Error("❌ Lifecycle transition requires user");
  }

  if (!t) {
    throw new Error("❌ Lifecycle transition requires transaction");
  }

  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(
      `❌ Invalid lifecycle action '${action}'. ` +
      `Use past-tense only: ${Array.from(ALLOWED_ACTIONS).join(", ")}`
    );
  }

  const now = new Date();

  /* -------------------- audit trail -------------------- */
  const reasonLog = Array.isArray(entity.reason_log)
    ? [...entity.reason_log]
    : [];

  reasonLog.push({
    action,
    reason: reason || null,
    user_id: user.id,
    timestamp: now,
  });

  /* -------------------- lifecycle fields -------------------- */
  const updates = {
    status: nextStatus,
    updated_by_id: user.id,
    updated_at: now,
    reason_log: reasonLog,
  };

  // dynamic lifecycle metadata
  updates[`${action}_by_id`] = user.id;
  updates[`${action}_at`] = now;

  /* -------------------- persist atomically -------------------- */
  return entity.update(updates, {
    transaction: t,
    user,
  });
}
