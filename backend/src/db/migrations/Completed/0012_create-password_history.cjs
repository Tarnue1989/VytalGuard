// 📁 backend/src/db/migrations/0013_create-patients.cjs
'use strict';

const { DataTypes } = require('sequelize');
const { GENDER_TYPES } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('patients', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🆔 Core details
      pat_no: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      first_name: { type: DataTypes.STRING(120), allowNull: false },
      middle_name: { type: DataTypes.STRING(120), allowNull: true },
      last_name: { type: DataTypes.STRING(120), allowNull: false },
      date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
      gender: { type: DataTypes.ENUM(...GENDER_TYPES), allowNull: true },
      phone_number: { type: DataTypes.STRING(50), allowNull: true },
      email_address: { type: DataTypes.STRING(120), allowNull: true },
      home_address: { type: DataTypes.STRING(255), allowNull: true },
      marital_status: { type: DataTypes.STRING(50), allowNull: true },
      religion: { type: DataTypes.STRING(80), allowNull: true },
      profession: { type: DataTypes.STRING(120), allowNull: true },

      // 🚨 Emergency Contact
      emergency_contact_name: { type: DataTypes.STRING(120), allowNull: true },
      emergency_contact_phone: { type: DataTypes.STRING(50), allowNull: true },

      // 📝 Registration
      registration_status: { type: DataTypes.STRING(50), allowNull: true },
      source_of_registration: { type: DataTypes.STRING(120), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },

      // 📷 Media
      qr_code_path: { type: DataTypes.STRING(255), allowNull: true },
      photo_path: { type: DataTypes.STRING(255), allowNull: true },

      // 🔗 Links
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
      employee_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'employees', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },

      // 🕒 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },

      // Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('patients');
  },
};
