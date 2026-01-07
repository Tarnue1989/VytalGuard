'use strict';

const { FEATURE_MODULE_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('feature_modules', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()')
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      icon: {
        type: Sequelize.STRING,
        allowNull: true
      },
      category: {
        type: Sequelize.STRING,
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: true,
        defaultValue: []
      },
      visibility: {
        type: Sequelize.ENUM('public', 'private', 'hidden'),
        allowNull: false,
        defaultValue: 'public'
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      status: {
        type: Sequelize.ENUM(...FEATURE_MODULE_STATUS),
        allowNull: false,
        defaultValue: FEATURE_MODULE_STATUS[0] // 'active'
      },

      // 🔹 NEW: route/path for linking sidebar dynamically
      route: {
        type: Sequelize.STRING,
        allowNull: true, // nullable for menu headers
      },

      // 🔹 Self-referencing parent_id for hierarchy
      parent_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'feature_modules',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      // 🔹 Audit fields (standardized with *_by_id)
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('feature_modules');
  }
};
