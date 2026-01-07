'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('conversations', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // Scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Participants
      patient_id: { type: DataTypes.UUID, allowNull: true },
      employee_id: { type: DataTypes.UUID, allowNull: true },

      // Meta
      topic: { type: DataTypes.STRING(255), allowNull: true },
      conversation_type: {
        type: DataTypes.ENUM('internal', 'clinical', 'helpdesk'),
        allowNull: false,
        defaultValue: 'internal',
      },

      // Audit
      created_by: { type: DataTypes.UUID },
      updated_by: { type: DataTypes.UUID },
      deleted_by: { type: DataTypes.UUID },

      // Sequelize metadata
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE },
    });

    // Indexes
    await queryInterface.addIndex('conversations', ['organization_id']);
    await queryInterface.addIndex('conversations', ['facility_id']);
    await queryInterface.addIndex('conversations', ['patient_id']);
    await queryInterface.addIndex('conversations', ['employee_id']);
  },

  async down(queryInterface) {
    // Drop table and ENUMs safely
    await queryInterface.dropTable('conversations');

    // Drop ENUM type explicitly to avoid leftovers in Postgres
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_conversations_conversation_type";');
  },
};
