// 📁 backend/src/models/DiscountPolicy.js
import { DataTypes, Model } from "sequelize";
import { DISCOUNT_TYPE, POLICY_APPLIES_TO, POLICY_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class DiscountPolicy extends Model {
    static associate(models) {
      // 🔹 Tenant Scope
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

      // 🔹 Lifecycle Audit
      DiscountPolicy.belongsTo(models.User, { as: "activatedBy", foreignKey: "activated_by_id" });
      DiscountPolicy.belongsTo(models.User, { as: "deactivatedBy", foreignKey: "deactivated_by_id" });
      DiscountPolicy.belongsTo(models.User, { as: "expiredBy", foreignKey: "expired_by_id" });

      // 🔹 Link to applied discounts
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

      // 📌 Identification
      code: { type: DataTypes.STRING(50), allowNull: false },
      name: { type: DataTypes.STRING(150), allowNull: false },
      description: { type: DataTypes.TEXT },

      // 📌 Discount definition
      discount_type: { type: DataTypes.ENUM(...DISCOUNT_TYPE), allowNull: false }, // percentage, fixed, waiver
      discount_value: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },

      // 📌 Applicability
      applies_to: {
        type: DataTypes.ENUM(...POLICY_APPLIES_TO), // all, billable_item, category, department, patient_class
        defaultValue: "all",
      },
      condition_json: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "Custom conditions (e.g. { patientType: 'staff', ward: 'maternity' })",
      },

      // 📌 Validity
      effective_from: { type: DataTypes.DATE },
      effective_to: { type: DataTypes.DATE },

      // 📌 Status
      status: {
        type: DataTypes.ENUM(...POLICY_STATUS), // active, inactive, expired
        allowNull: false,
        defaultValue: "active",
      },

      // 🔹 Tenant Scope
      organization_id: { type: DataTypes.UUID, allowNull: true },
      facility_id: { type: DataTypes.UUID, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },

      // 🔹 Lifecycle audit
      activated_by_id: { type: DataTypes.UUID, allowNull: true },
      activated_at: { type: DataTypes.DATE, allowNull: true },

      deactivated_by_id: { type: DataTypes.UUID, allowNull: true },
      deactivated_at: { type: DataTypes.DATE, allowNull: true },

      expired_by_id: { type: DataTypes.UUID, allowNull: true },
      expired_at: { type: DataTypes.DATE, allowNull: true },
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
        active: { where: { status: "active", deleted_at: null } },
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard superadmin
          return { where: { facility_id: facilityId } };
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
          if (this.discount_type === "percentage" && parseFloat(this.discount_value) > 100) {
            throw new Error("Percentage policy cannot exceed 100%");
          }
          if (this.discount_type === "fixed" && parseFloat(this.discount_value) < 0) {
            throw new Error("Fixed policy value must be non-negative");
          }
        },
      },
    }
  );

  return DiscountPolicy;
};
