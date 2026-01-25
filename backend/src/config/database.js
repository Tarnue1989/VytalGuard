import { Sequelize } from "sequelize";

let sequelize;

export function getSequelize() {
  if (!sequelize) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");

    // 🔐 ENV-AWARE SSL (authoritative)
    const isProduction = process.env.NODE_ENV === "production";

    sequelize = new Sequelize(url, {
      dialect: "postgres",
      logging: process.env.SQL_LOG === "true" ? console.log : false,
      define: { freezeTableName: true },
      dialectOptions: isProduction
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false, // Render / managed PG
            },
          }
        : {
            ssl: false, // LOCAL Postgres — NO SSL
          },
    });
  }

  return sequelize;
}

export async function initSequelize() {
  const db = getSequelize();
  await db.authenticate();
  console.log("✅ Database connected successfully");
  return db;
}
