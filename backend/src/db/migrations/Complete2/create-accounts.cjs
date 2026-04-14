"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("accounts", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      type: {
        type: Sequelize.ENUM("cash", "bank", "mobile_money", "other"),
        allowNull: false,
      },

      currency: {
        type: Sequelize.ENUM("USD", "LRD"),
        allowNull: false,
      },

      balance: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },

      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      facility_id: {
        type: Sequelize.UUID,
      },

      created_by_id: Sequelize.UUID,
      updated_by_id: Sequelize.UUID,
      deleted_by_id: Sequelize.UUID,

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },

      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },

      deleted_at: {
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("accounts");
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_accounts_type\";");
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_accounts_currency\";");
  },
};