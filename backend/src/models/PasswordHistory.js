// 📁 models/PasswordHistory.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class PasswordHistory extends Model {
    static associate(models) {
      // Each history entry belongs to a User
      PasswordHistory.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
        onDelete: "CASCADE",
      });
    }
  }

  PasswordHistory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: "PasswordHistory",
      tableName: "password_history",
      timestamps: false, // we only need created_at
      underscored: true,
    }
  );

  return PasswordHistory;
};
