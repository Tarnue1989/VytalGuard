'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('message_attachments', {
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

      // 🔹 Parent Message
      message_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'messages',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // 🔹 File Metadata
      file_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      original_file_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      file_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      mime_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      file_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      file_path: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      file_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      thumbnail_path: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // 🔹 Storage
      storage_provider: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      storage_key: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // 🔹 Security
      virus_scan_status: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // 🔹 Usage
      download_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      is_deleted_from_storage: {
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
    await queryInterface.addIndex('message_attachments', ['message_id']);
    await queryInterface.addIndex('message_attachments', ['organization_id']);
    await queryInterface.addIndex('message_attachments', ['facility_id']);
    await queryInterface.addIndex('message_attachments', ['file_type']);
    await queryInterface.addIndex('message_attachments', ['mime_type']);
    await queryInterface.addIndex('message_attachments', ['created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('message_attachments');
  },
};