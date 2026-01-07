// 📁 backend/src/db/migrations/0021_create-billable_items.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { BILLABLE_ITEM_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('billable_items', {
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

      // 🔗 Master Item link
      master_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'master_items', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 🔗 Department override
      department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'departments', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 📑 Item details
      name: { type: DataTypes.STRING(150), allowNull: false },
      category: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },

      // 💵 Pricing
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'USD' },
      taxable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      discountable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      override_allowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

      // 🔹 Status
      status: {
        type: DataTypes.ENUM(...BILLABLE_ITEM_STATUS),
        allowNull: false,
        defaultValue: BILLABLE_ITEM_STATUS[0],
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },

      // 🕒 Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // ✅ Unique constraint per org/facility/master_item
    await queryInterface.addConstraint('billable_items', {
      fields: ['organization_id', 'facility_id', 'master_item_id'],
      type: 'unique',
      name: 'unique_price_per_scope',
    });

    // Indexes
    await queryInterface.addIndex('billable_items', ['organization_id']);
    await queryInterface.addIndex('billable_items', ['facility_id']);
    await queryInterface.addIndex('billable_items', ['master_item_id']);
    await queryInterface.addIndex('billable_items', ['department_id']);
    await queryInterface.addIndex('billable_items', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('billable_items');
  },
};
