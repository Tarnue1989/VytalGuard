'use strict';

const {
  CONVERSATION_TYPES,
  CONVERSATION_STATUS,
} = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversations', {
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

      // 🔹 Optional Main Participants
      patient_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'patients',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      employee_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'employees',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      // 🔹 Conversation Meta
      topic: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      group_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      group_avatar: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM(
          ...Object.values(CONVERSATION_STATUS)
        ),
        allowNull: false,
        defaultValue: CONVERSATION_STATUS.ACTIVE,
      },

      conversation_type: {
        type: Sequelize.ENUM(
          ...Object.values(CONVERSATION_TYPES)
        ),
        allowNull: false,
        defaultValue: CONVERSATION_TYPES.INTERNAL,
      },

      // 🔹 Chat State
      is_group: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      is_archived: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      last_message_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      last_message_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      closed_at: {
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
    await queryInterface.addIndex('conversations', ['organization_id']);
    await queryInterface.addIndex('conversations', ['facility_id']);
    await queryInterface.addIndex('conversations', ['patient_id']);
    await queryInterface.addIndex('conversations', ['employee_id']);
    await queryInterface.addIndex('conversations', ['conversation_type']);
    await queryInterface.addIndex('conversations', ['status']);
    await queryInterface.addIndex('conversations', ['last_message_id']);
    await queryInterface.addIndex('conversations', ['last_message_at']);
    await queryInterface.addIndex('conversations', ['created_at']);

    await queryInterface.addIndex('conversations', [
      'patient_id',
      'employee_id',
      'conversation_type',
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('conversations');
  },
};