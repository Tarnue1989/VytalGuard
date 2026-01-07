'use strict';

const { DataTypes } = require('sequelize');
const { STOCK_REQUEST_ITEM_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('stock_request_items', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Parent
      stock_request_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'stock_requests', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      master_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'master_items', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      central_stock_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'central_stocks', key: 'id' },
        onDelete: 'SET NULL',
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

      // 📦 Item details
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      issued_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      fulfilled_quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM(...STOCK_REQUEST_ITEM_STATUS),
        allowNull: false,
        defaultValue: 'pending',
      },
      remarks: { type: DataTypes.TEXT, allowNull: true },

      // 📝 Reasons / Notes
      rejection_reason: { type: DataTypes.TEXT, allowNull: true },
      fulfillment_notes: { type: DataTypes.TEXT, allowNull: true },

      // ⏱️ Lifecycle
      approved_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      approved_at: { type: DataTypes.DATE, allowNull: true },

      rejected_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      rejected_at: { type: DataTypes.DATE, allowNull: true },

      issued_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      issued_at: { type: DataTypes.DATE, allowNull: true },

      fulfilled_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      fulfilled_at: { type: DataTypes.DATE, allowNull: true },

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

      // 🕒 Timestamps (paranoid)
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // ✅ Prevent duplicate items in the same request
    await queryInterface.addConstraint('stock_request_items', {
      fields: ['stock_request_id', 'master_item_id'],
      type: 'unique',
      name: 'unique_item_per_request',
    });

    // 🔎 Indexes
    await queryInterface.addIndex('stock_request_items', ['organization_id']);
    await queryInterface.addIndex('stock_request_items', ['facility_id']);
    await queryInterface.addIndex('stock_request_items', ['stock_request_id']);
    await queryInterface.addIndex('stock_request_items', ['master_item_id']);
    await queryInterface.addIndex('stock_request_items', ['central_stock_id']);
    await queryInterface.addIndex('stock_request_items', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_request_items');
    // Optional cleanup:
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stock_request_items_status";');
  },
};
