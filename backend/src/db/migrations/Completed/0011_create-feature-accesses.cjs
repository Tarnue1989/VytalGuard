'use strict';

const { FEATURE_ACCESS_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('feature_accesses', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },

      // 🔹 Tenant scope
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'facilities',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      // 🔹 Linking
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      module_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'feature_modules',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      // 🔹 Status
      status: {
        type: Sequelize.ENUM(...FEATURE_ACCESS_STATUS),
        allowNull: false,
        defaultValue: FEATURE_ACCESS_STATUS[0]
      },

      // 🔹 Audit fields
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      deleted_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      // 🔹 Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // 🔹 Index for fast lookups (prevent duplicate access rows)
    await queryInterface.addIndex('feature_accesses', [
      'organization_id',
      'facility_id',
      'role_id',
      'module_id'
    ], {
      unique: true,
      name: 'uq_feature_accesses_org_facility_role_module'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('feature_accesses');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_feature_accesses_status";'
    );
  }
};
