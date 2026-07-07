import axios from "axios";
import crypto from "crypto";

const FREEPBX_GQL_URL = process.env.FREEPBX_GQL_URL;
const FREEPBX_TOKEN_URL = process.env.FREEPBX_TOKEN_URL;
const CLIENT_ID = process.env.FREEPBX_CLIENT_ID;
const CLIENT_SECRET = process.env.FREEPBX_CLIENT_SECRET;
const EXT_RANGE_START = parseInt(
  process.env.FREEPBX_EXT_RANGE_START || "1000",
  10,
);

let adminTokenCache = null;
let tokenExpiry = 0;

// 1. Get OAuth2 access token (client_credentials grant, same idea as keycloak.js)
async function getAdminToken() {
  if (adminTokenCache && Date.now() < tokenExpiry) {
    return adminTokenCache;
  }

  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "gql:core gql:framework",
  });

  const { data } = await axios.post(FREEPBX_TOKEN_URL, form.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  adminTokenCache = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60000;

  return adminTokenCache;
}

// 2. Generic GraphQL request helper
async function gqlRequest(query, variables = {}) {
  const token = await getAdminToken();

  const { data } = await axios.post(
    FREEPBX_GQL_URL,
    { query, variables },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (data.errors) {
    throw new Error(data.errors.map((e) => e.message).join("; "));
  }

  return data.data;
}

// 3. Find the next free extension number.
// Simplest reliable approach: ask FreePBX for existing extensions, then pick max+1.
async function getNextAvailableExtension() {
  const query = `
    query {
      fetchAllExtensions {
        status
        extension {
          extensionId
        }
      }
    }
  `;

  const result = await gqlRequest(query);
  const existingIds = (result.fetchAllExtensions.extension || []).map((e) =>
    parseInt(e.extensionId, 10),
  );

  const maxExisting = existingIds.length
    ? Math.max(...existingIds)
    : EXT_RANGE_START - 1;
  return Math.max(maxExisting + 1, EXT_RANGE_START);
}

// 4. Generate a secure random secret for the SIP extension
function generateSecret() {
  return crypto.randomBytes(16).toString("hex");
}

// 5. Create the extension in FreePBX
export async function createFreepbxExtension({ name, email }) {
  const extensionId = await getNextAvailableExtension();
  const extPassword = generateSecret();

  // Step A: create the extension (addExtension does NOT accept a secret)
  const createMutation = `
    mutation CreateExtension($input: addExtensionInput!) {
      addExtension(input: $input) {
        status
        message
      }
    }
  `;

  const baseFields = {
    extensionId,
    name,
    tech: "pjsip",
    outboundCid: "",
    email,
    umEnable: false,
    vmEnable: false,
    maxContacts: "1",
  };

  const createResult = await gqlRequest(createMutation, {
    input: baseFields,
  });

  if (!createResult.addExtension.status) {
    throw new Error(
      `addExtension failed: ${JSON.stringify(createResult.addExtension)}`,
    );
  }

  // Step B: set our own secret via updateExtension (this is the only mutation that accepts extPassword)
  // NOTE: FreePBX has a known bug where updateExtension silently returns
  // { status: null, message: null } if you only send a couple of fields,
  // even though the docs say unspecified fields keep their existing value.
  // Workaround: resend the full field set alongside extPassword.
  const updateMutation = `
    mutation SetExtensionSecret($input: updateExtensionInput!) {
      updateExtension(input: $input) {
        status
        message
      }
    }
  `;

  const updateResult = await gqlRequest(updateMutation, {
    input: {
      ...baseFields,
      extPassword,
    },
  });

  if (!updateResult.updateExtension.status) {
    // Cleanup: don't leave a half-configured extension behind
    await deleteFreepbxExtension(extensionId).catch(() => {});
    throw new Error(
      `updateExtension failed: ${JSON.stringify(updateResult.updateExtension)}`,
    );
  }

  // Apply the config so the extension is actually live on Asterisk
  await gqlRequest(`mutation { doreload(input: {}) { status message } }`);

  // FreePBX does not echo back the id/secret, so we return what we generated
  return { extensionId, extPassword };
}

// 6. Rollback helper, used if a later step in createUser fails
export async function deleteFreepbxExtension(extensionId) {
  const mutation = `
    mutation DeleteExtension($input: deleteExtensionInput!) {
      deleteExtension(input: $input) {
        status
        message
      }
    }
  `;

  await gqlRequest(mutation, { input: { extensionId } });
  await gqlRequest(`mutation { doreload(input: {}) { status message } }`);
}
