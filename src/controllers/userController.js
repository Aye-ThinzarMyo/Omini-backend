import { User } from "../database/models";
import sequelize from "../database/config/sequelize";
import { encrypt } from "../utils/encryption";
import {
  createChatwootAccountUser,
  createChatwootUser,
} from "../services/chatwoot";
import {
  createKeycloakUser,
  assignRealmRole,
  deleteKeycloakUser,
} from "../services/keycloak";

export const createUser = async (req, res) => {
  const { full_name, email, phone, department, role, password, accountId } =
    req.body;

  if (!full_name || !email || !password) {
    return res
      .status(400)
      .json({ error: "full_name, email, and password are required" });
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
    let chatwootRole;

    try {
      chatwootResult = await createChatwootUser({
        name: full_name,
        email,
        password,
      });
    } catch (err) {
      await t.rollback();
      return res.status(502).json({
        error: "Failed to create user in Chatwoot",
        detail: err.response?.data || err.message,
      });
    }

    const { chatwootId, apiKey } = chatwootResult;
    const normalizedRole =
      role?.toLowerCase() === "admin" || role?.toLowerCase() === "administrator"
        ? "administrator"
        : "agent";
    try {
      chatwootRole = await createChatwootAccountUser({
        user_id: chatwootId,
        role: normalizedRole,
        accountId,
      });
    } catch (err) {
      await t.rollback();
      return res.status(502).json({
        error: "Failed to create user in Chatwoot",
        detail: err.response?.data || err.message,
      });
    }
    const encryptedApiKey = encrypt(apiKey);
    const encryptedPassword = encrypt(password);
    const { resultRole } = chatwootRole;
    let keycloakId;

    try {
      keycloakId = await createKeycloakUser({
        name: full_name.replaceAll(" ", "").toLowerCase(),
        email,
        password,
        department,
        role: resultRole,
      });
      if (resultRole) {
        await assignRealmRole(keycloakId, resultRole);
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
        id: keycloakId,
        full_name,
        email,
        phone: phone || null,
        department: department || null,
        role: resultRole || "Agent",
        chat_admin_user_id: chatwootId,
        encrypted_chat_secret: encryptedApiKey,
        password: encryptedPassword,
      },
      { transaction: t },
    );

    await t.commit();

    const userData = user.toJSON();
    delete userData.encrypted_chat_secret;
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
