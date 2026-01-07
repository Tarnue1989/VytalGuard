'use strict';

const { USER_FACILITY_STATUS } = require('../../constants/enums.js');

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {typeof import('sequelize')} Sequelize
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_facilities', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 🔹 Org-level assignment (Org Owner)
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 🔹 Facility-level assignment (Admins, Managers, Staff, etc.)
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'facilities', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      role_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'roles', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      is_active: {
        type: Sequelize.ENUM(...USER_FACILITY_STATUS),
        allowNull: false,
        defaultValue: 'active',
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
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // 🔹 Uniqueness: a user cannot have duplicate links at the same level
    await queryInterface.addConstraint('user_facilities', {
      fields: ['user_id', 'organization_id', 'facility_id'],
      type: 'unique',
      name: 'uq_user_facilities_user_org_fac',
    });

    // Indexes for lookups
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ix_user_facilities_facility_role_active
      ON user_facilities (facility_id, role_id)
      WHERE is_active = 'active';
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ix_user_facilities_org_role_active
      ON user_facilities (organization_id, role_id)
      WHERE is_active = 'active';
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ix_user_facilities_user_active
      ON user_facilities (user_id)
      WHERE is_active = 'active';
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_facilities');

    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_user_facilities_is_active";'
      );
    }
  },
};
