// 📁 backend/src/migrations/0052_create-invoice_items.cjs
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("invoice_items", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // 🔗 Parent
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "invoices", key: "id" },
        onDelete: "CASCADE",
      },
      billable_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "billable_items", key: "id" },
        onDelete: "CASCADE",
      },

      // 🔗 Tenant scope
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "facilities", key: "id" },
        onDelete: "CASCADE",
      },

      // 🔗 Applied Discount/Tax
      discount_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "discounts", key: "id" },
        onDelete: "SET NULL",
      },
      tax_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "taxes", key: "id" },
        onDelete: "SET NULL",
      },

      // 🔗 Policies
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

      // 📑 Item details
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      unit_price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      // 🔹 Financial adjustments
      discount_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      tax_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      total_price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      net_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 🔑 Tracking (for auto-billing + rollback)
      module: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      entity_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("applied", "voided"),
        allowNull: false,
        defaultValue: "applied",
      },

      // 🔹 Audit
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      deleted_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
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
    await queryInterface.addIndex("invoice_items", ["organization_id"]);
    await queryInterface.addIndex("invoice_items", ["facility_id"]);
    await queryInterface.addIndex("invoice_items", ["invoice_id"]);
    await queryInterface.addIndex("invoice_items", ["billable_item_id"]);
    await queryInterface.addIndex("invoice_items", ["discount_id"]);
    await queryInterface.addIndex("invoice_items", ["tax_id"]);
    await queryInterface.addIndex("invoice_items", ["discount_policy_id"]);
    await queryInterface.addIndex("invoice_items", ["tax_policy_id"]);
    await queryInterface.addIndex("invoice_items", ["created_by_id"]);
    await queryInterface.addIndex("invoice_items", ["module"]);
    await queryInterface.addIndex("invoice_items", ["entity_id"]);
    await queryInterface.addIndex("invoice_items", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("invoice_items");
  },
};
