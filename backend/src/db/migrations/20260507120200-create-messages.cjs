'use strict';

const {
  MESSAGE_PARTICIPANT_ROLES,
  MESSAGE_TYPES,
  MESSAGE_STATUS,
  CONVERSATION_TYPES,
} = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('messages', {
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

      // 🔹 Conversation
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'conversations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // 🔹 Sender
      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      sender_role: {
        type: Sequelize.ENUM(
          ...Object.values(MESSAGE_PARTICIPANT_ROLES)
        ),
        allowNull: false,
      },

      // 🔹 Receiver
      receiver_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      receiver_role: {
        type: Sequelize.ENUM(
          ...Object.values(MESSAGE_PARTICIPANT_ROLES)
        ),
        allowNull: true,
      },

      // 🔹 Message Content
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      message_type: {
        type: Sequelize.ENUM(
          ...Object.values(MESSAGE_TYPES)
        ),
        allowNull: false,
        defaultValue: MESSAGE_TYPES.TEXT,
      },

      chat_type: {
        type: Sequelize.ENUM(
          ...Object.values(CONVERSATION_TYPES)
        ),
        allowNull: false,
        defaultValue: CONVERSATION_TYPES.INTERNAL,
      },

      // 🔹 Message State
      status: {
        type: Sequelize.ENUM(
          ...Object.values(MESSAGE_STATUS)
        ),
        allowNull: false,
        defaultValue: MESSAGE_STATUS.SENT,
      },

      is_read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      is_edited: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      edited_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      is_pinned: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      is_system_generated: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      deleted_for_everyone: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // 🔹 Reply Support
      reply_to_message_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'messages',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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
    await queryInterface.addIndex('messages', ['conversation_id']);
    await queryInterface.addIndex('messages', ['conversation_id', 'created_at']);
    await queryInterface.addIndex('messages', ['sender_id']);
    await queryInterface.addIndex('messages', ['receiver_id']);
    await queryInterface.addIndex('messages', ['status']);
    await queryInterface.addIndex('messages', ['message_type']);
    await queryInterface.addIndex('messages', ['organization_id']);
    await queryInterface.addIndex('messages', ['facility_id']);
    await queryInterface.addIndex('messages', ['created_at']);
    await queryInterface.addIndex('messages', ['reply_to_message_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('messages');
  },
};