"use strict";

const { REFUND_TRANSACTION_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("refund_transactions", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // 🔗 Parents
      refund_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "refunds", key: "id" },
        onDelete: "CASCADE",
      },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "invoices", key: "id" },
        onDelete: "CASCADE",
      },
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" },
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

      // 💵 Transaction details
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      method: { type: Sequelize.STRING },
      note: { type: Sequelize.TEXT },

      // 🔖 Lifecycle status
      status: {
        type: Sequelize.ENUM(...REFUND_TRANSACTION_STATUS),
        allowNull: false,
        defaultValue: REFUND_TRANSACTION_STATUS[0], // "pending"
      },

      approved_by_id: {
        type: Sequelize.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      approved_at: { type: Sequelize.DATE },

      rejected_by_id: {
        type: Sequelize.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      rejected_at: { type: Sequelize.DATE },
      reject_reason: { type: Sequelize.TEXT },

      processed_by_id: {
        type: Sequelize.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      processed_at: { type: Sequelize.DATE },

      cancelled_by_id: {
        type: Sequelize.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      cancelled_at: { type: Sequelize.DATE },

      reversed_by_id: {
        type: Sequelize.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      reversed_at: { type: Sequelize.DATE },

      // 🔹 Generic audit
      created_by_id: {
        type: Sequelize.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      updated_by_id: {
        type: Sequelize.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      deleted_by_id: {
        type: Sequelize.UUID,
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
      deleted_at: { type: Sequelize.DATE },
    });

    // 🔹 Indexes
    await queryInterface.addIndex("refund_transactions", ["refund_id"]);
    await queryInterface.addIndex("refund_transactions", ["invoice_id"]);
    await queryInterface.addIndex("refund_transactions", ["patient_id"]);
    await queryInterface.addIndex("refund_transactions", ["organization_id"]);
    await queryInterface.addIndex("refund_transactions", ["facility_id"]);
    await queryInterface.addIndex("refund_transactions", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("refund_transactions");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_refund_transactions_status";`
    );
  },
};
