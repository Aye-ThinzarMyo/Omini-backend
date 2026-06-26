import { Permission, UserPermission, User } from '../database/models';

export const getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.findAll({
      order: [['category', 'ASC'], ['label', 'ASC']],
    });
    res.json({ permissions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch permissions', detail: err.message });
  }
};

export const getMyPermissions = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) return res.status(401).json({ error: 'User email not found' });

    const user = await User.findOne({
      where: { email },
      attributes: ['id', 'name', 'email', 'role', 'status'],
    });

    if (!user) {
      return res.json({ permissions: {}, user: null });
    }

    const userPerms = await UserPermission.findAll({ where: { user_id: user.id } });
    const allPerms = await Permission.findAll();

    const permissions = {};
    allPerms.forEach((p) => { permissions[p.key] = false; });
    userPerms.forEach((up) => { permissions[up.permission_key] = up.enabled; });

    res.json({ permissions, user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch permissions', detail: err.message });
  }
};

export const updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const t = await sequelize.transaction();
    try {
      await UserPermission.destroy({ where: { user_id: userId }, transaction: t });

      if (permissions && typeof permissions === 'object') {
        for (const [key, value] of Object.entries(permissions)) {
          await UserPermission.create({
            user_id: userId, permission_key: key, enabled: value === true,
          }, { transaction: t });
        }
      }

      await t.commit();
      res.json({ message: 'Permissions updated' });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update permissions', detail: err.message });
  }
};
