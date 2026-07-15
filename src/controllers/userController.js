<<<<<<< HEAD
// import { User } from "../database/models";
// import sequelize from "../database/config/sequelize";
// import { encrypt } from "../utils/encryption";
// import { createChatwootUser } from "../services/chatwoot";
// import {
//   createKeycloakUser,
//   assignRealmRole,
//   deleteKeycloakUser,
// } from "../services/keycloak";

// export const createUser = async (req, res) => {
//   const { full_name, email, phone, department, role, password } = req.body;

//   if (!full_name || !email || !password) {
//     return res
//       .status(400)
//       .json({ error: "full_name, email, and password are required" });
//   }

//   const t = await sequelize.transaction();

//   try {
//     const existing = await User.findOne({ where: { email } });
//     if (existing) {
//       await t.rollback();
//       return res
//         .status(409)
//         .json({ error: "User with this email already exists" });
//     }

//     let chatwootResult;
//     try {
//       chatwootResult = await createChatwootUser({
//         name: full_name,
//         email,
//         password,
//       });
//     } catch (err) {
//       await t.rollback();
//       return res.status(502).json({
//         error: "Failed to create user in Chatwoot",
//         detail: err.response?.data || err.message,
//       });
//     }

//     const { chatwootId, apiKey } = chatwootResult;
//     const encryptedApiKey = encrypt(apiKey);
//     const encryptedPassword = encrypt(password);

//     let keycloakId;
//     try {
//       keycloakId = await createKeycloakUser({
//         name: full_name,
//         email,
//         password,
//         encryptedApiKey,
//       });
//       if (role) {
//         await assignRealmRole(keycloakId, role);
//       }
//     } catch (err) {
//       await t.rollback();
//       return res.status(502).json({
//         error: "Failed to create user in Keycloak",
//         detail: err.response?.data || err.message,
//       });
//     }

//     const user = await User.create(
//       {
//         id: keycloakId,
//         full_name,
//         email,
//         phone: phone || null,
//         department: department || null,
//         role: role || "Agent",
//         chat_admin_user_id: chatwootId,
//         encrypted_chat_secret: encryptedApiKey,
//         password: encryptedPassword,
//       },
//       { transaction: t },
//     );

//     await t.commit();

//     const userData = user.toJSON();
//     delete userData.encrypted_chat_secret;
//     delete userData.password;

//     res.status(201).json({
//       user: userData,
//       message: "User created in Chatwoot, Keycloak, and database",
//     });
//   } catch (err) {
//     await t.rollback();
//     console.error("User creation failed:", err);
//     res
//       .status(500)
//       .json({ error: "Failed to create user", detail: err.message });
//   }
// };
=======
import jwt from "jsonwebtoken";
>>>>>>> d615d083c5db7c203c78fab09a15d6fe370636e5
import { User } from "../database/models";
import sequelize from "../database/config/sequelize";
import { encrypt, decrypt } from "../utils/encryption";
import {
  createChatwootAccountUser,
  createChatwootUser,
  addInboxMember,
} from "../services/chatwoot";
import {
  createKeycloakUser,
  assignRealmRole,
  deleteKeycloakUser,
} from "../services/keycloak";
import {
  createFreepbxExtension,
  deleteFreepbxExtension,
} from "../services/freepbx";

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

        await addInboxMember(accountId, inbox_id, [chatwootId], adminToken);
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

    let freepbxResult;
    try {
      freepbxResult = await createFreepbxExtension({
        name: full_name,
        email,
      });
    } catch (err) {
      await t.rollback();
      // Best-effort cleanup of what we already created upstream
      await deleteKeycloakUser(keycloakId).catch(() => {});
      return res.status(502).json({
        error: "Failed to create extension in FreePBX",
        detail: err.response?.data || err.message,
      });
    }

    const { extensionId, extPassword } = freepbxResult;
    const encryptedFreepbxSecret = encrypt(extPassword);

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
        freepbx_extension_id: String(extensionId),
        encrypted_freepbx_secret: encryptedFreepbxSecret,
      },
      { transaction: t },
    );

    await t.commit();

    const userData = user.toJSON();
    delete userData.encrypted_chat_secret;
    delete userData.password;
    delete userData.encrypted_freepbx_secret;

    res.status(201).json({
      user: userData,
      message: "User created in Chatwoot, Keycloak, FreePBX, and database",
    });
  } catch (err) {
    await t.rollback();
    await deleteFreepbxExtension(freepbxResult?.extensionId).catch(() => {});
    await deleteKeycloakUser(keycloakId).catch(() => {});
    console.error("User creation failed:", err);
    res
      .status(500)
      .json({ error: "Failed to create user", detail: err.message });
  }
};
