'use strict';

const { DataTypes } = require('sequelize');
const { MASTER_ITEM_TYPES, MASTER_ITEM_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('master_items', {
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
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 📑 Identity
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },

      // 🔗 Classification
      item_type: {
        type: DataTypes.ENUM(...Object.values(MASTER_ITEM_TYPES)),
        allowNull: false,
      },
      category_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'master_item_categories', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'departments', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 🧩 NEW → Feature Module linkage
      feature_module_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'feature_modules', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 💊 Medical attributes
      generic_group: { type: DataTypes.STRING, allowNull: true },
      strength: { type: DataTypes.STRING, allowNull: true },
      dosage_form: { type: DataTypes.STRING, allowNull: true },
      unit: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pcs' },

      // 📦 Inventory attributes
      reorder_level: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_controlled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sample_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      test_method: { type: DataTypes.STRING, allowNull: true },

      // 💵 Reference price
      reference_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },

      // 🔹 Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(MASTER_ITEM_STATUS)),
        allowNull: false,
        defaultValue: MASTER_ITEM_STATUS.ACTIVE,
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

      // 🕒 Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // ✅ Scoped uniqueness: one item per org + facility + name + strength + category
    await queryInterface.addConstraint('master_items', {
      fields: ['organization_id', 'facility_id', 'name', 'strength', 'category_id'],
      type: 'unique',
      name: 'unique_item_per_org',
    });

    // 🧩 Indexes
    await queryInterface.addIndex('master_items', ['organization_id']);
    await queryInterface.addIndex('master_items', ['facility_id']);
    await queryInterface.addIndex('master_items', ['item_type']);
    await queryInterface.addIndex('master_items', ['feature_module_id']); // ✅ NEW
    await queryInterface.addIndex('master_items', ['name']);
    await queryInterface.addIndex('master_items', ['code']);
    await queryInterface.addIndex('master_items', ['category_id']);
    await queryInterface.addIndex('master_items', ['department_id']);
    await queryInterface.addIndex('master_items', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('master_items');
  },
};
