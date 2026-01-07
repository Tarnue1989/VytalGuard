"use strict";

const { DataTypes } = require("sequelize");
const {
  PHARMACY_TRANSACTION_STATUS,
  PHARMACY_TRANSACTION_TYPE, // centralized enum
} = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("pharmacy_transactions", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Core references
      patient_id: { type: DataTypes.UUID },
      prescription_id: { type: DataTypes.UUID },
      prescription_item_id: { type: DataTypes.UUID },
      registration_log_id: { type: DataTypes.UUID },
      consultation_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },
      doctor_id: { type: DataTypes.UUID }, // ✅ prescriber at transaction level
      invoice_item_id: { type: DataTypes.UUID }, // ✅ billing linkage
      department_stock_id: { type: DataTypes.UUID, allowNull: false }, // ✅ switched from central_stock_id

      // Quantities
      quantity_dispensed: { type: DataTypes.INTEGER, allowNull: false },

      // Transaction type
      type: {
        type: DataTypes.ENUM(...PHARMACY_TRANSACTION_TYPE),
        allowNull: false,
      },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...PHARMACY_TRANSACTION_STATUS),
        allowNull: false,
        defaultValue: PHARMACY_TRANSACTION_STATUS[0], // "pending"
      },

      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      notes: { type: DataTypes.TEXT },

      // Fulfillment
      fulfilled_by_id: { type: DataTypes.UUID },
      fulfillment_date: { type: DataTypes.DATE },

      // Voiding
      void_reason: { type: DataTypes.STRING },
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
    await queryInterface.addIndex("pharmacy_transactions", ["organization_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["facility_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["patient_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["prescription_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["prescription_item_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["registration_log_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["consultation_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["department_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["doctor_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["invoice_item_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["department_stock_id"]); // ✅ updated
    await queryInterface.addIndex("pharmacy_transactions", ["fulfilled_by_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["voided_by_id"]);
    await queryInterface.addIndex("pharmacy_transactions", ["status"]);
    await queryInterface.addIndex("pharmacy_transactions", ["type"]);

    // 🔒 Optional: prevent duplicate transactions of same type/item/time
    await queryInterface.addConstraint("pharmacy_transactions", {
      fields: ["prescription_item_id", "type", "fulfillment_date"],
      type: "unique",
      name: "unique_transaction_per_item_type_time",
    });
  },

  async down(queryInterface) {
    // Drop ENUMs explicitly to avoid residue in Postgres
    await queryInterface.dropTable("pharmacy_transactions");
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_pharmacy_transactions_type";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_pharmacy_transactions_status";`);
  },
};
