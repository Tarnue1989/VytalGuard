// 📁 migrations/0051_create-deposits.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { DEPOSIT_STATUS, PAYMENT_METHODS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("deposits", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      applied_invoice_id: { type: DataTypes.UUID },

      // 💵 Deposit info
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      applied_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      remaining_balance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
      transaction_ref: { type: DataTypes.STRING },

      // 📌 Lifecycle
      status: {
        type: DataTypes.ENUM(...DEPOSIT_STATUS),
        allowNull: false,
        defaultValue: DEPOSIT_STATUS[0],
      },
      notes: { type: DataTypes.TEXT },

      // 🔹 Audit
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
    await queryInterface.addIndex("deposits", ["patient_id"]);
    await queryInterface.addIndex("deposits", ["organization_id"]);
    await queryInterface.addIndex("deposits", ["facility_id"]);
    await queryInterface.addIndex("deposits", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("deposits");
  },
};
