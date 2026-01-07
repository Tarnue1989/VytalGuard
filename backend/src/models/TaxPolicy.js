// 📁 backend/src/models/TaxPolicy.js
import { DataTypes, Model } from "sequelize";
import { POLICY_APPLIES_TO, POLICY_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class TaxPolicy extends Model {
    static associate(models) {
      // 🔹 Tenant Scope
      TaxPolicy.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      TaxPolicy.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Link to tax definition (base tax catalog if needed)
      TaxPolicy.belongsTo(models.Tax, { as: "tax", foreignKey: "tax_id" });

      // 🔹 Audit
      TaxPolicy.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      TaxPolicy.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      TaxPolicy.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  TaxPolicy.init(
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

      // 📌 Linked tax
      tax_id: { type: DataTypes.UUID, allowNull: false },

      // 📌 Applicability
      applies_to: {
        type: DataTypes.ENUM(...POLICY_APPLIES_TO), // all, billable_item, category, department, patient_class
        defaultValue: "all",
      },
      condition_json: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: "Custom conditions (e.g. { patientType: 'private', ward: 'maternity' })",
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
    },
    {
      sequelize,
      modelName: "TaxPolicy",
      tableName: "tax_policies",
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
        { fields: ["code"], unique: true, name: "uq_tax_policy_code" },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["status"] },
        { fields: ["tax_id"] },
      ],
    }
  );

  return TaxPolicy;
};
