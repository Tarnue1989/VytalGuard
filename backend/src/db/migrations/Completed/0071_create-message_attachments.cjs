'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('message_attachments', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      message_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'messages', key: 'id' },
        onDelete: 'CASCADE',
      },

      // File info
      file_name: { type: DataTypes.STRING, allowNull: false },
      file_type: { type: DataTypes.STRING, allowNull: false },
      file_size: { type: DataTypes.INTEGER, allowNull: false },
      file_path: { type: DataTypes.STRING, allowNull: false },

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
    await queryInterface.addIndex('message_attachments', ['message_id']);
    await queryInterface.addIndex('message_attachments', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('message_attachments');
  },
};
