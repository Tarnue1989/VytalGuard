// 📁 backend/src/config/database.js
import "dotenv/config";
import { Sequelize } from "sequelize";

let sequelize = null;

export function getSequelize() {
  if (!sequelize) {
    const url = process.env.DATABASE_URL;

    // 🔥 DEBUG START
    console.log("====================================");
    console.log("🔥 DEBUG DATABASE CONFIG");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("DATABASE_URL (raw):", process.env.DATABASE_URL);

    if (url) {
      try {
        const parsed = new URL(url);
        console.log("➡️ Parsed DB Info:");
        console.log("   Dialect:", parsed.protocol);
        console.log("   User:", parsed.username);
        console.log("   Host:", parsed.hostname);
        console.log("   Port:", parsed.port);
        console.log("   DB Name:", parsed.pathname.replace("/", ""));
      } catch (e) {
        console.log("❌ Failed to parse DATABASE_URL");
      }
    }
    console.log("====================================");
    // 🔥 DEBUG END

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

  try {
    await db.authenticate();
    console.log("✅ Database connected successfully");
  } catch (err) {
    console.error("💥 DB AUTH ERROR:", err.message);
    throw err;
  }

  return db;
}