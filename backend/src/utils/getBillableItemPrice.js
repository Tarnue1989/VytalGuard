// 📁 backend/src/utils/getBillableItemPrice.js

import { Op } from "sequelize";
import { BillableItemPrice } from "../models/index.js";
import { fxService } from "../services/fxService.js";

export async function getBillableItemPrice({
  billable_item_id,
  payer_type = "cash",
  currency,
  organization_id,
  facility_id,
  transaction,
}) {
  if (!billable_item_id) throw new Error("Missing billable_item_id");
  if (!currency) throw new Error("Missing currency");

  const today = new Date();

  let priceRow = null;
  let source = "none";

  /* ============================================================
     🔧 COMMON WHERE BUILDER
  ============================================================ */
  const baseWhere = {
    billable_item_id,
    organization_id,

    // ❌ REMOVED is_active

    effective_from: { [Op.lte]: today },
    [Op.and]: [
      {
        [Op.or]: [
          { facility_id },
          { facility_id: null },
        ],
      },
      {
        [Op.or]: [
          { effective_to: null },
          { effective_to: { [Op.gte]: today } },
        ],
      },
    ],
  };

  const order = [
    ["facility_id", "DESC"],     // facility first
    ["is_default", "DESC"],
    ["effective_from", "DESC"],
  ];

  /* ============================================================
     1️⃣ EXACT MATCH (STRICT)
  ============================================================ */
  priceRow = await BillableItemPrice.findOne({
    where: {
      ...baseWhere,
      payer_type,
      currency,
    },
    order,
    transaction,
  });

  if (priceRow) source = "exact";

  /* ============================================================
     2️⃣ FALLBACK → SAME CURRENCY (CASH ONLY)
  ============================================================ */
  if (!priceRow && payer_type !== "cash") {
    priceRow = await BillableItemPrice.findOne({
      where: {
        ...baseWhere,
        payer_type: "cash",
        currency,
      },
      order,
      transaction,
    });

    if (priceRow) source = "cash_fallback";
  }

  /* ============================================================
     3️⃣ FALLBACK → DEFAULT (STRICT)
  ============================================================ */
  if (!priceRow) {
    priceRow = await BillableItemPrice.findOne({
      where: {
        ...baseWhere,
        is_default: true,
      },
      order,
      transaction,
    });

    if (priceRow) source = "default";
  }

  /* ============================================================
     ❌ NO PRICE
  ============================================================ */
  if (!priceRow) {
    throw new Error(
      `No price configured for item=${billable_item_id}, currency=${currency}, payer=${payer_type}`
    );
  }

  let price = Number(priceRow.price);

  if (Number.isNaN(price)) {
    throw new Error(`Invalid price for item=${billable_item_id}`);
  }

  /* ============================================================
     🔄 FX CONVERSION
  ============================================================ */
  let fx_used = false;

  if (priceRow.currency !== currency) {
    const converted = await fxService.convert({
      amount: price,
      from_currency: priceRow.currency,
      to_currency: currency,
      organization_id,
      facility_id,
      transaction,
    });

    if (!converted || Number.isNaN(converted)) {
      throw new Error(
        `FX failed: ${priceRow.currency} → ${currency}`
      );
    }

    price = Number(converted);
    fx_used = true;
  }

  /* ============================================================
     ❌ ZERO PROTECTION
  ============================================================ */
  if (price <= 0) {
    throw new Error(`Invalid price (<=0) for item=${billable_item_id}`);
  }

  price = Number(price.toFixed(2));

  return {
    price,
    currency,
    payer_type: priceRow.payer_type,
    price_id: priceRow.id,
    source,
    fx_used,
    original_currency: priceRow.currency,
  };
}