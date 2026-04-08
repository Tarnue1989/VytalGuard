/* ============================================================
   💰 BILLABLE UTILS (FINAL — FIXED)
============================================================ */

import { getBillableItemPrice } from "./getBillableItemPrice.js";

/* ============================================================
   🔢 Normalize Price
============================================================ */
export function normalizePrice(value) {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/* ============================================================
   🔥 DB RESOLVER (KEEP)
============================================================ */
export async function resolveBillablePrice({
  billable_item_id,
  payer_type = "cash",
  currency,
  organization_id,
  facility_id,
  transaction,
}) {
  try {
    const result = await getBillableItemPrice({
      billable_item_id,
      payer_type,
      currency,
      organization_id,
      facility_id,
      transaction,
    });

    return {
      price: normalizePrice(result.price),
      currency: result.currency,
      payer_type: result.payer_type,
      price_id: result.price_id,
      source: "pricing_table",
    };
  } catch (err) {
    return {
      price: 0,
      currency: currency || "USD",
      payer_type,
      price_id: null,
      source: "fallback",
      error: err.message,
    };
  }
}

/* ============================================================
   🔥 MISSING FUNCTION (THIS CAUSED YOUR CRASH)
============================================================ */
export function getResolvedPrice(item, payerType = "cash", strict = false) {
  const prices = item?.prices || [];
  const now = new Date();

  // 🔍 EXACT MATCH
  const exact = prices.find(
    (p) =>
      p.payer_type === payerType &&
      !p.effective_to &&
      new Date(p.effective_from) <= now
  );

  if (exact) {
    return {
      price: normalizePrice(exact.price),
      currency: exact.currency || item?.currency || "USD",
      matched: true,
    };
  }

  // 🔥 STRICT MODE → NO FALLBACK
  if (strict) {
    return null;
  }

  // 🔁 DEFAULT
  const def = prices.find((p) => p.is_default && !p.effective_to);
  if (def) {
    return {
      price: normalizePrice(def.price),
      currency: def.currency || item?.currency || "USD",
      matched: false,
    };
  }

  // 🔁 FINAL FALLBACK
  return {
    price: normalizePrice(item?.price),
    currency: item?.currency || "USD",
    matched: false,
  };
}

/* ============================================================
   📦 BULK RESOLVER
============================================================ */
export async function resolveMultipleBillablePrices({
  items = [],
  payer_type = "cash",
  currency,
  organization_id,
  facility_id,
  transaction,
}) {
  const results = [];

  for (const item of items) {
    const resolved = await resolveBillablePrice({
      billable_item_id: item.billable_item_id || item.id,
      payer_type,
      currency,
      organization_id,
      facility_id,
      transaction,
    });

    results.push({
      ...item,
      price: resolved.price,
      currency: resolved.currency,
      payer_type: resolved.payer_type,
      price_id: resolved.price_id,
      pricing_source: resolved.source,
    });
  }

  return results;
}

/* ============================================================
   🧾 CALCULATE LINE TOTAL
============================================================ */
export function calculateLineTotal({
  price = 0,
  quantity = 1,
  discount = 0,
  tax = 0,
}) {
  const p = normalizePrice(price);
  const q = normalizePrice(quantity);

  let subtotal = p * q;

  if (discount) subtotal -= normalizePrice(discount);
  if (tax) subtotal += normalizePrice(tax);

  return normalizePrice(subtotal);
}