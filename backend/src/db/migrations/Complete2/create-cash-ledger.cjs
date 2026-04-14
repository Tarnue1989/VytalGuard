"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("cash_ledger", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      type: {
        type: Sequelize.ENUM("collection", "expense", "transfer", "adjustment"),
        allowNull: false,
      },

      direction: {
        type: Sequelize.ENUM("in", "out"),
        allowNull: false,
      },

      account_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      from_account_id: Sequelize.UUID,
      to_account_id: Sequelize.UUID,

      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },

      currency: {
        type: Sequelize.ENUM("USD", "LRD"),
        allowNull: false,
      },

      reference_type: {
        type: Sequelize.ENUM(
          "payment",
          "deposit",
          "expense",
          "refund",
          "refund_deposit",
          "transfer",
          "adjustment"
        ),
      },

      reference_id: Sequelize.UUID,

      reversal_of_id: Sequelize.UUID,

      description: Sequelize.TEXT,

      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      facility_id: Sequelize.UUID,

      created_by_id: Sequelize.UUID,

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },

      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },

      deleted_at: Sequelize.DATE,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("cash_ledger");
  },
};