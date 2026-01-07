'use strict';

const { DataTypes } = require('sequelize');
const { STOCK_RETURN_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_returns', {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
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
      department_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'departments', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 🔗 Item & Stock
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

      // 📊 Return details
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: true },

      // 🔹 Lifecycle
      status: {
        type: DataTypes.ENUM(...STOCK_RETURN_STATUS),
        allowNull: false,
        defaultValue: STOCK_RETURN_STATUS[0],
      },

      // 🔹 Approval
      approved_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      approved_at: { type: DataTypes.DATE, allowNull: true },

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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // 📌 Indexes
    await queryInterface.addIndex('stock_returns', ['organization_id']);
    await queryInterface.addIndex('stock_returns', ['facility_id']);
    await queryInterface.addIndex('stock_returns', ['department_id']);
    await queryInterface.addIndex('stock_returns', ['master_item_id']);
    await queryInterface.addIndex('stock_returns', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_returns');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_stock_returns_status;');
  },
};
