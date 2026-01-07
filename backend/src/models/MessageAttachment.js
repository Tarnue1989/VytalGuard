import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class MessageAttachment extends Model {
    static associate(models) {
      // 🔹 Belongs to parent message
      MessageAttachment.belongsTo(models.Message, {
        foreignKey: "message_id",
        as: "message",
      });

      // 🔹 Audit relationships
      MessageAttachment.belongsTo(models.User, {
        foreignKey: "created_by",
        as: "createdByUser",
      });
      MessageAttachment.belongsTo(models.User, {
        foreignKey: "updated_by",
        as: "updatedByUser",
      });
      MessageAttachment.belongsTo(models.User, {
        foreignKey: "deleted_by",
        as: "deletedByUser",
      });
    }
  }

  MessageAttachment.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      message_id: { type: DataTypes.UUID, allowNull: false },

      // File metadata
      file_name: { type: DataTypes.STRING, allowNull: false },
      file_type: { type: DataTypes.STRING, allowNull: false },
      file_size: { type: DataTypes.INTEGER, allowNull: false },
      file_path: { type: DataTypes.STRING, allowNull: false },

      // Audit fields
      created_by: { type: DataTypes.UUID },
      updated_by: { type: DataTypes.UUID },
      deleted_by: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "MessageAttachment",
      tableName: "message_attachments",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
        byMessage(messageId) {
          return { where: { message_id: messageId } };
        },
      },
      indexes: [{ fields: ["message_id"] }, { fields: ["created_at"] }],
    }
  );

  return MessageAttachment;
};
