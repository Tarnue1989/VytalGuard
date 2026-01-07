// 📁 backend/src/migrations/0053_create_discount_waivers.cjs
"use strict";

const { DISCOUNT_TYPE, DISCOUNT_WAIVER_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("discount_waivers", {
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

      // 🔗 Links
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: true, // ✅ optional until applied
        references: { model: "invoices", key: "id" },
        onDelete: "SET NULL",
      },
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" },
        onDelete: "CASCADE",
      },

      // 📌 Discount info
      type: { type: Sequelize.ENUM(...DISCOUNT_TYPE), allowNull: false },
      reason: { type: Sequelize.TEXT, allowNull: false },
      percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },

      // 📊 Waiver tracking (mirrors Deposit)
      applied_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      remaining_balance: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },

      // 📌 Lifecycle
      status: {
        type: Sequelize.ENUM(...DISCOUNT_WAIVER_STATUS),
        allowNull: false,
        defaultValue: DISCOUNT_WAIVER_STATUS[0], // pending
      },

      // 🔹 Lifecycle audit
      approved_by_employee_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "employees", key: "id" },
        onDelete: "SET NULL",
      },
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

      voided_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      voided_at: { type: Sequelize.DATE, allowNull: true },

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
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // 🔹 Indexes
    await queryInterface.addIndex("discount_waivers", ["organization_id"], { name: "idx_discount_waivers_org" });
    await queryInterface.addIndex("discount_waivers", ["facility_id"], { name: "idx_discount_waivers_facility" });
    await queryInterface.addIndex("discount_waivers", ["invoice_id"], { name: "idx_discount_waivers_invoice" });
    await queryInterface.addIndex("discount_waivers", ["patient_id"], { name: "idx_discount_waivers_patient" });
    await queryInterface.addIndex("discount_waivers", ["status"], { name: "idx_discount_waivers_status" });
    await queryInterface.addIndex("discount_waivers", ["approved_by_employee_id"], { name: "idx_discount_waivers_employee" });
    await queryInterface.addIndex("discount_waivers", ["approved_by_id"], { name: "idx_discount_waivers_approved" });
    await queryInterface.addIndex("discount_waivers", ["rejected_by_id"], { name: "idx_discount_waivers_rejected" });
    await queryInterface.addIndex("discount_waivers", ["voided_by_id"], { name: "idx_discount_waivers_voided" });
    await queryInterface.addIndex("discount_waivers", ["deleted_at"], { name: "idx_discount_waivers_deleted" });
    await queryInterface.addIndex("discount_waivers", ["created_at"], { name: "idx_discount_waivers_created" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("discount_waivers");
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_discount_waivers_type";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_discount_waivers_status";`);
  },
};
