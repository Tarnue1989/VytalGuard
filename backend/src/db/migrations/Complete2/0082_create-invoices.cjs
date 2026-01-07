"use strict";

const { INVOICE_STATUS, PAYER_TYPES } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("invoices", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // 🔗 Links
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" },
        onDelete: "CASCADE",
      },
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "facilities", key: "id" },
        onDelete: "SET NULL",
      },

      // 📑 Invoice info
      invoice_number: { type: Sequelize.STRING, allowNull: false, unique: true },
      invoice_date: { type: Sequelize.DATEONLY, allowNull: false, defaultValue: Sequelize.literal("CURRENT_DATE") },
      module: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.ENUM(...INVOICE_STATUS), allowNull: false, defaultValue: "draft" },
      currency: { type: Sequelize.STRING, allowNull: false, defaultValue: "LRD" },
      due_date: { type: Sequelize.DATEONLY, allowNull: true },
      is_locked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

      // 💵 Aggregates
      subtotal: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },       // ✅ NEW
      total_tax: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_discount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_paid: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      refunded_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      applied_deposits: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      balance: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      // 🏥 Insurance & Payer
      payer_type: { type: Sequelize.ENUM(...PAYER_TYPES), allowNull: false, defaultValue: "cash" },
      insurance_provider_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "insurance_providers", key: "id" },
        onDelete: "SET NULL",
      },
      insurance_claim_id: { type: Sequelize.UUID, allowNull: true },
      coverage_amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      // 📌 Lifecycle
      void_reason: { type: Sequelize.TEXT, allowNull: true },
      cancel_reason: { type: Sequelize.TEXT, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
      updated_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
      deleted_by_id: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },

      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      deleted_at: { allowNull: true, type: Sequelize.DATE },
    });

    // 🔹 Indexes
    await queryInterface.addIndex("invoices", ["patient_id"]);
    await queryInterface.addIndex("invoices", ["organization_id"]);
    await queryInterface.addIndex("invoices", ["facility_id"]);
    await queryInterface.addIndex("invoices", ["status"]);
    await queryInterface.addIndex("invoices", ["payer_type"]);
    await queryInterface.addIndex("invoices", ["invoice_number"], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("invoices");
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_invoices_status";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_invoices_payer_type";`);
  },
};
