// 📁 backend/src/migrations/0039_create-tax_policies.cjs
"use strict";

const {
  POLICY_APPLIES_TO,
  POLICY_STATUS,
} = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("tax_policies", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // 📌 Identification
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 📌 Linked tax
      tax_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "taxes", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },

      // 📌 Applicability
      applies_to: {
        type: Sequelize.ENUM(...POLICY_APPLIES_TO),
        defaultValue: "all",
      },
      condition_json: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Custom conditions (e.g. { patientType: 'private', ward: 'maternity' })",
      },

      // 📌 Validity
      effective_from: { type: Sequelize.DATE },
      effective_to: { type: Sequelize.DATE },

      // 📌 Status
      status: {
        type: Sequelize.ENUM(...POLICY_STATUS),
        allowNull: false,
        defaultValue: "active",
      },

      // 🔹 Tenant Scope
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "organizations", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "facilities", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
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
    await queryInterface.addConstraint("tax_policies", {
      fields: ["code"],
      type: "unique",
      name: "uq_tax_policy_code",
    });
    await queryInterface.addIndex("tax_policies", ["organization_id"]);
    await queryInterface.addIndex("tax_policies", ["facility_id"]);
    await queryInterface.addIndex("tax_policies", ["status"]);
    await queryInterface.addIndex("tax_policies", ["tax_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("tax_policies");

    // Drop enums explicitly
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_tax_policies_applies_to";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_tax_policies_status";`
    );
  },
};
