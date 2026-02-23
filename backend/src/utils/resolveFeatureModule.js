import { FeatureModule } from "../models/index.js";

/**
 * Resolve feature_module_id from:
 * - direct UUID
 * - canonical module_key
 * - plural / underscore / legacy aliases
 *
 * This keeps controllers human-readable
 * and billing strictly FK-driven.
 */
export async function resolveFeatureModuleId({
  feature_module_id,
  module_key,
}) {
  // ✅ FK always wins
  if (feature_module_id) return feature_module_id;

  if (!module_key || typeof module_key !== "string") {
    throw new Error("Billing requires feature_module_id or module_key");
  }

  const raw = module_key.trim().toLowerCase();

  // 🔁 Alias normalization (enterprise-safe)
  const candidates = new Set([
    raw,
    raw.replace(/_/g, "-"),
    raw.replace(/-/g, "_"),
    raw.replace(/_/g, " "),
    raw.replace(/-/g, " "),
    raw.endsWith("s") ? raw.slice(0, -1) : raw,
    raw.endsWith("s") ? raw.slice(0, -1).replace(/_/g, "-") : null,
  ]);

  const keys = [...candidates].filter(Boolean);

  const fm = await FeatureModule.findOne({
    where: { key: keys },
  });

  if (!fm) {
    throw new Error(
      `Unknown feature module key: ${module_key} (tried: ${keys.join(", ")})`
    );
  }

  return fm.id;
}
