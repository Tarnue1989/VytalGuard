import { DataTypes, Model } from "sequelize";
import { NEWBORN_STATUS, GENDER_TYPES } from "../constants/enums.js";

export default (sequelize) => {
  class NewbornRecord extends Model {
    static associate(models) {
      // 🔗 Mother & Delivery
      NewbornRecord.belongsTo(models.Patient, {
        as: "mother",
        foreignKey: "mother_id",
      });
      NewbornRecord.belongsTo(models.DeliveryRecord, {
        as: "deliveryRecord",
        foreignKey: "delivery_record_id",
      });

      // Org / Facility
      NewbornRecord.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      NewbornRecord.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🆕 Transfer facility
      NewbornRecord.belongsTo(models.Facility, {
        as: "transferFacility",
        foreignKey: "transfer_facility_id",
      });

      // Audit
      NewbornRecord.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });
      NewbornRecord.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });
      NewbornRecord.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });

      // 🆕 Voided by
      NewbornRecord.belongsTo(models.User, {
        as: "voidedBy",
        foreignKey: "voided_by_id",
      });
    }
  }

  NewbornRecord.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Links
      mother_id: { type: DataTypes.UUID, allowNull: false },
      delivery_record_id: { type: DataTypes.UUID, allowNull: false },

      // 👶 Baby details
      gender: { type: DataTypes.ENUM(...GENDER_TYPES), allowNull: false },

      birth_weight: { type: DataTypes.DECIMAL(5, 2) }, // e.g., 3.45 kg
      birth_length: { type: DataTypes.DECIMAL(5, 2) }, // cm
      head_circumference: { type: DataTypes.DECIMAL(5, 2) }, // cm
      apgar_score_1min: { type: DataTypes.INTEGER }, // 0-10
      apgar_score_5min: { type: DataTypes.INTEGER }, // 0-10

      measurement_notes: { type: DataTypes.TEXT },

      complications: { type: DataTypes.TEXT },
      notes: { type: DataTypes.TEXT },

      // 🚼 Lifecycle
      status: {
        type: DataTypes.ENUM(...NEWBORN_STATUS),
        allowNull: false,
        defaultValue: "alive",
      },

      // 🚼 Lifecycle details
      death_reason: { type: DataTypes.TEXT },
      death_time: { type: DataTypes.DATE },

      transfer_reason: { type: DataTypes.TEXT },
      transfer_facility_id: { type: DataTypes.UUID },
      transfer_time: { type: DataTypes.DATE },

      void_reason: { type: DataTypes.TEXT },
      voided_by_id: { type: DataTypes.UUID },
      voided_at: { type: DataTypes.DATE },

      // 🕵🏽 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "NewbornRecord",
      tableName: "newborn_records",
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
        { fields: ["organization_id"], name: "idx_newborn_records_org" },
        { fields: ["facility_id"], name: "idx_newborn_records_facility" },
        { fields: ["mother_id"], name: "idx_newborn_records_mother_id" },
        { fields: ["delivery_record_id"], name: "idx_newborn_records_delivery_record_id" },
        { fields: ["status"], name: "idx_newborn_records_status" },
        { fields: ["gender"], name: "idx_newborn_records_gender" },
      ],
    }
  );

  return NewbornRecord;
};
