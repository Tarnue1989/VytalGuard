import { Sequelize } from "sequelize";

let sequelize;

export function getSequelize() {
  if (!sequelize) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");

    sequelize = new Sequelize(url, {
      dialect: "postgres",
      logging: process.env.SQL_LOG === "true" ? console.log : false,
      define: { freezeTableName: true },

      // ✅ REQUIRED FOR RENDER POSTGRES
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
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
