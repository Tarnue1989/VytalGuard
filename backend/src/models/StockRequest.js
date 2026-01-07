// 📁 backend/src/models/StockRequest.js
import { DataTypes, Model } from "sequelize";
import { STOCK_REQUEST_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class StockRequest extends Model {
    static associate(models) {
      // 🔹 Department that made the request
      StockRequest.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });

      // 🔹 Tenant scope
      StockRequest.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      StockRequest.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Items
      StockRequest.hasMany(models.StockRequestItem, {
        as: "items",
        foreignKey: "stock_request_id",
        onDelete: "CASCADE",   // ✅ ensures children are cleaned up
        hooks: true,
      });

      // 🔹 Audit
      StockRequest.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      StockRequest.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      StockRequest.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      // 🔹 Lifecycle actors
      StockRequest.belongsTo(models.User, { as: "approvedBy", foreignKey: "approved_by_id" });
      StockRequest.belongsTo(models.User, { as: "rejectedBy", foreignKey: "rejected_by_id" });
      StockRequest.belongsTo(models.User, { as: "issuedBy", foreignKey: "issued_by_id" });
      StockRequest.belongsTo(models.User, { as: "fulfilledBy", foreignKey: "fulfilled_by_id" });
    }
  }

  StockRequest.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID, allowNull: false },

      // 📑 Request metadata
      reference_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,   // ✅ unique ref across requests
      },
      status: {
        type: DataTypes.ENUM(...Object.values(STOCK_REQUEST_STATUS)),
        allowNull: false,
        defaultValue: Object.values(STOCK_REQUEST_STATUS)[0], // draft
      },
      notes: { type: DataTypes.TEXT },

      // ⏱️ Lifecycle
      approved_by_id: { type: DataTypes.UUID },
      approved_at: { type: DataTypes.DATE },
      rejected_by_id: { type: DataTypes.UUID },
      rejected_at: { type: DataTypes.DATE },
      rejection_reason: { type: DataTypes.TEXT },

      issued_by_id: { type: DataTypes.UUID },
      issued_at: { type: DataTypes.DATE },
      issue_notes: { type: DataTypes.TEXT },

      fulfilled_by_id: { type: DataTypes.UUID },
      fulfilled_at: { type: DataTypes.DATE },
      fulfillment_notes: { type: DataTypes.TEXT },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "StockRequest",
      tableName: "stock_requests",
      underscored: true,
      paranoid: true, // ✅ soft delete
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
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["department_id"] },
        { fields: ["status"] },
        { fields: ["reference_number"], unique: true },
      ],
    }
  );

  /* ============================================================
     🔁 Hooks → enforce lifecycle consistency
  ============================================================ */
  StockRequest.beforeUpdate((request) => {
    if (request.status === "approved" && !request.approved_by_id) {
      throw new Error("Approved requests must have approved_by_id set");
    }
    if (request.status === "rejected" && !request.rejected_by_id) {
      throw new Error("Rejected requests must have rejected_by_id set");
    }
    if (request.status === "issued" && !request.issued_by_id) {
      throw new Error("Issued requests must have issued_by_id set");
    }
    if (request.status === "fulfilled" && !request.fulfilled_by_id) {
      throw new Error("Fulfilled requests must have fulfilled_by_id set");
    }
  });

  return StockRequest;
};
