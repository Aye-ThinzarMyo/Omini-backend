import User from './User';
import Permission from './Permission';
import UserPermission from './UserPermission';

User.belongsToMany(Permission, {
  through: UserPermission,
  foreignKey: 'user_id',
  otherKey: 'permission_key',
});

Permission.belongsToMany(User, {
  through: UserPermission,
  foreignKey: 'permission_key',
  otherKey: 'user_id',
});

User.hasMany(UserPermission, { foreignKey: 'user_id' });
UserPermission.belongsTo(User, { foreignKey: 'user_id' });

Permission.hasMany(UserPermission, { foreignKey: 'permission_key' });
UserPermission.belongsTo(Permission, { foreignKey: 'permission_key' });

export { User, Permission, UserPermission };
