// 📁 backend/src/db/migrations/0027_create-letterhead_templates.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { LETTERHEAD_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('letterhead_templates', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Scope
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'facilities', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 🏷️ Details
      name: { type: DataTypes.STRING(150), allowNull: false },
      status: {
        type: DataTypes.ENUM(...LETTERHEAD_STATUS),
        allowNull: false,
        defaultValue: LETTERHEAD_STATUS[0],
      },
      header_html: { type: DataTypes.TEXT, allowNull: false },
      footer_html: { type: DataTypes.TEXT, allowNull: true },
      logo_url: { type: DataTypes.STRING(400), allowNull: true },
      watermark_url: { type: DataTypes.STRING(400), allowNull: true },

      // ⚙️ Options
      pdf_options: { type: DataTypes.JSONB, allowNull: true },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      effective_from: { type: DataTypes.DATE, allowNull: true },
      effective_to: { type: DataTypes.DATE, allowNull: true },
      meta: { type: DataTypes.JSONB, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      updated_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },

      // 🕒 Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // ✅ Scoped uniqueness: template name per org
    await queryInterface.addConstraint('letterhead_templates', {
      fields: ['organization_id', 'name'],
      type: 'unique',
      name: 'unique_letterhead_name_per_org',
    });

    // Indexes
    await queryInterface.addIndex('letterhead_templates', ['organization_id']);
    await queryInterface.addIndex('letterhead_templates', ['facility_id']);
    await queryInterface.addIndex('letterhead_templates', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('letterhead_templates');
  },
};
