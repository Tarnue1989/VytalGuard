'use strict';

const { ROLE_TYPE, ROLE_STATUS } = require('../../constants/enums.js');

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {typeof import('sequelize')} Sequelize
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      // 🔹 Scope fields (align with Department)
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'facilities', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      name: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      role_type: {
        type: Sequelize.ENUM(...ROLE_TYPE), // ['system','custom']
        allowNull: false,
        defaultValue: ROLE_TYPE[1] || 'custom', // default to 'custom'
      },

      // ✅ NEW: determines if this role must always be tied to a facility
      requires_facility: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      status: {
        type: Sequelize.ENUM(...ROLE_STATUS), // ['active','inactive']
        allowNull: false,
        defaultValue: ROLE_STATUS[0], // usually 'active'
      },

      created_by_id: { type: Sequelize.UUID, allowNull: true },
      updated_by_id: { type: Sequelize.UUID, allowNull: true },
      deleted_by_id: { type: Sequelize.UUID, allowNull: true },

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
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // Indexes
    await queryInterface.addIndex('roles', ['name'], {
      name: 'ix_roles_name',
      unique: true,
    });
    await queryInterface.addIndex('roles', ['code']);
    await queryInterface.addIndex('roles', ['role_type']);
    await queryInterface.addIndex('roles', ['status']);
    await queryInterface.addIndex('roles', ['facility_id']);
    await queryInterface.addIndex('roles', ['organization_id']);
    await queryInterface.addIndex('roles', ['requires_facility']); // ✅ NEW index
  },

  async down(queryInterface) {
    await queryInterface.dropTable('roles');

    // Cleanup ENUM types in Postgres
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_roles_role_type";'
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_roles_status";'
      );
    }
  },
};
