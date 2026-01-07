// 📁 migrations/0065_create-prescription_items.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { PRESCRIPTION_ITEM_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("prescription_items", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // References
      prescription_id: { type: DataTypes.UUID, allowNull: false },
      medication_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_item_id: { type: DataTypes.UUID },
      patient_id: { type: DataTypes.UUID },

      // Clinical fields
      dosage: { type: DataTypes.STRING },
      route: { type: DataTypes.STRING },
      duration: { type: DataTypes.STRING },
      quantity: { type: DataTypes.INTEGER },
      instructions: { type: DataTypes.TEXT },
      refill_allowed: { type: DataTypes.BOOLEAN, defaultValue: false },
      refill_count: { type: DataTypes.INTEGER, defaultValue: 0 },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...PRESCRIPTION_ITEM_STATUS),
        allowNull: false,
        defaultValue: PRESCRIPTION_ITEM_STATUS[0], // "draft"
      },
      dispensed_qty: { type: DataTypes.INTEGER, defaultValue: 0 }, // ✅ NEW: supports partial dispensing
      dispensed_at: { type: DataTypes.DATE },
      cancelled_at: { type: DataTypes.DATE },

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
    await queryInterface.addIndex("prescription_items", ["organization_id"]);
    await queryInterface.addIndex("prescription_items", ["facility_id"]);
    await queryInterface.addIndex("prescription_items", ["prescription_id"]);
    await queryInterface.addIndex("prescription_items", ["patient_id"]);
    await queryInterface.addIndex("prescription_items", ["billable_item_id"]);
    await queryInterface.addIndex("prescription_items", ["status"]);

    // Unique constraint: prevent duplicate medications per prescription within tenant
    await queryInterface.addConstraint("prescription_items", {
      fields: ["prescription_id", "billable_item_id", "organization_id", "facility_id"],
      type: "unique",
      name: "unique_prescription_item_per_medication_tenant",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("prescription_items");
  },
};
