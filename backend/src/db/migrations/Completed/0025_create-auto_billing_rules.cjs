'use strict';

const { DataTypes } = require('sequelize');
const {
  AUTO_BILLING_RULE_STATUS,
  AUTO_BILLING_CHARGE_MODE,
} = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('auto_billing_rules', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // ?? Tenant scope
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

      // ?? Billing configuration
      trigger_module: {
        type: DataTypes.STRING(80),
        allowNull: false,
        comment: 'Trigger module key (e.g., consultation, lab-request)',
      },

      // ? NEW: Feature Module relational link
      trigger_feature_module_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Relational link to FeatureModule.id (used alongside trigger_module string)',
        references: { model: 'feature_modules', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      billable_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'billable_items', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },

      auto_generate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      charge_mode: {
        type: DataTypes.ENUM(...AUTO_BILLING_CHARGE_MODE),
        allowNull: false,
        defaultValue: AUTO_BILLING_CHARGE_MODE[0],
      },

      default_price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },

      // ?? Lifecycle
      status: {
        type: DataTypes.ENUM(...AUTO_BILLING_RULE_STATUS),
        allowNull: false,
        defaultValue: AUTO_BILLING_RULE_STATUS[0], // "active"
      },

      // ?? Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },

      // ?? Timestamps
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // ============================================================
    // ?? Indexes for performance
    // ============================================================
    await queryInterface.addIndex('auto_billing_rules', ['organization_id']);
    await queryInterface.addIndex('auto_billing_rules', ['facility_id']);
    await queryInterface.addIndex('auto_billing_rules', ['trigger_module']);
    await queryInterface.addIndex('auto_billing_rules', ['trigger_feature_module_id']); // ? NEW INDEX
    await queryInterface.addIndex('auto_billing_rules', ['billable_item_id']);
    await queryInterface.addIndex('auto_billing_rules', ['status']); // ? replaces is_active
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auto_billing_rules');
  },
};
