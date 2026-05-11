'use strict';

const {
  MESSAGE_PARTICIPANT_ROLES,
} = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversation_participants', {
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

      // 🔹 Participant
      participant_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      participant_role: {
        type: Sequelize.ENUM(
          ...Object.values(MESSAGE_PARTICIPANT_ROLES)
        ),
        allowNull: false,
      },

      // 🔹 Chat State
      is_admin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      is_muted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      is_archived: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      joined_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      left_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      last_read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      last_read_message_id: {
        type: Sequelize.UUID,
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
    await queryInterface.addIndex('conversation_participants', ['conversation_id']);
    await queryInterface.addIndex('conversation_participants', ['participant_id']);
    await queryInterface.addIndex('conversation_participants', ['participant_role']);
    await queryInterface.addIndex('conversation_participants', ['organization_id']);
    await queryInterface.addIndex('conversation_participants', ['facility_id']);
    await queryInterface.addIndex('conversation_participants', ['last_read_at']);
    await queryInterface.addIndex('conversation_participants', ['last_read_message_id']);

    await queryInterface.addIndex(
      'conversation_participants',
      ['conversation_id', 'participant_id', 'participant_role'],
      {
        unique: true,
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('conversation_participants');
  },
};