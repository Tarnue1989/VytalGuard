"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("expenses", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },

      currency: {
        type: Sequelize.ENUM("USD", "LRD"),
        allowNull: false,
      },

      category: {
        type: Sequelize.ENUM(
          "drugs",
          "supplies",
          "fuel",
          "utilities",
          "salary",
          "maintenance",
          "rent",
          "transport",
          "other"
        ),
        allowNull: false,
      },

      description: Sequelize.TEXT,

      account_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      ledger_id: Sequelize.UUID,

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
    await queryInterface.dropTable("expenses");
  },
};