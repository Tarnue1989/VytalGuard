// 📁 backend/src/db/migrations/0025_create-invoices.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { INVOICE_STATUS, PAYER_TYPES } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('invoices', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Links
      patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onDelete: 'CASCADE',
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
        allowNull: true,
        references: { model: 'facilities', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 📑 Invoice info
      invoice_number: { type: DataTypes.STRING, allowNull: true },
      status: {
        type: DataTypes.ENUM(...INVOICE_STATUS),
        allowNull: false,
        defaultValue: INVOICE_STATUS[0], // "draft"
      },
      currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'LRD' },
      due_date: { type: DataTypes.DATEONLY, allowNull: true },
      is_locked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // 💵 Aggregates
      total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_paid: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      refunded_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_discount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total_tax: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },

      // 🏥 Insurance & Payer
      payer_type: {
        type: DataTypes.ENUM(...PAYER_TYPES),
        allowNull: false,
        defaultValue: PAYER_TYPES[0], // "cash"
      },
      insurance_provider_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'insurance_providers', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      coverage_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      notes: { type: DataTypes.TEXT, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      updated_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },

      // 🕒 Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // ✅ Scoped uniqueness: invoice_number must be unique per org
    await queryInterface.addConstraint('invoices', {
      fields: ['organization_id', 'invoice_number'],
      type: 'unique',
      name: 'unique_invoice_per_org',
    });

    // Indexes
    await queryInterface.addIndex('invoices', ['patient_id']);
    await queryInterface.addIndex('invoices', ['organization_id']);
    await queryInterface.addIndex('invoices', ['facility_id']);
    await queryInterface.addIndex('invoices', ['status']);
    await queryInterface.addIndex('invoices', ['payer_type']);
    await queryInterface.addIndex('invoices', ['due_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('invoices');
  },
};
