'use strict';

const { ORG_STATUS } = require('../../constants/enums.js'); // adjust path if needed

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('organizations', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM(...ORG_STATUS),
        allowNull: false,
        defaultValue: ORG_STATUS[0], // first value in enum file
      },

      // Audit fields
      created_by_id: { type: Sequelize.UUID, allowNull: true },
      updated_by_id: { type: Sequelize.UUID, allowNull: true },
      deleted_by_id: { type: Sequelize.UUID, allowNull: true },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Indexes
    await queryInterface.addIndex('organizations', ['name']);
    await queryInterface.addIndex('organizations', ['code']);
    await queryInterface.addIndex('organizations', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('organizations');

    // Cleanup ENUM in Postgres
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_organizations_status";');
    }
  },
};
