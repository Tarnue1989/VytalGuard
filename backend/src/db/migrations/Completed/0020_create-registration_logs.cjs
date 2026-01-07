// 📁 backend/src/db/migrations/0014_create-registration_logs.cjs
'use strict';

const { DataTypes } = require('sequelize');
const {
  REGISTRATION_LOG_STATUS,
  REGISTRATION_METHODS,
  REGISTRATION_CATEGORIES,
} = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('registration_logs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Foreign Keys
      patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      registrar_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'employees', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
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
      invoice_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'invoices', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      registration_type_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'billable_items', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 📝 Info
      registration_method: {
        type: DataTypes.ENUM(...REGISTRATION_METHODS),
        allowNull: false,
        defaultValue: REGISTRATION_METHODS[0],
      },
      registration_source: { type: DataTypes.STRING(120), allowNull: true },
      patient_category: {
        type: DataTypes.ENUM(...REGISTRATION_CATEGORIES),
        allowNull: false,
        defaultValue: REGISTRATION_CATEGORIES[0],
      },
      visit_reason: { type: DataTypes.TEXT, allowNull: true },
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      registration_time: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      notes: { type: DataTypes.TEXT, allowNull: true },

      // 🏷️ Lifecycle
      log_status: {
        type: DataTypes.ENUM(...REGISTRATION_LOG_STATUS),
        allowNull: false,
        defaultValue: REGISTRATION_LOG_STATUS[0],
      },

      // 🕒 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },

      // Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('registration_logs');
  },
};
