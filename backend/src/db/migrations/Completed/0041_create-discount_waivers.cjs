// 📁 migrations/0052_create-discount_waivers.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { DISCOUNT_WAIVER_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("discount_waivers", {
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

      // Discount info
      type: { type: DataTypes.ENUM("discount", "waiver"), allowNull: false }, // discount = partial, waiver = full
      reason: { type: DataTypes.TEXT, allowNull: false },
      percentage: { type: DataTypes.DECIMAL(5, 2) },
      amount: { type: DataTypes.DECIMAL(12, 2) },
      applied_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...DISCOUNT_WAIVER_STATUS),
        allowNull: false,
        defaultValue: DISCOUNT_WAIVER_STATUS[0], // "pending"
      },

      approved_by_employee_id: { type: DataTypes.UUID },
      approved_at: { type: DataTypes.DATE },

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
    await queryInterface.addIndex("discount_waivers", ["organization_id"]);
    await queryInterface.addIndex("discount_waivers", ["facility_id"]);
    await queryInterface.addIndex("discount_waivers", ["invoice_id"]);
    await queryInterface.addIndex("discount_waivers", ["patient_id"]);
    await queryInterface.addIndex("discount_waivers", ["status"]);
    await queryInterface.addIndex("discount_waivers", ["approved_by_employee_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("discount_waivers");
  },
};
