import { Sequelize } from 'sequelize';

let sequelize;

/**
 * Initializes a single Sequelize instance using DATABASE_URL.
 * We still use raw SQL migrations; Sequelize is for connectivity and future models.
 */
export function getSequelize() {
  if (!sequelize) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    sequelize = new Sequelize(url, {
      dialect: 'postgres',
      logging: process.env.SQL_LOG === 'true' ? console.log : false,
      define: { freezeTableName: true }
    });
  }
  return sequelize;
}

export async function initSequelize() {
  const db = getSequelize();
  await db.authenticate();
  return db;
}
