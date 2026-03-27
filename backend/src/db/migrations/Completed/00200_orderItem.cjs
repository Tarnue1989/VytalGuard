"use strict";

const { DataTypes } = require("sequelize");
const {
  ORDER_ITEM_STATUS,
  ORDER_BILLING_STATUS,
} = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("order_items", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Core
      order_id: { type: DataTypes.UUID, allowNull: false },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_item_id: { type: DataTypes.UUID },

      // Pricing snapshot
      quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
      unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      total_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },

      // Prescription support
      dosage: { type: DataTypes.STRING },
      frequency: { type: DataTypes.STRING },
      duration: { type: DataTypes.STRING },
      instructions: { type: DataTypes.TEXT },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...ORDER_ITEM_STATUS),
        allowNull: false,
        defaultValue: ORDER_ITEM_STATUS[0],
      },

      // Billing
      billing_status: {
        type: DataTypes.ENUM(...ORDER_BILLING_STATUS),
        allowNull: false,
        defaultValue: "not_billed",
      },

      notes: { type: DataTypes.TEXT },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },

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
    await queryInterface.addIndex("order_items", ["organization_id"]);
    await queryInterface.addIndex("order_items", ["facility_id"]);
    await queryInterface.addIndex("order_items", ["organization_id", "facility_id"]);

    await queryInterface.addIndex("order_items", ["order_id"]);
    await queryInterface.addIndex("order_items", ["billable_item_id"]);
    await queryInterface.addIndex("order_items", ["invoice_item_id"]);

    await queryInterface.addIndex("order_items", ["status"]);
    await queryInterface.addIndex("order_items", ["billing_status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("order_items");

    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_order_items_status";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_order_items_billing_status";`);
  },
};