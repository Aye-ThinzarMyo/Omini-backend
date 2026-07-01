import { User } from "../database/models";
import sequelize from "../database/config/sequelize";
import { encrypt } from "../utils/encryption";
import { createChatwootUser } from "../services/chatwoot";
import {
  createKeycloakUser,
  assignRealmRole,
  deleteKeycloakUser,
} from "../services/keycloak";

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["chat_key", "password"] },
      order: [["created_at", "DESC"]],
    });
    res.json({ users });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch users", detail: err.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = isNaN(id) ? null : parseInt(id);

    const user = numericId
      ? await User.findByPk(numericId, {
        attributes: { exclude: ["chat_key", "password"] },
        })
      : await User.findOne({
          where: { email: id },
          attributes: { exclude: ["chat_key", "password"] },
        });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch user", detail: err.message });
  }
};

export const createUser = async (req, res) => {
  const { name, email, phone, department, role, password } =
    req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "name, email, and password are required" });
  }

  const t = await sequelize.transaction();

  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      await t.rollback();
      return res
        .status(409)
        .json({ error: "User with this email already exists" });
    }

    let chatwootResult;
    try {
      chatwootResult = await createChatwootUser({ name, email, password });
    } catch (err) {
      await t.rollback();
      return res.status(502).json({
        error: "Failed to create user in Chatwoot",
        detail: err.response?.data || err.message,
      });
    }

    const { chatwootId, apiKey } = chatwootResult;
    const encryptedApiKey = encrypt(apiKey);
    const encryptedPassword = encrypt(password);

    let keycloakId;
    try {
      keycloakId = await createKeycloakUser({ name, email, password });
      if (role) {
        await assignRealmRole(keycloakId, role);
      }
    } catch (err) {
      await t.rollback();
      return res.status(502).json({
        error: "Failed to create user in Keycloak",
        detail: err.response?.data || err.message,
      });
    }

    const user = await User.create(
      {
        name,
        email,
        phone: phone || null,
        department: department || null,
        role: role || "Agent",
        chat_id: chatwootId,
        chat_key: encryptedApiKey,
        login_id: keycloakId,
        password: encryptedPassword,
      },
      { transaction: t },
    );

    await t.commit();

    const userData = user.toJSON();
    delete userData.chat_key;
    delete userData.password;

    res.status(201).json({
      user: userData,
      message: "User created in Chatwoot, Keycloak, and database",
    });
  } catch (err) {
    await t.rollback();
    console.error("User creation failed:", err);
    res
      .status(500)
      .json({ error: "Failed to create user", detail: err.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, department, role, status } = req.body;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    await user.update({
      name: name || user.name,
      email: email || user.email,
      phone: phone !== undefined ? phone : user.phone,
      department: department !== undefined ? department : user.department,
      role: role || user.role,
      status: status || user.status,
    });

    res.json({ message: "User updated" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to update user", detail: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.login_id) {
      try {
        await deleteKeycloakUser(user.login_id);
      } catch (err) {
        console.warn("Failed to delete Keycloak user:", err.message);
      }
    }

    await user.destroy();

    res.json({ message: "User deleted from database and Keycloak" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to delete user", detail: err.message });
  }
};



export const getUserApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.chat_key) {
      return res.status(404).json({ error: "No API key found for this user" });
    }

    const { decrypt } = await import("../utils/encryption");
    const apiKey = decrypt(user.chat_key);
    res.json({ apiKey });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to get API key", detail: err.message });
  }
};
