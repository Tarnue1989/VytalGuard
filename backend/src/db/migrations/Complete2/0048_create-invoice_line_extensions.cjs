// 📁 backend/src/migrations/0038_create-invoice_line_extensions.cjs
"use strict";

const {
  INVOICE_LINE_EXTENSION_STATUS,
  DISCOUNT_TYPE,
} = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("invoice_line_extensions", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // 🔗 Link back to invoice item
      invoice_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "invoice_items", key: "id" },
        onDelete: "CASCADE",
      },

      // 🔗 Relations (nullable, optional)
      discount_waiver_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "discount_waivers", key: "id" },
        onDelete: "SET NULL",
      },
      discount_policy_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "discount_policies", key: "id" },
        onDelete: "SET NULL",
      },
      tax_policy_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "tax_policies", key: "id" },
        onDelete: "SET NULL",
      },

      // 🔹 Discount info (audit only)
      discount_type: {
        type: Sequelize.ENUM(...DISCOUNT_TYPE),
        allowNull: true,
      },
      discount_value: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      discount_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },

      // 🔹 Tax info (audit only)
      tax_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      tax_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },

      // 🔹 Status
      status: {
        type: Sequelize.ENUM(...INVOICE_LINE_EXTENSION_STATUS),
        allowNull: false,
        defaultValue: "applied",
      },

      // 🔹 Audit
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
      },
      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
      },
      deleted_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
      },

      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      deleted_at: {
        allowNull: true,
        type: Sequelize.DATE,
      },
    });

    // 🔹 Indexes
    await queryInterface.addIndex("invoice_line_extensions", ["invoice_item_id"]);
    await queryInterface.addIndex("invoice_line_extensions", ["discount_policy_id"]);
    await queryInterface.addIndex("invoice_line_extensions", ["discount_waiver_id"]);
    await queryInterface.addIndex("invoice_line_extensions", ["tax_policy_id"]);
    await queryInterface.addIndex("invoice_line_extensions", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("invoice_line_extensions");

    // Drop ENUMs explicitly
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_invoice_line_extensions_discount_type";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_invoice_line_extensions_status";`
    );
  },
};
