// 📁 backend/src/db/migrations/0034_create-payments.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { PAYMENT_METHODS, PAYMENT_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('payments', {
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

      // 💵 Payment details
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      method: {
        type: DataTypes.ENUM(...PAYMENT_METHODS),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...PAYMENT_STATUS),
        allowNull: false,
        defaultValue: PAYMENT_STATUS[1], // "completed"
      },
      transaction_ref: { type: DataTypes.STRING, allowNull: true },
      is_deposit: { type: DataTypes.BOOLEAN, defaultValue: false },

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
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // 🔎 Explicitly named indexes (to avoid collision with FK names)
    await queryInterface.addIndex('payments', ['organization_id'], {
      name: 'idx_payments_org_id',
    });
    await queryInterface.addIndex('payments', ['facility_id'], {
      name: 'idx_payments_facility_id',
    });
    await queryInterface.addIndex('payments', ['invoice_id'], {
      name: 'idx_payments_invoice_id',
    });
    await queryInterface.addIndex('payments', ['status'], {
      name: 'idx_payments_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payments');

    // optional: clean up ENUM types in Postgres
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_method";');
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_status";');
  },
};
