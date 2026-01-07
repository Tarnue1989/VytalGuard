'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('messages', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Links
      conversation_id: { type: DataTypes.UUID, allowNull: false },
      sender_id: { type: DataTypes.UUID, allowNull: false },
      sender_role: { type: DataTypes.ENUM('employee', 'patient'), allowNull: false },
      receiver_id: { type: DataTypes.UUID, allowNull: false },
      receiver_role: { type: DataTypes.ENUM('employee', 'patient'), allowNull: false },

      // Content
      content: { type: DataTypes.TEXT, allowNull: false },
      message_type: { type: DataTypes.ENUM('text', 'image', 'file'), defaultValue: 'text' },
      chat_type: { type: DataTypes.ENUM('internal', 'clinical', 'helpdesk'), defaultValue: 'internal' },

      // Status
      is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
      read_at: { type: DataTypes.DATE },

      deleted_by_sender: { type: DataTypes.BOOLEAN, defaultValue: false },
      deleted_by_receiver: { type: DataTypes.BOOLEAN, defaultValue: false },

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
    await queryInterface.addIndex('messages', ['conversation_id']);
    await queryInterface.addIndex('messages', ['created_at']);
    await queryInterface.addIndex('messages', ['receiver_id', 'receiver_role']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('messages');
  },
};
