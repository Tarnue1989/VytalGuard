// 📁 backend/src/db/migrations/0036_create-plan_modules.cjs
'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('plan_modules', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 Links
      plan_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'plans', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      module_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'feature_modules', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      // ⚙️ Config
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

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

    // ✅ Unique: a module appears at most once per plan
    await queryInterface.addConstraint('plan_modules', {
      fields: ['plan_id', 'module_id'],
      type: 'unique',
      name: 'unique_plan_module_per_plan',
    });

    // 🔎 Indexes
    await queryInterface.addIndex('plan_modules', ['plan_id']);
    await queryInterface.addIndex('plan_modules', ['module_id']);
    await queryInterface.addIndex('plan_modules', ['enabled']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plan_modules');
  },
};
