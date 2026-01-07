// 📁 backend/src/db/migrations/0035_create-plans.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { PLAN_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('plans', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🏷️ Core
      name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

      // 📌 Status
      status: {
        type: DataTypes.ENUM(...PLAN_STATUS),
        allowNull: false,
        defaultValue: PLAN_STATUS[0], // "active"
      },

      // 🔹 Audit
      created_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      updated_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      deleted_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 🕒 Timestamps (paranoid)
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // 🔎 Indexes
    await queryInterface.addIndex('plans', ['status']);
    // name has a unique constraint on the column definition
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plans');
    // Optional Postgres cleanup:
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_plans_status";');
  },
};
