"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("cash_closing", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      account_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      opening_balance: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
      },

      closing_balance: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
      },

      total_in: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
      },

      total_out: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
      },

      is_locked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      facility_id: Sequelize.UUID,

      closed_by_id: Sequelize.UUID,
      closed_at: Sequelize.DATE,

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
    await queryInterface.dropTable("cash_closing");
  },
};