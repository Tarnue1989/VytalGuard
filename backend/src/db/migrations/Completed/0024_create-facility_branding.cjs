// 📁 backend/src/db/migrations/0024_create-facility_branding.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { THEME_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('facility_branding', {
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
        allowNull: false,
        references: { model: 'facilities', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 🏷️ Status
      status: {
        type: DataTypes.ENUM(...THEME_STATUS),
        allowNull: false,
        defaultValue: THEME_STATUS[0],
      },

      // 🎨 Theme & Assets
      theme: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      logo_url: { type: DataTypes.STRING(400), allowNull: true },
      logo_print_url: { type: DataTypes.STRING(400), allowNull: true },
      favicon_url: { type: DataTypes.STRING(400), allowNull: true },
      default_letterhead_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'letterhead_templates', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      contact: { type: DataTypes.JSONB, allowNull: true },
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

    // ✅ Composite unique constraint per org + facility
    await queryInterface.addConstraint('facility_branding', {
      fields: ['organization_id', 'facility_id'],
      type: 'unique',
      name: 'unique_branding_per_facility_scope',
    });

    // Indexes
    await queryInterface.addIndex('facility_branding', ['organization_id']);
    await queryInterface.addIndex('facility_branding', ['facility_id']);
    await queryInterface.addIndex('facility_branding', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('facility_branding');
  },
};
