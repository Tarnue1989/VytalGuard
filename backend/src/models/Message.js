import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class Message extends Model {
    static associate(models) {
      // 🔹 Employee ↔ Message
      Message.belongsTo(models.Employee, {
        foreignKey: "sender_id",
        constraints: false,
        as: "sender_employee",
      });

      Message.belongsTo(models.Employee, {
        foreignKey: "receiver_id",
        constraints: false,
        as: "receiver_employee",
      });

      // 🔹 Patient ↔ Message
      Message.belongsTo(models.Patient, {
        foreignKey: "sender_id",
        constraints: false,
        as: "sender_patient",
      });

      Message.belongsTo(models.Patient, {
        foreignKey: "receiver_id",
        constraints: false,
        as: "receiver_patient",
      });

      // 🔹 Attachments
      Message.hasMany(models.MessageAttachment, {
        foreignKey: "message_id",
        as: "attachments",
      });

      // 🔹 Conversation
      Message.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
      });

      // 🔹 Audit trail
      Message.belongsTo(models.User, { foreignKey: "created_by", as: "createdByUser" });
      Message.belongsTo(models.User, { foreignKey: "updated_by", as: "updatedByUser" });
      Message.belongsTo(models.User, { foreignKey: "deleted_by", as: "deletedByUser" });
    }
  }

  Message.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      conversation_id: { type: DataTypes.UUID, allowNull: false },
      sender_id: { type: DataTypes.UUID, allowNull: false },
      sender_role: { type: DataTypes.ENUM("employee", "patient"), allowNull: false },
      receiver_id: { type: DataTypes.UUID, allowNull: false },
      receiver_role: { type: DataTypes.ENUM("employee", "patient"), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      message_type: { type: DataTypes.ENUM("text", "image", "file"), defaultValue: "text" },
      chat_type: { type: DataTypes.ENUM("internal", "clinical", "helpdesk"), defaultValue: "internal" },
      is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
      read_at: { type: DataTypes.DATE },
      deleted_by_sender: { type: DataTypes.BOOLEAN, defaultValue: false },
      deleted_by_receiver: { type: DataTypes.BOOLEAN, defaultValue: false },
      created_by: { type: DataTypes.UUID },
      updated_by: { type: DataTypes.UUID },
      deleted_by: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Message",
      tableName: "messages",
      paranoid: true,
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by"] },
      },
      scopes: {
        withDeleted: { paranoid: false },
        byConversation(conversationId) {
          return { where: { conversation_id: conversationId } };
        },
        bySender(senderId) {
          return { where: { sender_id: senderId } };
        },
        byReceiver(receiverId) {
          return { where: { receiver_id: receiverId } };
        },
        unread: { where: { is_read: false } },
      },
      indexes: [
        { fields: ["conversation_id"] },
        { fields: ["created_at"] },
        { fields: ["receiver_id", "receiver_role"] },
      ],
    }
  );

  return Message;
};
