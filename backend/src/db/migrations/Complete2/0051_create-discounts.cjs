// 📁 backend/src/migrations/0053_create-discounts.cjs
"use strict";

const { DISCOUNT_TYPE, DISCOUNT_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("discounts", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // 🔹 Tenant Scope
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "organizations", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "facilities", key: "id" },
        onDelete: "SET NULL",
      },

      // 🔹 Invoice linkage
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "invoices", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },
      invoice_item_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "invoice_items", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
      },

      // 🔹 Discount Policy linkage
      discount_policy_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "discount_policies", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
      },

      // 🔹 Discount Info
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM(...DISCOUNT_TYPE),
        allowNull: false,
      },
      value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        comment: "If percentage: 10 = 10%, if fixed: amount in currency",
      },

      status: {
        type: Sequelize.ENUM(...DISCOUNT_STATUS),
        allowNull: false,
        defaultValue: "draft",
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

    // 🔹 Indexes + Unique constraints
    await queryInterface.addConstraint("discounts", {
      fields: ["organization_id", "facility_id", "code"],
      type: "unique",
      name: "uq_discount_code_per_facility",
    });
    await queryInterface.addIndex("discounts", ["organization_id", "facility_id", "status"], {
      name: "idx_discount_scope_status",
    });
    await queryInterface.addIndex("discounts", ["invoice_id", "invoice_item_id"], {
      name: "idx_discount_invoice_links",
    });
    await queryInterface.addIndex("discounts", ["discount_policy_id"], {
      name: "idx_discount_policy",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("discounts");
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_discounts_type";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_discounts_status";`);
  },
};
