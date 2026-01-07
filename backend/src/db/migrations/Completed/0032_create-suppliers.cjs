// 📁 backend/src/db/migrations/0042_create-suppliers.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { SUPPLIER_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('suppliers', {
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

      // 📋 Supplier details
      name: { type: DataTypes.STRING, allowNull: false },
      contact_name: { type: DataTypes.STRING, allowNull: true },
      contact_email: { type: DataTypes.STRING, allowNull: true },
      contact_phone: { type: DataTypes.STRING, allowNull: true },
      address: { type: DataTypes.TEXT, allowNull: true },

      // 📌 Status
      status: {
        type: DataTypes.ENUM(...SUPPLIER_STATUS),
        allowNull: false,
        defaultValue: 'active',
      },

      notes: { type: DataTypes.TEXT, allowNull: true },

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

    // ✅ Uniqueness: supplier name per org
    await queryInterface.addConstraint('suppliers', {
      fields: ['organization_id', 'name'],
      type: 'unique',
      name: 'unique_supplier_per_org',
    });

    // 🔎 Indexes
    await queryInterface.addIndex('suppliers', ['organization_id']);
    await queryInterface.addIndex('suppliers', ['facility_id']);
    await queryInterface.addIndex('suppliers', ['name']);
    await queryInterface.addIndex('suppliers', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('suppliers');
    // Optional cleanup for Postgres ENUM:
    // await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_suppliers_status";');
  },
};
