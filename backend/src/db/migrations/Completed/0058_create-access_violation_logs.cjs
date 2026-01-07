// 📁 migrations/0045_create-access_violation_logs.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { ACCESS_VIOLATION_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("access_violation_logs", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: true },
      facility_id: { type: DataTypes.UUID, allowNull: true },

      // Core details
      user_id: { type: DataTypes.UUID },
      action: { type: DataTypes.STRING, allowNull: false }, // e.g., "unauthorized access"
      reason: { type: DataTypes.STRING },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...ACCESS_VIOLATION_STATUS),
        allowNull: false,
        defaultValue: ACCESS_VIOLATION_STATUS[0], // "logged"
      },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },

      // Sequelize timestamps
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
      },
      deleted_at: { type: DataTypes.DATE },
    });

    // Indexes
    await queryInterface.addIndex("access_violation_logs", ["organization_id"]);
    await queryInterface.addIndex("access_violation_logs", ["facility_id"]);
    await queryInterface.addIndex("access_violation_logs", ["user_id"]);
    await queryInterface.addIndex("access_violation_logs", ["action"]);
    await queryInterface.addIndex("access_violation_logs", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("access_violation_logs");
  },
};
