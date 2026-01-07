// 📁 migrations/0064_create-prescriptions.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { PRESCRIPTION_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("prescriptions", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      consultation_id: { type: DataTypes.UUID },
      registration_log_id: { type: DataTypes.UUID },
      patient_id: { type: DataTypes.UUID, allowNull: false },
      doctor_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID },
      invoice_id: { type: DataTypes.UUID },

      // Flags
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      notes: { type: DataTypes.TEXT },
      prescription_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...PRESCRIPTION_STATUS),
        allowNull: false,
        defaultValue: PRESCRIPTION_STATUS[0], // "draft"
      },

      // Lifecycle timestamps
      issued_at: { type: DataTypes.DATE },
      dispensed_at: { type: DataTypes.DATE },
      completed_at: { type: DataTypes.DATE },

      // Fulfillment tracking
      fulfilled_by_id: { type: DataTypes.UUID }, // ✅ renamed to match model
      fulfilled_at: { type: DataTypes.DATE },

      // Billing
      billed: { type: DataTypes.BOOLEAN, defaultValue: false },

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
    await queryInterface.addIndex("prescriptions", ["organization_id"]);
    await queryInterface.addIndex("prescriptions", ["facility_id"]);
    await queryInterface.addIndex("prescriptions", ["patient_id"]);
    await queryInterface.addIndex("prescriptions", ["doctor_id"]);
    await queryInterface.addIndex("prescriptions", ["registration_log_id"]);
    await queryInterface.addIndex("prescriptions", ["invoice_id"]);
    await queryInterface.addIndex("prescriptions", ["status"]);
    await queryInterface.addIndex("prescriptions", ["organization_id", "facility_id", "status"]); // ✅ composite
  },

  async down(queryInterface) {
    await queryInterface.dropTable("prescriptions");
  },
};
