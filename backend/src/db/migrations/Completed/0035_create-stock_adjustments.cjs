'use strict';

const { DataTypes } = require('sequelize');
const { ADJUSTMENT_TYPES, STOCK_ADJUSTMENT_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('stock_adjustments', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Links
      central_stock_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'central_stocks', key: 'id' },
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

      // ⚖️ Adjustment details
      adjustment_type: {
        type: DataTypes.ENUM(...ADJUSTMENT_TYPES),
        allowNull: false,
      },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: true },

      // 🔹 Lifecycle
      status: {
        type: DataTypes.ENUM(...STOCK_ADJUSTMENT_STATUS),
        allowNull: false,
        defaultValue: STOCK_ADJUSTMENT_STATUS[0], // "draft"
      },

      // ✅ Approval
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

      // 🕒 Timestamps (paranoid)
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // 🔎 Indexes
    await queryInterface.addIndex('stock_adjustments', ['organization_id']);
    await queryInterface.addIndex('stock_adjustments', ['facility_id']);
    await queryInterface.addIndex('stock_adjustments', ['central_stock_id']);
    await queryInterface.addIndex('stock_adjustments', ['adjustment_type']);
    await queryInterface.addIndex('stock_adjustments', ['status']);       // ✅ new index
    await queryInterface.addIndex('stock_adjustments', ['approved_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_adjustments');

    // Optional cleanup ENUMs
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stock_adjustments_adjustment_type";');
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stock_adjustments_status";');
  },
};
