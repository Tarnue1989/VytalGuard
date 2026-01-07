// 📁 backend/src/db/migrations/0022_create-billable_item_price_histories.cjs
'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('billable_item_price_histories', {
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
        allowNull: false,
        references: { model: 'facilities', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 🔗 Item
      billable_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'billable_items', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 💵 Pricing
      old_price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      new_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      effective_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },

      // 🔹 Audit
      created_by_id: {
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
    });

    // Indexes
    await queryInterface.addIndex('billable_item_price_histories', ['organization_id']);
    await queryInterface.addIndex('billable_item_price_histories', ['facility_id']);
    await queryInterface.addIndex('billable_item_price_histories', ['billable_item_id']);
    await queryInterface.addIndex('billable_item_price_histories', ['effective_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('billable_item_price_histories');
  },
};
