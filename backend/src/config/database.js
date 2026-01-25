// 📁 backend/src/config/database.js
import "dotenv/config";
import { Sequelize } from "sequelize";

let sequelize = null;

export function getSequelize() {
  if (!sequelize) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("❌ DATABASE_URL is not set");

    const isLocal =
      url.includes("localhost") || url.includes("127.0.0.1");

    sequelize = new Sequelize(url, {
      dialect: "postgres",
      logging: process.env.SQL_LOG === "true" ? console.log : false,
      define: { freezeTableName: true },
      dialectOptions: isLocal
        ? {}
        : {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          },
    });
  }
  return sequelize;
}

// ✅ THIS IS WHAT MODELS NEED
export { sequelize };

export async function initSequelize() {
  const db = getSequelize();
  await db.authenticate();
  console.log("✅ Database connected successfully");
  return db;
}
