import { DataTypes } from 'sequelize';
import sequelize from '../config/sequelize';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  department: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'Agent',
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'Active',
  },
  chatwoot_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  chatwoot_api_key_encrypted: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  keycloak_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  password: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default User;
