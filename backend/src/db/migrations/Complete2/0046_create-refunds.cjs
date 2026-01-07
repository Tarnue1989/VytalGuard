// 📁 backend/src/migrations/0046_create-refunds.cjs
"use strict";

const { REFUND_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("refunds", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      /* ============================================================
         🔗 Parent Relations
      ============================================================ */
      payment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "payments", key: "id" },
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

      /* ============================================================
         🏢 Tenant Scope
      ============================================================ */
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

      /* ============================================================
         💵 Refund Details
      ============================================================ */
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 🧾 Method copied from payment for reports
      method: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: "Copied from payment.method for reporting consistency",
      },

      status: {
        type: Sequelize.ENUM(...REFUND_STATUS),
        allowNull: false,
        defaultValue: "pending",
      },

      /* ============================================================
         🔹 Lifecycle Audit Fields
      ============================================================ */
      approved_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      approved_at: { type: Sequelize.DATE, allowNull: true },

      rejected_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      rejected_at: { type: Sequelize.DATE, allowNull: true },

      processed_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      processed_at: { type: Sequelize.DATE, allowNull: true },

      cancelled_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      cancelled_at: { type: Sequelize.DATE, allowNull: true },

      /* ============================================================
         🧾 Generic Audit Fields
      ============================================================ */
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

      /* ============================================================
         🕒 Timestamps (Paranoid)
      ============================================================ */
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

    /* ============================================================
       🧱 Indexes
    ============================================================ */
    await queryInterface.addIndex("refunds", ["organization_id"]);
    await queryInterface.addIndex("refunds", ["facility_id"]);
    await queryInterface.addIndex("refunds", ["payment_id"]);
    await queryInterface.addIndex("refunds", ["invoice_id"]);
    await queryInterface.addIndex("refunds", ["patient_id"]);
    await queryInterface.addIndex("refunds", ["status"]);
    await queryInterface.addIndex("refunds", ["method"]); // ✅ Added for summary performance
    await queryInterface.addIndex("refunds", ["approved_by_id"]);
    await queryInterface.addIndex("refunds", ["processed_by_id"]);
    await queryInterface.addIndex("refunds", ["rejected_by_id"]);
    await queryInterface.addIndex("refunds", ["cancelled_by_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("refunds");
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_refunds_status";`);
  },
};
