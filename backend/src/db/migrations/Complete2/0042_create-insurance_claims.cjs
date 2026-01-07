// 📁 backend/src/migrations/0042_create-insurance_claims.cjs
"use strict";

const { INSURANCE_CLAIM_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("insurance_claims", {
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
        references: { model: "organizations", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "facilities", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },

      // 🔗 Links
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "invoices", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },
      provider_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "insurance_providers", key: "id" },
        onDelete: "CASCADE",
      },

      // 📌 Claim info
      claim_number: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      amount_claimed: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      amount_approved: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      claim_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_DATE"),
      },
      response_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 📌 Lifecycle
      status: {
        type: Sequelize.ENUM(...INSURANCE_CLAIM_STATUS),
        allowNull: false,
        defaultValue: "submitted",
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
    await queryInterface.addConstraint("insurance_claims", {
      fields: ["claim_number"],
      type: "unique",
      name: "uq_insurance_claim_number",
    });
    await queryInterface.addIndex("insurance_claims", ["organization_id"]);
    await queryInterface.addIndex("insurance_claims", ["facility_id"]);
    await queryInterface.addIndex("insurance_claims", ["invoice_id"]);
    await queryInterface.addIndex("insurance_claims", ["patient_id"]);
    await queryInterface.addIndex("insurance_claims", ["provider_id"]);
    await queryInterface.addIndex("insurance_claims", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("insurance_claims");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_insurance_claims_status";`
    );
  },
};
