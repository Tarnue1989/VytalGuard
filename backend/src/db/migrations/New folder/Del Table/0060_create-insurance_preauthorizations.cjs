// 📁 migrations/0055_create-insurance_preauthorizations.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { INSURANCE_PREAUTH_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("insurance_preauthorizations", {
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
      provider_id: { type: DataTypes.UUID, allowNull: false },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID },
      consultation_id: { type: DataTypes.UUID },

      // PreAuth details
      preauth_number: { type: DataTypes.STRING(100), allowNull: false },
      request_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_DATE"),
      },
      response_date: { type: DataTypes.DATEONLY },
      amount_requested: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      amount_approved: { type: DataTypes.DECIMAL(12, 2) },
      validity_date: { type: DataTypes.DATEONLY },
      notes: { type: DataTypes.TEXT },
      rejection_reason: { type: DataTypes.TEXT },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...INSURANCE_PREAUTH_STATUS),
        allowNull: false,
        defaultValue: INSURANCE_PREAUTH_STATUS[0], // "pending"
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
    await queryInterface.addIndex("insurance_preauthorizations", ["organization_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["facility_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["patient_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["provider_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["billable_item_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["invoice_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["status"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["preauth_number"], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("insurance_preauthorizations");
  },
};
