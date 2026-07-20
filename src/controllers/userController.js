import jwt from "jsonwebtoken";
import { User } from "../database/models";
import sequelize from "../database/config/sequelize";
import { encrypt, decrypt } from "../utils/encryption";
import {
  createChatwootAccountUser,
  createChatwootUser,
  addInboxMember,
  updateChatwootUserPlatform,
} from "../services/chatwoot";
import {
  createKeycloakUser,
  assignRealmRole,
  deleteKeycloakUser,
  updateKeycloakUser,
  resetKeycloakPassword,
} from "../services/keycloak";

export const createUser = async (req, res) => {
  const {
    full_name,
    email,
    phone,
    department,
    role,
    password,
    accountId,
    inbox_id,
  } = req.body;

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
      role?.toLowerCase() === "admin" ||
      role?.toLowerCase() === "administrator" ||
      role?.toLowerCase() === "superadmin"
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
    if (inbox_id) {
      try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
          await t.rollback();
          return res.status(401).json({ error: "No Bearer token provided" });
        }
        const decoded = jwt.decode(token);
        const keycloakId = decoded?.sub;
        if (!keycloakId) {
          await t.rollback();
          return res.status(401).json({ error: "Invalid token: no sub claim" });
        }
        const adminUser = await User.findByPk(keycloakId);
        if (!adminUser || !adminUser.encrypted_chat_secret) {
          await t.rollback();
          return res
            .status(403)
            .json({ error: "No Chatwoot API key found for your account" });
        }
        const adminToken = decrypt(adminUser.encrypted_chat_secret);

        const inboxIds = Array.isArray(inbox_id) ? inbox_id : [inbox_id];
        for (const id of inboxIds) {
          await addInboxMember(accountId, id, [chatwootId], adminToken);
        }
        console.log("done add inbox member");
      } catch (err) {
        await t.rollback();
        return res.status(502).json({
          error: "Failed to add agent to inbox",
          detail: err.response?.data || err.message,
        });
      }
    }

    let keycloakId;

    try {
      keycloakId = await createKeycloakUser({
        name: full_name.replaceAll(" ", "").toLowerCase(),
        email,
        password,
        department,
        role: resultRole,
        fullname: full_name,
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

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const {
    full_name,
    email,
    password,
    role,
    department,
    phone,
    accountId,
    inbox_id,
  } = req.body;

  try {
    const user = await User.findOne({ where: { chat_admin_user_id: id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates = {};
    const chatwootPayload = {};

    if (full_name) {
      chatwootPayload.name = full_name;
      updates.full_name = full_name;
    }
    if (email) {
      chatwootPayload.email = email;
      updates.email = email;
    }
    if (password) {
      chatwootPayload.password = password;
    }
    if (phone) updates.phone = phone;
    if (department) updates.department = department;

    // Update Chatwoot user via platform API (name, email, password)
    let newApiKey;
    if (Object.keys(chatwootPayload).length > 0) {
      const result = await updateChatwootUserPlatform(id, chatwootPayload);
      if (result?.access_token) {
        newApiKey = result.access_token;
      }
    }

    let normalizedRole;
    if (role) {
      normalizedRole =
        role?.toLowerCase() === "admin" ||
        role?.toLowerCase() === "administrator"
          ? "administrator"
          : "agent";
    }

    // Assign role via platform API
    if (normalizedRole && accountId) {
      await createChatwootAccountUser({
        user_id: Number(id),
        role: normalizedRole,
        accountId,
      });
      updates.role = normalizedRole;
    }

    // If agent role and inbox_id provided, add to inbox
    if (normalizedRole === "agent" && inbox_id && accountId) {
      const adminUser = await User.findByPk(req.user.sub);
      if (adminUser?.encrypted_chat_secret) {
        const adminToken = decrypt(adminUser.encrypted_chat_secret);
        const inboxIds = Array.isArray(inbox_id) ? inbox_id : [inbox_id];
        for (const iId of inboxIds) {
          await addInboxMember(accountId, iId, [Number(id)], adminToken);
        }
      }
    }

    // Update Keycloak
    const keycloakPayload = {};
    if (email) keycloakPayload.email = email;
    if (full_name) {
      keycloakPayload.name = full_name.replaceAll(" ", "").toLowerCase();
      keycloakPayload.fullname = full_name;
    }
    if (department) keycloakPayload.department = department;
    if (normalizedRole) keycloakPayload.role = normalizedRole;
    if (Object.keys(keycloakPayload).length > 0) {
      await updateKeycloakUser(user.id, keycloakPayload);
    }

    // Reset password in Keycloak
    if (password) {
      await resetKeycloakPassword(user.id, password);
      updates.password = encrypt(password);
    }

    // Update encrypted_chat_secret if new api key returned
    if (newApiKey) {
      updates.encrypted_chat_secret = encrypt(newApiKey);
    }

    await user.update(updates);

    const userData = user.toJSON();
    delete userData.encrypted_chat_secret;
    delete userData.password;

    res.json({ user: userData, message: "User updated" });
  } catch (err) {
    console.error("User update failed:", err);
    res
      .status(500)
      .json({ error: "Failed to update user", detail: err.message });
  }
};
