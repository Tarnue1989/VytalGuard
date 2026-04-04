// 📁 backend/src/models/Room.js
import { DataTypes, Model } from "sequelize";
import { ROOM_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Room extends Model {
    static associate(models) {
      // Org / Facility
      Room.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Room.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Ward
      Room.belongsTo(models.Ward, { as: "ward", foreignKey: "ward_id" });

      // Beds
      Room.hasMany(models.Bed, { as: "beds", foreignKey: "room_id" });

      // Audit
      Room.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Room.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Room.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Room.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      ward_id: { type: DataTypes.UUID, allowNull: false },

      room_number: { type: DataTypes.STRING(50), allowNull: false },
      description: { type: DataTypes.TEXT },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(ROOM_STATUS)),
        allowNull: false,
        defaultValue: ROOM_STATUS.ACTIVE,
      },
      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Room",
      tableName: "rooms",
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

        // 🔑 Tenant scope → required for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard superadmin case
          return { where: { facility_id: facilityId } };
        },
      },      
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["ward_id"] },
        { fields: ["room_number"] },
        { fields: ["status"] },
      ],
      uniqueKeys: {
        unique_room_per_ward: {
          fields: ["organization_id", "facility_id", "ward_id", "room_number"],
        },
      },
    }
  );

  return Room;
};
