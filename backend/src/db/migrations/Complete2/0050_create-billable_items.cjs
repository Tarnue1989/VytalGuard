// 📁 backend/src/migrations/0050_create-billable_items.cjs
"use strict";

const { BILLABLE_ITEM_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("billable_items", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
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

      // 🔗 Master link
      master_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "master_items", key: "id" },
        onDelete: "CASCADE",
      },

      // 📑 Department override (optional)
      department_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "departments", key: "id" },
        onDelete: "SET NULL",
      },

      // 📑 Category override (FK instead of string)
      category_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "master_item_categories", key: "id" },
        onDelete: "SET NULL",
      },

      // 📑 Item details
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(100), // ✅ added to align with model/controller
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 💵 Pricing
      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: "USD",
      },
      taxable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      discountable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      override_allowed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      // 📌 Lifecycle
      status: {
        type: Sequelize.ENUM(...BILLABLE_ITEM_STATUS),
        allowNull: false,
        defaultValue: BILLABLE_ITEM_STATUS[0],
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

    // 🔹 Indexes & Constraints
    await queryInterface.addConstraint("billable_items", {
      fields: ["organization_id", "facility_id", "master_item_id"],
      type: "unique",
      name: "uq_billableitem_per_scope",
    });
    await queryInterface.addIndex("billable_items", ["organization_id"]);
    await queryInterface.addIndex("billable_items", ["facility_id"]);
    await queryInterface.addIndex("billable_items", ["status"]);
    await queryInterface.addIndex("billable_items", ["name"]);
    await queryInterface.addIndex("billable_items", ["code"]);       // ✅ new index for code
    await queryInterface.addIndex("billable_items", ["category_id"]); // ✅ category search
  },

  async down(queryInterface) {
    await queryInterface.dropTable("billable_items");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_billable_items_status";`
    );
  },
};
