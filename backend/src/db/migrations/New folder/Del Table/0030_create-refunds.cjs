// 📁 backend/src/db/migrations/0037_create-refunds.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { REFUND_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('refunds', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Parent
      payment_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'payments', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      invoice_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
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

      // 💵 Refund details
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM(...REFUND_STATUS),
        allowNull: false,
        defaultValue: 'pending',
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

      // 🕒 Timestamps (paranoid)
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // 🔎 Indexes
    await queryInterface.addIndex('refunds', ['organization_id']);
    await queryInterface.addIndex('refunds', ['facility_id']);
    await queryInterface.addIndex('refunds', ['payment_id']);
    await queryInterface.addIndex('refunds', ['invoice_id']);
    await queryInterface.addIndex('refunds', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('refunds');
    // Optional Postgres cleanup:
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_refunds_status";');
  },
};
