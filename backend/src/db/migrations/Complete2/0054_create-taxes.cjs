// 📁 backend/src/migrations/0054_create-taxes.cjs
"use strict";

const { TAX_TYPE, TAX_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("taxes", {
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
        references: { model: "facilities", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
      },

      // 🔹 Tax Info
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM(...TAX_TYPE),
        allowNull: false,
      },
      rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },

      status: {
        type: Sequelize.ENUM(...TAX_STATUS),
        allowNull: false,
        defaultValue: "active",
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

    // 🔹 Indexes + Constraints
    await queryInterface.addConstraint("taxes", {
      fields: ["organization_id", "facility_id", "code"],
      type: "unique",
      name: "uq_tax_code_per_facility",
    });

    await queryInterface.addIndex("taxes", ["organization_id", "facility_id", "status"], {
      name: "idx_tax_scope_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("taxes");

    // Drop ENUMs explicitly
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_taxes_type";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_taxes_status";`
    );
  },
};
