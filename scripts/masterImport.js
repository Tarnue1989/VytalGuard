import xlsx from "xlsx";
import db from "../backend/src/models/index.js";
import { Op, fn, col, where } from "sequelize";

const { MasterItem, MasterItemCategory, Organization } = db;

const ORG_ID = "53dca480-7c5c-4520-b3b9-d4770c3b4dcb";

/* =========================
   HELPERS
========================= */
const normalize = (v) => String(v || "").trim().toLowerCase();

/* 🔥 FINAL CODE FIX (DB SAFE) */
const normalizeCode = (code, name) => {
  let prefix = String(code || "")
    .toUpperCase()
    .split("-")[0]
    .replace(/[^A-Z]/g, "");

  // If prefix too short → derive from name
  if (prefix.length < 3) {
    prefix = String(name || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3);
  }

  // Max 5 letters
  prefix = prefix.slice(0, 5);

  let number = String(code || "").split("-")[1] || "1";

  return `${prefix}-${String(number).padStart(4, "0")}`;
};

/* =========================
   MAIN
========================= */
async function run() {
  const wb = xlsx.readFile("./data/master_items.xlsx");
  const sheet = wb.Sheets["master"];
  const rows = xlsx.utils.sheet_to_json(sheet);

  const org = await Organization.findByPk(ORG_ID);
  if (!org) throw new Error("Invalid org");

  for (const row of rows) {
    const required = ["name", "code", "category", "order_type"];
    for (const f of required) {
      if (!row[f]) throw new Error(`Missing ${f}`);
    }

    /* =========================
       CATEGORY
    ========================= */
    let category = await MasterItemCategory.findOne({
      where: {
        organization_id: ORG_ID,
        [Op.and]: where(fn("LOWER", col("name")), normalize(row.category)),
      },
    });

    if (!category) {
      category = await MasterItemCategory.create({
        name: row.category,
        code: normalize(row.category)
          .replace(/[^a-z0-9]/g, "_")
          .replace(/_+/g, "_"),
        order_type: row.order_type,
        organization_id: ORG_ID,
      });

      console.log("Created Category:", row.category);
    }

    /* =========================
       MASTER ITEM
    ========================= */
    const safeCode = normalizeCode(row.code, row.name);

    let master = await MasterItem.findOne({
      where: {
        organization_id: ORG_ID,
        [Op.or]: [
          where(fn("LOWER", col("name")), normalize(row.name)),
          { code: safeCode },
        ],
      },
    });

    if (!master) {
      await MasterItem.create({
        name: row.name,
        code: safeCode,
        item_type: row.order_type,
        category_id: category.id,
        organization_id: ORG_ID,
      });

      console.log("Created:", row.name, "→", safeCode);
    } else {
      console.log("Skipped (exists):", row.name);
    }
  }

  console.log("DONE");
}

run();