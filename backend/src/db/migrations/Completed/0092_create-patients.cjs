// 📁 backend/src/db/migrations/0033_create-patients.cjs
"use strict";

const { DataTypes, Op } = require("sequelize"); // ⬅️ include Op here
const {
  GENDER_TYPES,
  REGISTRATION_LOG_STATUS,
  REGISTRATION_METHODS,
  MARITAL_STATUS,
  RELIGIONS,
  DOB_PRECISION,
} = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("patients", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🆔 Core details
      pat_no: { type: DataTypes.STRING(50), allowNull: false },
      first_name: { type: DataTypes.STRING(120), allowNull: false },
      middle_name: { type: DataTypes.STRING(120) },
      last_name: { type: DataTypes.STRING(120), allowNull: false },
      date_of_birth: { type: DataTypes.DATEONLY },
      date_of_birth_precision: { type: DataTypes.ENUM(...DOB_PRECISION) },
      gender: { type: DataTypes.ENUM(...GENDER_TYPES) },

      // 📞 Contact info
      phone_number: { type: DataTypes.STRING(50) },
      email_address: { type: DataTypes.STRING(120) },
      home_address: { type: DataTypes.STRING(255) },

      // 👤 Social
      marital_status: { type: DataTypes.ENUM(...MARITAL_STATUS) },
      religion: { type: DataTypes.ENUM(...RELIGIONS) },
      profession: { type: DataTypes.STRING(120) },

      // 🆔 Secondary identifiers
      national_id: { type: DataTypes.STRING(50) },
      insurance_number: { type: DataTypes.STRING(50) },
      passport_number: { type: DataTypes.STRING(50) },

      // 🚨 Emergency contacts (JSONB → multiple entries)
      emergency_contacts: { type: DataTypes.JSONB },

      // 📝 Registration snapshot
      registration_status: { type: DataTypes.ENUM(...REGISTRATION_LOG_STATUS) },
      source_of_registration: { type: DataTypes.ENUM(...REGISTRATION_METHODS) },
      notes: { type: DataTypes.TEXT },

      // 📷 Media
      qr_code_path: { type: DataTypes.STRING(255) },
      photo_path: { type: DataTypes.STRING(255) },

      // 🔗 Tenant scope
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      facility_id: {
        type: DataTypes.UUID,
        references: { model: "facilities", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      employee_id: {
        type: DataTypes.UUID,
        references: { model: "employees", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      // 🔹 Audit
      created_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      updated_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      deleted_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      // 🕒 Timestamps (paranoid)
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE },
    });

    // 🔎 Explicit indexes
    await queryInterface.addIndex("patients", ["organization_id", "pat_no"], {
      unique: true,
      name: "uq_patients_org_pat_no",
    });
    await queryInterface.addIndex("patients", ["organization_id", "phone_number"], {
      unique: true,
      name: "uq_patients_org_phone",
      where: { phone_number: { [Op.ne]: null } }, // ✅ fixed
    });
    await queryInterface.addIndex("patients", ["organization_id", "email_address"], {
      unique: true,
      name: "uq_patients_org_email",
      where: { email_address: { [Op.ne]: null } }, // ✅ fixed
    });
    await queryInterface.addIndex("patients", ["organization_id"], { name: "idx_patients_org_id" });
    await queryInterface.addIndex("patients", ["facility_id"], { name: "idx_patients_facility_id" });
    await queryInterface.addIndex("patients", ["national_id"], { name: "idx_patients_national_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("patients");
    // Cleanup enums (Postgres)
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patients_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patients_marital_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patients_religion";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patients_date_of_birth_precision";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patients_registration_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_patients_source_of_registration";');
  },
};
