// 📁 migrations/0068_create-procedure_records.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { PROCEDURE_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("procedure_records", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      performer_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID },

      // Procedure details
      procedure_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
      },
      procedure_type: { type: DataTypes.STRING, allowNull: false }, // e.g., "dialysis", "endoscopy"
      description: { type: DataTypes.TEXT },
      duration_minutes: { type: DataTypes.INTEGER },
      notes: { type: DataTypes.TEXT },
      cost_override: { type: DataTypes.DECIMAL(12, 2) },

      // Lifecycle
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      status: {
        type: DataTypes.ENUM(...PROCEDURE_STATUS),
        allowNull: false,
        defaultValue: PROCEDURE_STATUS[0], // "scheduled"
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
    await queryInterface.addIndex("procedure_records", ["organization_id"]);
    await queryInterface.addIndex("procedure_records", ["facility_id"]);
    await queryInterface.addIndex("procedure_records", ["patient_id"]);
    await queryInterface.addIndex("procedure_records", ["performer_id"]);
    await queryInterface.addIndex("procedure_records", ["procedure_date"]);
    await queryInterface.addIndex("procedure_records", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("procedure_records");
  },
};
