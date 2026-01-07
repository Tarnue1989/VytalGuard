// 📁 backend/src/migrations/005X_create_deposit_applications.cjs
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("deposit_applications", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      deposit_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "deposits", key: "id" },
        onDelete: "CASCADE",
      },

      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "invoices", key: "id" },
        onDelete: "CASCADE",
      },

      applied_amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      applied_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },

      applied_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },

      // ✅ Reversal tracking
      reversed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      reversed_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },

      // 🔹 Audit fields
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Indexes
    await queryInterface.addIndex("deposit_applications", ["deposit_id"]);
    await queryInterface.addIndex("deposit_applications", ["invoice_id"]);
    await queryInterface.addIndex("deposit_applications", ["applied_by_id"]);
    await queryInterface.addIndex("deposit_applications", ["reversed_by_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("deposit_applications");
  },
};
