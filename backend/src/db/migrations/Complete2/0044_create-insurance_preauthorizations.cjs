// 📁 backend/src/migrations/0044_create-insurance_preauthorizations.cjs
"use strict";

const { INSURANCE_PREAUTH_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("insurance_preauthorizations", {
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
      billable_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "billable_items", key: "id" },
        onDelete: "CASCADE",
      },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "invoices", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
      },
      consultation_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "consultations", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
      },

      // 📌 PreAuth details
      preauth_number: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      request_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_DATE"),
      },
      response_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      amount_requested: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      amount_approved: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },
      validity_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 📌 Lifecycle
      status: {
        type: Sequelize.ENUM(...INSURANCE_PREAUTH_STATUS),
        allowNull: false,
        defaultValue: "pending",
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
    await queryInterface.addConstraint("insurance_preauthorizations", {
      fields: ["preauth_number"],
      type: "unique",
      name: "uq_insurance_preauth_number",
    });
    await queryInterface.addIndex("insurance_preauthorizations", ["organization_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["facility_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["patient_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["provider_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["billable_item_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["invoice_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["consultation_id"]);
    await queryInterface.addIndex("insurance_preauthorizations", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("insurance_preauthorizations");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_insurance_preauthorizations_status";`
    );
  },
};
