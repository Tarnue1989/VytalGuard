// 📁 backend/src/db/migrations/0026_create-invoice_items.cjs
'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('invoice_items', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Parent
      invoice_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      billable_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'billable_items', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 🔗 Tenant scope
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

      // 📑 Item details
      description: { type: DataTypes.STRING, allowNull: true },
      unit_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      discount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      tax: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      total_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      updated_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL', onUpdate: 'CASCADE' },

      // 🕒 Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // ✅ Scoped uniqueness: ensure no duplicate billable item rows per invoice
    await queryInterface.addConstraint('invoice_items', {
      fields: ['invoice_id', 'billable_item_id', 'description'],
      type: 'unique',
      name: 'unique_invoice_item_per_invoice',
    });

    // Indexes
    await queryInterface.addIndex('invoice_items', ['organization_id']);
    await queryInterface.addIndex('invoice_items', ['facility_id']);
    await queryInterface.addIndex('invoice_items', ['invoice_id']);
    await queryInterface.addIndex('invoice_items', ['billable_item_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('invoice_items');
  },
};
