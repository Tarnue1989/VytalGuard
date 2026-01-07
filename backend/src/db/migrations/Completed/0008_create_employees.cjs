'use strict';

const { DataTypes } = require('sequelize');
const { EMPLOYEE_STATUS, GENDER_TYPES } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('employees', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🪪 Identity
      first_name: { type: DataTypes.STRING(80), allowNull: false },
      middle_name: { type: DataTypes.STRING(80), allowNull: true },
      last_name: { type: DataTypes.STRING(80), allowNull: false },
      gender: { type: DataTypes.ENUM(...GENDER_TYPES), allowNull: false },
      dob: { type: DataTypes.DATEONLY, allowNull: true },

      // 📷 File Uploads
      photo_path: { type: DataTypes.STRING(255), allowNull: true },   // profile picture
      resume_url: { type: DataTypes.STRING(255), allowNull: true },   // CV
      document_url: { type: DataTypes.STRING(255), allowNull: true }, // supporting doc

      // 📞 Contact
      phone: { type: DataTypes.STRING(50), allowNull: true },
      email: { type: DataTypes.STRING(120), allowNull: true },
      address: { type: DataTypes.STRING(255), allowNull: true },

      // 🏢 Employment Info
      employee_no: { type: DataTypes.STRING(50), allowNull: false },
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
      department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'departments', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      position: { type: DataTypes.STRING(120), allowNull: true },
      status: {
        type: DataTypes.ENUM(...EMPLOYEE_STATUS),
        allowNull: false,
        defaultValue: EMPLOYEE_STATUS[0],
      },

      // 🎓 Professional Credentials
      license_no: { type: DataTypes.STRING(120), allowNull: true },
      specialty: { type: DataTypes.STRING(120), allowNull: true },
      certifications: { type: DataTypes.TEXT, allowNull: true },

      // 📆 HR Dates
      hire_date: { type: DataTypes.DATE, allowNull: true },
      termination_date: { type: DataTypes.DATE, allowNull: true },

      // 🚨 Emergency Contact
      emergency_contact_name: { type: DataTypes.STRING(120), allowNull: true },
      emergency_contact_phone: { type: DataTypes.STRING(50), allowNull: true },

      // 🔍 System Link
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
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

    // ✅ Composite unique key for org + employee_no
    await queryInterface.addConstraint('employees', {
      fields: ['organization_id', 'employee_no'],
      type: 'unique',
      name: 'uq_employee_org_empno'
    });

    // ✅ Helpful indexes
    await queryInterface.addIndex('employees', ['organization_id']);
    await queryInterface.addIndex('employees', ['facility_id']);
    await queryInterface.addIndex('employees', ['status']);
    await queryInterface.addIndex('employees', ['phone']);
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('employees', 'uq_employee_org_empno');
    await queryInterface.dropTable('employees');
  },
};
