'use strict';

const { DataTypes } = require('sequelize');
const { STOCK_LEDGER_TYPE } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_ledgers', {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
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
        allowNull: true,
        references: { model: 'departments', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 🔗 Item + Source
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

      // 🔗 Request / Adjustment references
      stock_request_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'stock_requests', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      stock_request_item_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'stock_request_items', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      stock_adjustment_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'stock_adjustments', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 📊 Ledger entry
      ledger_type: {
        type: DataTypes.ENUM(...STOCK_LEDGER_TYPE),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      balance_after: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // 📌 Indexes
    await queryInterface.addIndex('stock_ledgers', ['organization_id']);
    await queryInterface.addIndex('stock_ledgers', ['facility_id']);
    await queryInterface.addIndex('stock_ledgers', ['department_id']);
    await queryInterface.addIndex('stock_ledgers', ['master_item_id']);
    await queryInterface.addIndex('stock_ledgers', ['ledger_type']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_ledgers');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_stock_ledgers_ledger_type;');
  },
};
