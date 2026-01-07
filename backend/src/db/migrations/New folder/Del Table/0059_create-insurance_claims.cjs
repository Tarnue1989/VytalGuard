// 📁 migrations/0054_create-insurance_claims.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { INSURANCE_CLAIM_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("insurance_claims", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      invoice_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },
      provider_id: { type: DataTypes.UUID, allowNull: false },

      // Claim info
      claim_number: { type: DataTypes.STRING(100), allowNull: false },
      amount_claimed: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      amount_approved: { type: DataTypes.DECIMAL(12, 2) },
      claim_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_DATE"),
      },
      response_date: { type: DataTypes.DATEONLY },
      rejection_reason: { type: DataTypes.TEXT },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...INSURANCE_CLAIM_STATUS),
        allowNull: false,
        defaultValue: INSURANCE_CLAIM_STATUS[0], // "submitted"
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
    await queryInterface.addIndex("insurance_claims", ["organization_id"]);
    await queryInterface.addIndex("insurance_claims", ["facility_id"]);
    await queryInterface.addIndex("insurance_claims", ["invoice_id"]);
    await queryInterface.addIndex("insurance_claims", ["patient_id"]);
    await queryInterface.addIndex("insurance_claims", ["provider_id"]);
    await queryInterface.addIndex("insurance_claims", ["claim_number"], { unique: true });
    await queryInterface.addIndex("insurance_claims", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("insurance_claims");
  },
};
