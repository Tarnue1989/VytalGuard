'use strict';

const {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
} = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      // 🔹 Tenant Scope
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'facilities',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // 🔹 Recipient
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // 🔹 Notification Content
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      // 🔹 Notification Type
      type: {
        type: Sequelize.ENUM(
          ...Object.values(NOTIFICATION_TYPES)
        ),
        allowNull: false,
      },

      // 🔹 Linked Entity
      reference_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      reference_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // 🔹 Read State
      status: {
        type: Sequelize.ENUM(
          ...Object.values(NOTIFICATION_STATUS)
        ),
        allowNull: false,
        defaultValue: NOTIFICATION_STATUS.UNREAD,
      },

      read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      is_seen: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      seen_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // 🔹 Audit
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      deleted_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

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

    // 🔹 Indexes
    await queryInterface.addIndex('notifications', ['user_id']);
    await queryInterface.addIndex('notifications', ['type']);
    await queryInterface.addIndex('notifications', ['status']);
    await queryInterface.addIndex('notifications', ['reference_id']);
    await queryInterface.addIndex('notifications', ['reference_type']);
    await queryInterface.addIndex('notifications', ['organization_id']);
    await queryInterface.addIndex('notifications', ['facility_id']);
    await queryInterface.addIndex('notifications', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  },
};