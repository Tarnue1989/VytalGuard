'use strict';

const { THEME_STATUS } = require('../../constants/enums.js');

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {typeof import('sequelize')} Sequelize
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('organization_brandings', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      // 🔗 Organization Scope (1:1)
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true, // 🔥 ONE branding per org
        references: {
          model: 'organizations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // 🏷️ Status
      status: {
        type: Sequelize.ENUM(...THEME_STATUS),
        allowNull: false,
        defaultValue: THEME_STATUS[0],
      },

      // 🎨 Theme (JSON)
      theme: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {
          primary: '#0f62fe',
          secondary: '#6f6f6f',
          surface: '#ffffff',
          text: '#111827',
        },
      },

      // 🖼️ Assets
      logo_url: {
        type: Sequelize.STRING(400),
        allowNull: true,
      },
      logo_print_url: {
        type: Sequelize.STRING(400),
        allowNull: true,
      },
      favicon_url: {
        type: Sequelize.STRING(400),
        allowNull: true,
      },

      default_letterhead_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'letterhead_templates',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      // 📞 Contact Info (flexible JSON)
      contact: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },

      // 🧠 Extra metadata
      meta: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },

      // 🔹 Audit
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      deleted_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
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

    // 📌 Indexes
    await queryInterface.addIndex('organization_brandings', ['organization_id']);
    await queryInterface.addIndex('organization_brandings', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('organization_brandings');

    // Cleanup ENUM (Postgres)
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_organization_brandings_status";'
      );
    }
  },
};