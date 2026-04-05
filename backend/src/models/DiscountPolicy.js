// 📁 backend/src/models/DiscountPolicy.js
import { DataTypes, Model } from "sequelize";
import {
  DISCOUNT_TYPE,
  POLICY_APPLIES_TO,
  POLICY_STATUS,
} from "../constants/enums.js";

export default (sequelize) => {
  class DiscountPolicy extends Model {
    static associate(models) {
      // 🔹 Tenant
      DiscountPolicy.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      DiscountPolicy.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Audit
      DiscountPolicy.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      DiscountPolicy.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      DiscountPolicy.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      // 🔹 Lifecycle
      DiscountPolicy.belongsTo(models.User, { as: "activatedBy", foreignKey: "activated_by_id" });
      DiscountPolicy.belongsTo(models.User, { as: "deactivatedBy", foreignKey: "deactivated_by_id" });
      DiscountPolicy.belongsTo(models.User, { as: "expiredBy", foreignKey: "expired_by_id" });

      // 🔹 Applied discounts
      DiscountPolicy.hasMany(models.Discount, {
        as: "discounts",
        foreignKey: "discount_policy_id",
      });
    }
  }

  DiscountPolicy.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 📌 Identity
      code: { type: DataTypes.STRING(50), allowNull: false },
      name: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT },

      // 📌 Discount logic
      discount_type: {
        type: DataTypes.ENUM(...Object.values(DISCOUNT_TYPE)),
        allowNull: false,
      },

      discount_value: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },

      // 📌 Status
      status: {
        type: DataTypes.ENUM(...Object.values(POLICY_STATUS)),
        allowNull: false,
        defaultValue: POLICY_STATUS.ACTIVE,
      },

      // 📌 Applicability
      applies_to: {
        type: DataTypes.ENUM(...Object.values(POLICY_APPLIES_TO)),
        allowNull: false,
        defaultValue: POLICY_APPLIES_TO.ALL,
      },

      condition_json: {
        type: DataTypes.JSONB,
        allowNull: true,
      },

      // 📌 Validity
      effective_from: { type: DataTypes.DATE },
      effective_to: { type: DataTypes.DATE },

      // 🔹 Tenant
      organization_id: { type: DataTypes.UUID, allowNull: true },
      facility_id: { type: DataTypes.UUID, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },

      // 🔹 Lifecycle tracking
      activated_by_id: { type: DataTypes.UUID },
      activated_at: { type: DataTypes.DATE },

      deactivated_by_id: { type: DataTypes.UUID },
      deactivated_at: { type: DataTypes.DATE },

      expired_by_id: { type: DataTypes.UUID },
      expired_at: { type: DataTypes.DATE },
    },
    {
      sequelize,
      modelName: "DiscountPolicy",
      tableName: "discount_policies",
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

        active: {
          where: {
            status: POLICY_STATUS.ACTIVE,
            deleted_at: null,
          },
        },

        tenant(facilityId) {
          return facilityId ? { where: { facility_id: facilityId } } : {};
        },
      },

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["code"], unique: true },
        { fields: ["status"] },
        { fields: ["effective_from", "effective_to"] },
      ],

      validate: {
        validDiscountValue() {
          if (
            this.discount_type === DISCOUNT_TYPE.PERCENTAGE &&
            parseFloat(this.discount_value) > 100
          ) {
            throw new Error("Percentage policy cannot exceed 100%");
          }

          if (
            this.discount_type === DISCOUNT_TYPE.FIXED &&
            parseFloat(this.discount_value) < 0
          ) {
            throw new Error("Fixed policy value must be non-negative");
          }
        },

        validDateRange() {
          if (
            this.effective_from &&
            this.effective_to &&
            this.effective_from > this.effective_to
          ) {
            throw new Error("effective_from cannot be after effective_to");
          }
        },
      },
    }
  );

  return DiscountPolicy;
};