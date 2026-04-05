// 📁 backend/src/utils/getBillableItemPrice.js

import { sequelize, BillableItemPrice } from "../models/index.js";

/**
 * 🔥 getBillableItemPrice
 * ------------------------------------------------------------
 * Central pricing engine for billing
 * ------------------------------------------------------------
 * ✔ Multi-currency aware
 * ✔ Payer-type aware
 * ✔ Tenant-safe (org + facility)
 * ✔ Single source of truth
 */
export async function getBillableItemPrice({
  billable_item_id,
  payer_type = "cash",
  currency,
  organization_id,
  facility_id,
  transaction,
}) {
  if (!billable_item_id) {
    throw new Error("Missing billable_item_id");
  }

  if (!currency) {
    throw new Error("Missing currency");
  }

  /* ============================================================
     🔍 FIND EXACT MATCH (STRICT MATCH FIRST)
  ============================================================ */
  let priceRow = await BillableItemPrice.findOne({
    where: {
      billable_item_id,
      payer_type,
      currency,
      organization_id,
      facility_id,
    },
    transaction,
  });

  /* ============================================================
     🔁 FALLBACK → SAME CURRENCY, ANY PAYER
  ============================================================ */
  if (!priceRow) {
    priceRow = await BillableItemPrice.findOne({
      where: {
        billable_item_id,
        currency,
        organization_id,
        facility_id,
      },
      order: [["is_default", "DESC"]],
      transaction,
    });
  }

  /* ============================================================
     🔁 FALLBACK → DEFAULT PRICE (LAST RESORT)
  ============================================================ */
  if (!priceRow) {
    priceRow = await BillableItemPrice.findOne({
      where: {
        billable_item_id,
        organization_id,
        facility_id,
        is_default: true,
      },
      transaction,
    });
  }

  /* ============================================================
     ❌ NO PRICE FOUND
  ============================================================ */
  if (!priceRow) {
    throw new Error(
      `❌ No price configured for item=${billable_item_id}, currency=${currency}, payer=${payer_type}`
    );
  }

  const price = Number(priceRow.price);

  if (Number.isNaN(price)) {
    throw new Error(
      `❌ Invalid price for item=${billable_item_id} (not numeric)`
    );
  }

  return {
    price,
    currency: priceRow.currency,
    payer_type: priceRow.payer_type,
    price_id: priceRow.id,
  };
}