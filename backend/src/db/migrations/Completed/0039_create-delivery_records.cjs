"use strict";

const { DataTypes } = require("sequelize");
const { DELIVERY_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("delivery_records", {
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
      doctor_id: { type: DataTypes.UUID },
      midwife_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID },
      invoice_id: { type: DataTypes.UUID },

      // Delivery info
      delivery_date: { type: DataTypes.DATEONLY, allowNull: false },
      delivery_type: { type: DataTypes.STRING, allowNull: false },
      baby_count: { type: DataTypes.INTEGER },
      delivery_mode: { type: DataTypes.STRING },
      birth_weight: { type: DataTypes.STRING },
      birth_length: { type: DataTypes.STRING },
      newborn_weight: { type: DataTypes.STRING },
      newborn_gender: { type: DataTypes.STRING },
      apgar_score: { type: DataTypes.STRING },
      complications: { type: DataTypes.TEXT },
      notes: { type: DataTypes.TEXT },

      // Lifecycle
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      status: {
        type: DataTypes.ENUM(...DELIVERY_STATUS),
        allowNull: false,
        defaultValue: DELIVERY_STATUS[0], // "scheduled"
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
    await queryInterface.addIndex("delivery_records", ["organization_id"]);
    await queryInterface.addIndex("delivery_records", ["facility_id"]);
    await queryInterface.addIndex("delivery_records", ["patient_id"]);
    await queryInterface.addIndex("delivery_records", ["delivery_date"]);
    await queryInterface.addIndex("delivery_records", ["status"]);
    await queryInterface.addIndex("delivery_records", ["midwife_id"]);
    await queryInterface.addIndex("delivery_records", ["invoice_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("delivery_records");
  },
};
