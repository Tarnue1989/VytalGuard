// 📁 backend/src/models/Patient.js
import { DataTypes, Model } from "sequelize";
import {
  GENDER_TYPES,
  REGISTRATION_LOG_STATUS,
  REGISTRATION_METHODS,
  MARITAL_STATUS,
  RELIGIONS,
  DOB_PRECISION,
} from "../constants/enums.js";

export default (sequelize) => {
  class Patient extends Model {
    static associate(models) {
      // 1️⃣ Clinical Records
      Patient.hasMany(models.Vital, { foreignKey: "patient_id", as: "vitals" });
      Patient.hasMany(models.TriageRecord, { foreignKey: "patient_id", as: "triage_records" });
      Patient.hasMany(models.Consultation, { foreignKey: "patient_id", as: "consultations" });
      Patient.hasMany(models.Admission, { foreignKey: "patient_id", as: "admissions" });
      Patient.hasMany(models.MedicalRecord, { foreignKey: "patient_id", as: "medical_records" });
      Patient.hasMany(models.MaternityVisit, { foreignKey: "patient_id", as: "maternity_visits" });
      Patient.hasMany(models.RegistrationLog, { foreignKey: "patient_id", as: "registration_logs" });

      // 2️⃣ Messaging
      Patient.hasMany(models.Message, {
        foreignKey: "sender_id",
        as: "sent_messages",
        constraints: false,
      });
      Patient.hasMany(models.Message, {
        foreignKey: "receiver_id",
        as: "received_messages",
        constraints: false,
      });

      // 3️⃣ Registrar
      Patient.belongsTo(models.Employee, {
        as: "registeredBy",
        foreignKey: "employee_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // 4️⃣ Org / Facility scope
      Patient.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Patient.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 5️⃣ Audit
      Patient.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Patient.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Patient.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }

    // 🔹 Virtual computed fields
    get full_name() {
      return [this.first_name, this.middle_name, this.last_name].filter(Boolean).join(" ");
    }

    get age() {
      if (!this.date_of_birth) return null;
      const dob = new Date(this.date_of_birth);
      const diff = Date.now() - dob.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }
  }

  Patient.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🆔 Core details
      pat_no: { type: DataTypes.STRING(50), allowNull: false },
      first_name: { type: DataTypes.STRING(120), allowNull: false },
      middle_name: { type: DataTypes.STRING(120), allowNull: true },
      last_name: { type: DataTypes.STRING(120), allowNull: false },

      // ✅ FIXED: HARD DATE-ONLY GUARANTEE
      date_of_birth: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        set(value) {
          if (!value) {
            this.setDataValue("date_of_birth", null);
            return;
          }

          const d = new Date(value);
          if (isNaN(d.getTime())) {
            this.setDataValue("date_of_birth", null);
            return;
          }

          // 🔒 Force YYYY-MM-DD only (NO time ever)
          this.setDataValue("date_of_birth", d.toISOString().split("T")[0]);
        },
      },

      date_of_birth_precision: { type: DataTypes.ENUM(...DOB_PRECISION), allowNull: true },
      gender: { type: DataTypes.ENUM(...GENDER_TYPES), allowNull: true },

      // 📞 Contact info
      phone_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: { is: /^[0-9+\-\s()]*$/ },
      },
      email_address: {
        type: DataTypes.STRING(120),
        allowNull: true,
        validate: { isEmail: true },
      },
      home_address: { type: DataTypes.STRING(255), allowNull: true },

      // 👤 Social
      marital_status: { type: DataTypes.ENUM(...MARITAL_STATUS), allowNull: true },
      religion: { type: DataTypes.ENUM(...RELIGIONS), allowNull: true },
      profession: { type: DataTypes.STRING(120), allowNull: true },

      // 🆔 Secondary identifiers
      national_id: { type: DataTypes.STRING(50), allowNull: true },
      insurance_number: { type: DataTypes.STRING(50), allowNull: true },
      passport_number: { type: DataTypes.STRING(50), allowNull: true },

      // 🚨 Emergency contacts
      emergency_contacts: { type: DataTypes.JSONB, allowNull: true },

      // 📝 Registration
      registration_status: {
        type: DataTypes.ENUM(...REGISTRATION_LOG_STATUS),
        allowNull: false,
        defaultValue: "active",
      },

      source_of_registration: { type: DataTypes.ENUM(...REGISTRATION_METHODS), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },

      // 📷 Media
      qr_code_path: { type: DataTypes.STRING(255), allowNull: true },
      photo_path: { type: DataTypes.STRING(255), allowNull: true },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: true },
      employee_id: { type: DataTypes.UUID, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Patient",
      tableName: "patients",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { deleted_at: null } },
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id", "pat_no"], unique: true },
        { fields: ["organization_id", "phone_number"], unique: true },
        { fields: ["organization_id", "email_address"], unique: true },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["national_id"] },
      ],
    }
  );

  return Patient;
};
