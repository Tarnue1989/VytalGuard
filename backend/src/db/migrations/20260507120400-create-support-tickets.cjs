'use strict';

const {
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_PRIORITY,
  SUPPORT_TICKET_CATEGORY,
} = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('support_tickets', {
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

      // 🔹 Linked Conversation
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

      // 🔹 Participants
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

      assigned_to: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'employees',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      // 🔹 Ticket Identity
      ticket_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },

      subject: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      internal_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 🔹 Workflow
      status: {
        type: Sequelize.ENUM(
          ...Object.values(SUPPORT_TICKET_STATUS)
        ),
        allowNull: false,
        defaultValue: SUPPORT_TICKET_STATUS.OPEN,
      },

      priority: {
        type: Sequelize.ENUM(
          ...Object.values(SUPPORT_TICKET_PRIORITY)
        ),
        allowNull: false,
        defaultValue: SUPPORT_TICKET_PRIORITY.MEDIUM,
      },

      category: {
        type: Sequelize.ENUM(
          ...Object.values(SUPPORT_TICKET_CATEGORY)
        ),
        allowNull: false,
        defaultValue: SUPPORT_TICKET_CATEGORY.GENERAL,
      },

      is_escalated: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      escalated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // 🔹 SLA / Lifecycle
      opened_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      first_response_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      closed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // 🔹 Feedback
      rating: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      feedback_comment: {
        type: Sequelize.TEXT,
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
    await queryInterface.addIndex(
      'support_tickets',
      ['ticket_number'],
      { unique: true }
    );

    await queryInterface.addIndex('support_tickets', ['organization_id']);
    await queryInterface.addIndex('support_tickets', ['facility_id']);
    await queryInterface.addIndex('support_tickets', ['status']);
    await queryInterface.addIndex('support_tickets', ['priority']);
    await queryInterface.addIndex('support_tickets', ['assigned_to']);
    await queryInterface.addIndex('support_tickets', ['conversation_id']);
    await queryInterface.addIndex('support_tickets', ['patient_id']);
    await queryInterface.addIndex('support_tickets', ['employee_id']);
    await queryInterface.addIndex('support_tickets', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('support_tickets');
  },
};