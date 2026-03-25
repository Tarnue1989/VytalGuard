"use strict";

const { DataTypes } = require("sequelize");
const {
  ORDER_STATUS,
  ORDER_TYPE,
  ORDER_PRIORITY,
  ORDER_FULFILLMENT_STATUS,
  ORDER_BILLING_STATUS,
} = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("orders", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Core
      patient_id: { type: DataTypes.UUID, allowNull: false },
      provider_id: { type: DataTypes.UUID },
      consultation_id: { type: DataTypes.UUID },

      type: {
        type: DataTypes.ENUM(...ORDER_TYPE),
        allowNull: false,
        defaultValue: ORDER_TYPE[0],
      },

      priority: {
        type: DataTypes.ENUM(...ORDER_PRIORITY),
        defaultValue: "routine",
      },

      // Billing
      invoice_id: { type: DataTypes.UUID },

      billing_status: {
        type: DataTypes.ENUM(...ORDER_BILLING_STATUS),
        allowNull: false,
        defaultValue: "not_billed",
      },

      // Fulfillment
      fulfillment_status: {
        type: DataTypes.ENUM(...ORDER_FULFILLMENT_STATUS),
        allowNull: false,
        defaultValue: "pending",
      },

      // Date
      order_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...ORDER_STATUS),
        allowNull: false,
        defaultValue: ORDER_STATUS[0],
      },

      status_changed_at: { type: DataTypes.DATE },
      status_changed_by_id: { type: DataTypes.UUID },

      notes: { type: DataTypes.TEXT },

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
    await queryInterface.addIndex("orders", ["organization_id"]);
    await queryInterface.addIndex("orders", ["facility_id"]);
    await queryInterface.addIndex("orders", ["organization_id", "facility_id"]);

    await queryInterface.addIndex("orders", ["patient_id"]);
    await queryInterface.addIndex("orders", ["provider_id"]);
    await queryInterface.addIndex("orders", ["consultation_id"]);

    await queryInterface.addIndex("orders", ["status"]);
    await queryInterface.addIndex("orders", ["type"]);
    await queryInterface.addIndex("orders", ["billing_status"]);
    await queryInterface.addIndex("orders", ["fulfillment_status"]);

    await queryInterface.addIndex("orders", ["facility_id", "status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("orders");

    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_orders_status";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_orders_type";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_orders_priority";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_orders_fulfillment_status";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_orders_billing_status";`);
  },
};