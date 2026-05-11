'use strict';

const {
  TICKET_ACTIVITY_TYPES,
} = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ticket_activities', {
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

      // 🔹 Parent Ticket
      ticket_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'support_tickets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // 🔹 Activity
      activity_type: {
        type: Sequelize.ENUM(
          ...Object.values(TICKET_ACTIVITY_TYPES)
        ),
        allowNull: false,
      },

      old_value: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      new_value: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },

      // 🔹 Who Performed Action
      performed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'employees',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      is_system_generated: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
    await queryInterface.addIndex('ticket_activities', ['ticket_id']);

    await queryInterface.addIndex(
      'ticket_activities',
      ['ticket_id', 'created_at']
    );

    await queryInterface.addIndex('ticket_activities', ['activity_type']);
    await queryInterface.addIndex('ticket_activities', ['organization_id']);
    await queryInterface.addIndex('ticket_activities', ['facility_id']);
    await queryInterface.addIndex('ticket_activities', ['performed_by']);
    await queryInterface.addIndex('ticket_activities', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ticket_activities');
  },
};