// 📁 backend/src/models/DepartmentStock.js
import { DataTypes, Model } from "sequelize";
import { DEPARTMENT_STOCK_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class DepartmentStock extends Model {
    static associate(models) {
      DepartmentStock.belongsTo(models.MasterItem, { as: "masterItem", foreignKey: "master_item_id" });
      DepartmentStock.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      DepartmentStock.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      DepartmentStock.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      DepartmentStock.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      DepartmentStock.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      DepartmentStock.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  DepartmentStock.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Links
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID, allowNull: false },
      master_item_id: { type: DataTypes.UUID, allowNull: false },

      // 📦 Stock details
      batch_no: { type: DataTypes.STRING, allowNull: true },           // ✅ Added
      expiry_date: { type: DataTypes.DATEONLY, allowNull: true },      // ✅ Added
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      min_threshold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      max_threshold: { type: DataTypes.INTEGER, allowNull: true },
      status: {
        type: DataTypes.ENUM(...Object.values(DEPARTMENT_STOCK_STATUS)),
        allowNull: false,
        defaultValue: Object.values(DEPARTMENT_STOCK_STATUS)[0], // active
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "DepartmentStock",
      tableName: "department_stocks",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: { attributes: { exclude: ["deleted_at", "deleted_by_id"] } },
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { deleted_at: null } },
        tenant(facilityId) { return facilityId ? { where: { facility_id: facilityId } } : {}; },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["department_id"] },
        { fields: ["master_item_id"] },
        { fields: ["status"] },
        { fields: ["batch_no"] },       // ✅ Added for fast lookup
        { fields: ["expiry_date"] },    // ✅ Added for expiry tracking
      ],
      uniqueKeys: {
        unique_dept_item_batch: {      // ✅ Changed to allow multiple batches
          fields: ["organization_id", "facility_id", "department_id", "master_item_id", "batch_no"],
        },
      },
    }
  );

  // 🔁 Safeguards
  DepartmentStock.beforeSave((stock) => {
    if (stock.quantity < 0) throw new Error("Quantity cannot be negative");
    if (stock.min_threshold < 0) throw new Error("Min threshold cannot be negative");
    if (stock.max_threshold !== null && stock.max_threshold < stock.min_threshold) {
      throw new Error("Max threshold cannot be less than min threshold");
    }
  });

  return DepartmentStock;
};
