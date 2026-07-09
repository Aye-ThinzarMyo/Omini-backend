// import axios from "axios";
// import qs from "qs";

// const GQL_URL = process.env.FREEPBX_GQL_URL;
// const TOKEN_URL = process.env.FREEPBX_TOKEN_URL;
// const CLIENT_ID = process.env.FREEPBX_CLIENT_ID;
// const CLIENT_SECRET = process.env.FREEPBX_CLIENT_SECRET;

// let cachedToken = null;
// let tokenExpiresAt = 0;

// async function getToken() {
//   if (cachedToken && Date.now() < tokenExpiresAt) {
//     return cachedToken;
//   }

//   const { data } = await axios.post(
//     TOKEN_URL,
//     qs.stringify({
//       grant_type: "client_credentials",
//       client_id: CLIENT_ID,
//       client_secret: CLIENT_SECRET,
//     }),
//     { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
//   );

//   cachedToken = data.access_token;
//   tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
//   return cachedToken;
// }

// export async function queryCdr(startDate, endDate) {
//   const token = await getToken();

//   const { data } = await axios.post(
//     GQL_URL,
//     {
//       query: `
//         query {
//           fetchAllCdrs(first: 10000, startDate: "${startDate}", endDate: "${endDate}") {
//             cdrs {
//               id
//               calldate
//             }
//           }
//         }
//       `,
//     },
//     {
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//     },
//   );

//   return data.data?.fetchAllCdrs?.cdrs ?? [];
// }

// export async function getCallsByDate(startDate, endDate) {
//   const cdrs = await queryCdr(startDate, endDate);

//   const dateMap = {};
//   for (const call of cdrs) {
//     const day = call.calldate.slice(0, 10);
//     dateMap[day] = (dateMap[day] || 0) + 1;
//   }

//   return Object.entries(dateMap)
//     .map(([date, count]) => ({ date, count }))
//     .sort((a, b) => a.date.localeCompare(b.date));
// }

import axios from "axios";
import crypto from "crypto";
import qs from "qs";
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

// 1. Get OAuth2 access token (client_credentials grant)
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

// 3. Find the next free extension number
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
    await deleteFreepbxExtension(extensionId).catch(() => {});
    throw new Error(
      `updateExtension failed: ${JSON.stringify(updateResult.updateExtension)}`,
    );
  }

  await gqlRequest(`mutation { doreload(input: {}) { status message } }`);

  return { extensionId, extPassword };
}

// 6. Rollback helper
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

const GQL_URL = process.env.FREEPBX_GQL_URL;
const TOKEN_URL = process.env.FREEPBX_TOKEN_URL;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const { data } = await axios.post(
    TOKEN_URL,
    qs.stringify({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function queryCdr(startDate, endDate) {
  const token = await getToken();

  const { data } = await axios.post(
    GQL_URL,
    {
      query: `
        query {
          fetchAllCdrs(first: 10000, startDate: "${startDate}", endDate: "${endDate}") {
            cdrs {
              id
              calldate
            }
          }
        }
      `,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return data.data?.fetchAllCdrs?.cdrs ?? [];
}

export async function getCallsByDate(startDate, endDate) {
  const cdrs = await queryCdr(startDate, endDate);

  const dateMap = {};
  for (const call of cdrs) {
    const day = call.calldate.slice(0, 10);
    dateMap[day] = (dateMap[day] || 0) + 1;
  }

  return Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function queryCdrLists() {
  const token = await getToken();

  const { data } = await axios.post(
    GQL_URL,
    {
      query: `
       query { fetchAllCdrs(first: 1000) { cdrs {
              id uniqueid calldate clid cnum src dst dcontext
              channel dstchannel lastapp lastdata duration
              billsec disposition recordingfile did
            }}}
      `,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return data.data?.fetchAllCdrs?.cdrs ?? [];
}

export async function getCallRecordings() {
  const cdrs = await queryCdrLists();

  return cdrs;
}
