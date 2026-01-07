"use strict";

const { DataTypes } = require("sequelize");
const { SYSTEM_AUDIT_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("system_audit_logs", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Core action
      table_name: { type: DataTypes.STRING, allowNull: false },
      record_id: { type: DataTypes.UUID },
      action: { type: DataTypes.STRING, allowNull: false }, // e.g., "INSERT", "UPDATE", "DELETE"
      changes: { type: DataTypes.JSON },

      // Request context (🔐 added for compliance/security)
      ip_address: { type: DataTypes.STRING },
      user_agent: { type: DataTypes.STRING },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...SYSTEM_AUDIT_STATUS),
        allowNull: false,
        defaultValue: SYSTEM_AUDIT_STATUS[0], // "logged"
      },

      // Audit users
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
    await queryInterface.addIndex("system_audit_logs", ["organization_id"]);
    await queryInterface.addIndex("system_audit_logs", ["facility_id"]);
    await queryInterface.addIndex("system_audit_logs", ["table_name"]);
    await queryInterface.addIndex("system_audit_logs", ["record_id"]);
    await queryInterface.addIndex("system_audit_logs", ["action"]);
    await queryInterface.addIndex("system_audit_logs", ["status"]);
    await queryInterface.addIndex("system_audit_logs", ["ip_address"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("system_audit_logs");
  },
};
