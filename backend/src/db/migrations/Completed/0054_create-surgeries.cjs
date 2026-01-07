// 📁 migrations/0067_create-surgeries.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { SURGERY_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("surgeries", {
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
      surgeon_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID },

      // Surgery info
      scheduled_date: { type: DataTypes.DATEONLY, allowNull: false },
      surgery_type: { type: DataTypes.STRING },
      duration_minutes: { type: DataTypes.INTEGER },
      anesthesia_type: { type: DataTypes.STRING },
      complications: { type: DataTypes.TEXT },
      notes: { type: DataTypes.TEXT },
      cost_override: { type: DataTypes.DECIMAL(12, 2) },
      document_url: { type: DataTypes.STRING },

      // Lifecycle
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      status: {
        type: DataTypes.ENUM(...SURGERY_STATUS),
        allowNull: false,
        defaultValue: SURGERY_STATUS[0], // "scheduled"
      },

      // Workflow tracking
      finalized_at: { type: DataTypes.DATE },
      finalized_by_id: { type: DataTypes.UUID },
      verified_by_id: { type: DataTypes.UUID },
      verified_at: { type: DataTypes.DATE },
      voided_by_id: { type: DataTypes.UUID },
      voided_at: { type: DataTypes.DATE },

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
    await queryInterface.addIndex("surgeries", ["organization_id"]);
    await queryInterface.addIndex("surgeries", ["facility_id"]);
    await queryInterface.addIndex("surgeries", ["patient_id"]);
    await queryInterface.addIndex("surgeries", ["scheduled_date"]);
    await queryInterface.addIndex("surgeries", ["status"]);
    await queryInterface.addIndex("surgeries", ["surgeon_id"]);
    await queryInterface.addIndex("surgeries", ["invoice_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("surgeries");
  },
};
