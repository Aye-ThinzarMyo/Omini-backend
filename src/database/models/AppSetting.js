import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize";

// Simple key/value settings store (e.g. for scheduling markers).
const AppSetting = sequelize.define(
  "AppSetting",
  {
    key: { type: DataTypes.STRING(100), primaryKey: true },
    value: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "app_settings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default AppSetting;
