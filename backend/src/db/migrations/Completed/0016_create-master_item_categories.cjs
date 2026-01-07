'use strict';

const { DataTypes } = require('sequelize');
const { MASTER_ITEM_CATEGORY_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('master_item_categories', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4, // Sequelize will map this to gen_random_uuid() via UUIDV4
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Org scope
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // 🔗 Facility scope (optional)
      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'facilities', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 📑 Identity
      name: { type: DataTypes.STRING(100), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },

      // 🔹 Lifecycle
      status: {
        type: DataTypes.ENUM(...MASTER_ITEM_CATEGORY_STATUS),
        allowNull: false,
        defaultValue: MASTER_ITEM_CATEGORY_STATUS[0], // "active"
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

    // ✅ Scoped uniqueness: category name per org
    await queryInterface.addConstraint('master_item_categories', {
      fields: ['organization_id', 'name'],
      type: 'unique',
      name: 'unique_category_per_org',
    });

    // Indexes
    await queryInterface.addIndex('master_item_categories', ['organization_id']);
    await queryInterface.addIndex('master_item_categories', ['facility_id']); // ✅ new index
    await queryInterface.addIndex('master_item_categories', ['name']);
    await queryInterface.addIndex('master_item_categories', ['code']);
    await queryInterface.addIndex('master_item_categories', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('master_item_categories');
  },
};
