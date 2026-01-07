// 📁 backend/src/db/migrations/0040_create-stock_requests.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { STOCK_REQUEST_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('stock_requests', {
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

      // 🔗 Department making the request
      department_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'departments', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 📑 Request metadata
      reference_number: { type: DataTypes.STRING, allowNull: false, unique: true },
      status: {
        type: DataTypes.ENUM(...STOCK_REQUEST_STATUS),
        allowNull: false,
        defaultValue: 'pending',
      },
      notes: { type: DataTypes.TEXT, allowNull: true },

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
      rejection_reason: { type: DataTypes.TEXT, allowNull: true },
      issued_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      issued_at: { type: DataTypes.DATE, allowNull: true },
      issue_notes: { type: DataTypes.TEXT, allowNull: true },
      fulfilled_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      fulfilled_at: { type: DataTypes.DATE, allowNull: true },
      fulfillment_notes: { type: DataTypes.TEXT, allowNull: true },

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
    await queryInterface.addIndex('stock_requests', ['organization_id']);
    await queryInterface.addIndex('stock_requests', ['facility_id']);
    await queryInterface.addIndex('stock_requests', ['department_id']);
    await queryInterface.addIndex('stock_requests', ['status']);
    await queryInterface.addIndex('stock_requests', ['reference_number']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_requests');
    // Optional: Postgres cleanup
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_stock_requests_status";');
  },
};
