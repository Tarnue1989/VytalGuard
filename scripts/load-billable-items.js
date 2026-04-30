import xlsx from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
import { Op, fn, col, where } from "sequelize";

import db from "../backend/src/models/index.js";

const {
  MasterItem,
  MasterItemCategory,
  BillableItem,
  BillableItemPrice,
} = db;

/* ================= CONFIG ================= */
const ORG_ID = "53dca480-7c5c-4520-b3b9-d4770c3b4dcb";
const FACILITY_ID = "b61c1809-e8ec-4154-b489-8dd52b1ef52a";

/* ================= PATH ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE = path.join(__dirname, "../data/billable_import.xlsx");

/* ================= HELPERS ================= */
const normalize = (v) => String(v || "").trim().toLowerCase();

const VALID_PAYER = ["cash", "insurance"];

/* ================= RUN ================= */
async function run() {
  const t = await db.sequelize.transaction();

  try {
    console.log("📥 Reading:", FILE);

    const wb = xlsx.readFile(FILE);
    const sheet = wb.Sheets["prices"];
    if (!sheet) throw new Error("Sheet 'prices' not found");

    const rows = xlsx.utils.sheet_to_json(sheet);
    console.log("📊 Rows:", rows.length);

    for (const row of rows) {
      const name = normalize(row.name);
      const categoryName = normalize(row.category);

      let payer_type = normalize(row.payer_type);
      const price = Number(row.price);
      const currency = row.currency;

      const is_default =
        String(row.is_default).toLowerCase() === "true";

      if (!name) throw new Error("Missing name");
      if (!categoryName) throw new Error("Missing category");
      if (isNaN(price)) throw new Error(`Invalid price: ${row.name}`);

      /* ================= FIX PAYER ================= */
      if (!VALID_PAYER.includes(payer_type)) {
        console.warn("⚠️ Invalid payer → default cash:", row.name);
        payer_type = "cash";
      }

      /* ================= MASTER ================= */
      const master = await MasterItem.findOne({
        where: {
          organization_id: ORG_ID,
          [Op.and]: where(fn("LOWER", col("name")), name),
        },
        transaction: t,
      });

      if (!master) {
        throw new Error(`❌ Master not found: ${row.name}`);
      }

      /* ================= CATEGORY ================= */
      const category = await MasterItemCategory.findOne({
        where: {
          organization_id: ORG_ID,
          [Op.and]: where(fn("LOWER", col("name")), categoryName),
        },
        transaction: t,
      });

      if (!category) {
        throw new Error(`❌ Category not found: ${row.category}`);
      }

      /* ================= BILLABLE ================= */
      let billable = await BillableItem.findOne({
        where: {
          master_item_id: master.id,
          organization_id: ORG_ID,
          facility_id: FACILITY_ID,
        },
        transaction: t,
      });

      if (!billable) {
        billable = await BillableItem.create(
          {
            master_item_id: master.id,
            name: master.name,
            code: master.code,
            category_id: category.id,

            // 🔥 ALWAYS TRUST CATEGORY
            item_type: category.order_type,

            price,
            currency,
            status: "active",
            organization_id: ORG_ID,
            facility_id: FACILITY_ID,
          },
          { transaction: t }
        );

        console.log("🆕 Billable:", master.name);
      }

      /* ================= PRICE ================= */
      let priceRow = await BillableItemPrice.findOne({
        where: {
          billable_item_id: billable.id,
          payer_type,
          currency,
        },
        transaction: t,
      });

      if (!priceRow) {
        await BillableItemPrice.create(
          {
            billable_item_id: billable.id,
            payer_type,
            price,
            currency,
            is_default,
            organization_id: ORG_ID,
            facility_id: FACILITY_ID,
          },
          { transaction: t }
        );

        console.log("💰 CREATE:", master.name, payer_type, price);
      } else {
        // 🔥 UPDATE INSTEAD OF SKIP
        await priceRow.update(
          {
            price,
            is_default,
          },
          { transaction: t }
        );

        console.log("🔄 UPDATE:", master.name, payer_type, price);
      }
    }

    await t.commit();
    console.log("🎉 DONE — ALL PRICES SYNCED");
  } catch (err) {
    await t.rollback();
    console.error("❌ ERROR:", err.message);
  }
}

run();