"use strict";

const { DataTypes } = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("refund_deposits", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Links
      deposit_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 💵 Refund info
      refund_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      method: { type: DataTypes.STRING },
      reason: { type: DataTypes.TEXT },

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
    await queryInterface.addIndex("refund_deposits", ["deposit_id"]);
    await queryInterface.addIndex("refund_deposits", ["patient_id"]);
    await queryInterface.addIndex("refund_deposits", ["organization_id"]);
    await queryInterface.addIndex("refund_deposits", ["facility_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("refund_deposits");
  },
};
