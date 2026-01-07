'use strict';

const { DataTypes } = require('sequelize');
const { CENTRAL_STOCK_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('central_stocks', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
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

      // 🔗 Item + Supplier
      master_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'master_items', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      supplier_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'suppliers', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 📦 Batch info
      batch_number: { type: DataTypes.STRING, allowNull: true },
      received_date: { type: DataTypes.DATE, allowNull: false },
      expiry_date: { type: DataTypes.DATE, allowNull: true },

      // 📊 Stock counts
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      unit_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      is_locked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // 🔹 Lifecycle (Enum-driven)
      status: {
        type: DataTypes.ENUM(...Object.values(CENTRAL_STOCK_STATUS)),
        allowNull: false,
        defaultValue: CENTRAL_STOCK_STATUS.ACTIVE,
      },

      // 🔹 Audit
      created_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      updated_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      deleted_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 🕒 Timestamps
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // ✅ Unique constraint: batch uniqueness per scope
    await queryInterface.addConstraint('central_stocks', {
      fields: [
        'organization_id',
        'facility_id',
        'master_item_id',
        'supplier_id',
        'batch_number',
        'received_date',
      ],
      type: 'unique',
      name: 'unique_stock_batch',
    });

    // ✅ Indexes
    await queryInterface.addIndex('central_stocks', ['organization_id']);
    await queryInterface.addIndex('central_stocks', ['facility_id']);
    await queryInterface.addIndex('central_stocks', ['master_item_id']);
    await queryInterface.addIndex('central_stocks', ['supplier_id']);
    await queryInterface.addIndex('central_stocks', ['batch_number']);
    await queryInterface.addIndex('central_stocks', ['received_date']);
    await queryInterface.addIndex('central_stocks', ['expiry_date']);
    await queryInterface.addIndex('central_stocks', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('central_stocks');
  },
};
