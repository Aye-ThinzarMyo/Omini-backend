import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize";

const Log = sequelize.define(
  "Log",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    agentId: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    targetType: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    targetId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "logs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Log;
