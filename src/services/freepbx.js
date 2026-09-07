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
import mysql from "mysql2/promise";
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
    scope: "gql",
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
    maxContacts: "5",
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

  // The Core GraphQL schema has no WebRTC inputs (AVPF/ICE/DTLS...), so those
  // are written straight into FreePBX's `sip` table over MySQL; the doreload
  // below regenerates pjsip.endpoint.conf from that table.
  try {
    await enableWebrtcSettings(extensionId);
  } catch (err) {
    await deleteFreepbxExtension(extensionId).catch(() => {});
    throw new Error(`enableWebrtcSettings failed: ${err.message}`);
  }

  await gqlRequest(`mutation { doreload(input: {}) { status message } }`);

  return { extensionId, extPassword };
}

// 5b. Apply WebRTC endpoint settings (AVPF, ICE, RTCP mux, DTLS-SRTP, DTLS).
// FreePBX stores per-extension pjsip settings as (id, keyword, data) rows in
// the `asterisk.sip` table — the same table the admin UI reads — so writing
// there keeps the UI accurate and survives reloads. Needs a DB user with
// SELECT/INSERT/UPDATE on that one table; see docs/freepbx-webrtc-setup.md.
// Exactly the keywords the FreePBX UI itself writes for a WebRTC extension
// (verified against a UI-configured extension's `sip` rows on FreePBX 16.0.50).
const WEBRTC_SIP_SETTINGS = {
  avpf: "yes", // Enable AVPF
  icesupport: "yes", // Enable ICE Support
  rtcp_mux: "yes", // Enable RTCP Mux
  media_encryption: "dtls", // Media Encryption = DTLS-SRTP
  media_use_received_transport: "yes", // Media Use Received Transport
};

// The "DTLS" section on the extension page (Enable DTLS, Use Certificate,
// DTLS Verify, DTLS Setup, DTLS Rekey Interval) belongs to the Certificate
// Manager module, not Core. "Enable DTLS = Yes" simply means a row exists in
// `certman_mapping` for the device; certman's config hook then emits
// dtls_verify/dtls_setup/dtls_rekey (only when media_encryption=dtls) plus
// dtls_cert_file/dtls_private_key from the referenced certificate.
const WEBRTC_DTLS_OPTIONS = {
  verify: "fingerprint", // DTLS Verify
  setup: "actpass", // DTLS Setup = Act/Pass
  rekey: 0, // DTLS Rekey Interval
  auto_generate_cert: 0, // Auto Generate Certificate = No (use the default cert)
};

let freepbxDbPool = null;
function getFreepbxDbPool() {
  if (freepbxDbPool) return freepbxDbPool;
  const { FREEPBX_DB_HOST, FREEPBX_DB_USER, FREEPBX_DB_PASSWORD } = process.env;
  if (!FREEPBX_DB_HOST || !FREEPBX_DB_USER || !FREEPBX_DB_PASSWORD) {
    throw new Error(
      "FREEPBX_DB_HOST / FREEPBX_DB_USER / FREEPBX_DB_PASSWORD are not set; cannot apply WebRTC settings to the extension",
    );
  }
  freepbxDbPool = mysql.createPool({
    host: FREEPBX_DB_HOST,
    port: parseInt(process.env.FREEPBX_DB_PORT || "3306", 10),
    user: FREEPBX_DB_USER,
    password: FREEPBX_DB_PASSWORD,
    database: process.env.FREEPBX_DB_NAME || "asterisk",
    connectionLimit: 3,
    connectTimeout: 10_000,
  });
  return freepbxDbPool;
}

async function enableWebrtcSettings(extensionId) {
  const id = String(extensionId);
  const pool = getFreepbxDbPool();

  // Refuse to write for an id that has no extension row, so a failed create
  // can never leave orphan settings behind.
  const [rows] = await pool.query(
    "SELECT 1 FROM sip WHERE id = ? AND keyword = 'account' LIMIT 1",
    [id],
  );
  if (rows.length === 0) {
    throw new Error(`extension ${id} not found in FreePBX sip table`);
  }

  // Idempotent: re-running for the same extension just re-asserts the values.
  const values = Object.entries(WEBRTC_SIP_SETTINGS).map(([keyword, data]) => [
    id,
    keyword,
    data,
    0,
  ]);
  await pool.query(
    "INSERT INTO sip (id, keyword, data, flags) VALUES ? ON DUPLICATE KEY UPDATE data = VALUES(data)",
    [values],
  );

  // Enable DTLS: bind the device to a certificate in certman. Chosen by
  // basename via FREEPBX_DTLS_CERT (as shown in Admin -> Certificate
  // Management); falls back to whichever cert is flagged as the PBX default.
  const certName = process.env.FREEPBX_DTLS_CERT;
  const [certs] = certName
    ? await pool.query(
        "SELECT cid FROM certman_certs WHERE basename = ? LIMIT 1",
        [certName],
      )
    : await pool.query(
        "SELECT cid FROM certman_certs WHERE `default` = 1 LIMIT 1",
      );
  if (certs.length === 0) {
    throw new Error(
      certName
        ? `certificate "${certName}" (FREEPBX_DTLS_CERT) not found in FreePBX Certificate Manager; cannot enable DTLS`
        : "no default certificate in FreePBX Certificate Manager; set FREEPBX_DTLS_CERT or mark one as default",
    );
  }
  const { verify, setup, rekey, auto_generate_cert } = WEBRTC_DTLS_OPTIONS;
  await pool.query(
    `INSERT INTO certman_mapping (id, cid, verify, setup, rekey, auto_generate_cert)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       cid = VALUES(cid), verify = VALUES(verify), setup = VALUES(setup),
       rekey = VALUES(rekey), auto_generate_cert = VALUES(auto_generate_cert)`,
    [id, certs[0].cid, verify, setup, rekey, auto_generate_cert],
  );
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

export async function queryCdrLists({ limit = 1000, startDate, endDate } = {}) {
  const token = await getToken();

  let args = `first: ${limit}`;
  if (startDate) args += `, startDate: "${startDate}"`;
  if (endDate) args += `, endDate: "${endDate}"`;

  const { data } = await axios.post(
    GQL_URL,
    {
      query: `
       query { fetchAllCdrs(${args}) { cdrs {
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

const dispositionMap = {
  answered: "ANSWERED",
  missed: "NO ANSWER",
  cancelled: "CANCELED",
  busy: "BUSY",
  failed: "FAILED",
};

export async function getCallRecordings({
  limit,
  uniqueid,
  status,
  direction,
  duration_min,
  duration_max,
  startDate,
  endDate,
} = {}) {
  let cdrs = await queryCdrLists({ limit, startDate, endDate });

  if (uniqueid) {
    cdrs = cdrs.filter((c) => c.uniqueid === uniqueid);
  }

  if (status) {
    const parts = status.split(",").map((s) => s.trim());
    cdrs = cdrs.filter((c) => {
      return parts.some((p) => {
        if (dispositionMap[p]) return c.disposition === dispositionMap[p];
        switch (p) {
          case "inbound":
            return c.dcontext !== "from-internal" && c.dcontext !== "ext-local";
          case "outbound":
            return c.dcontext === "from-internal";
          case "internal":
            return c.dcontext === "ext-local";
          default:
            return false;
        }
      });
    });
  }

  if (direction) {
    const dirs = direction.split(",").map((d) => d.trim());
    cdrs = cdrs.filter((c) => {
      return dirs.some((p) => {
        switch (p) {
          case "inbound":
            return c.dcontext !== "from-internal" && c.dcontext !== "ext-local";
          case "outbound":
            return c.dcontext === "from-internal";
          case "internal":
            return c.dcontext === "ext-local";
          default:
            return false;
        }
      });
    });
  }

  if (duration_min) {
    const min = parseInt(duration_min);
    cdrs = cdrs.filter((c) => parseInt(c.duration) >= min);
  }

  if (duration_max) {
    const max = parseInt(duration_max);
    cdrs = cdrs.filter((c) => parseInt(c.duration) <= max);
  }

  return cdrs;
}

// 9. Login to FreePBX web UI and get session cookie
let pbxSessionCookie = null;
let pbxSessionExpiry = 0;

async function getPbxSession() {
  if (pbxSessionCookie && Date.now() < pbxSessionExpiry) {
    return pbxSessionCookie;
  }

  const baseUrl = FREEPBX_TOKEN_URL.replace("/api/api/token", "");
  const resp = await axios.post(
    `${baseUrl}/config.php`,
    `display=login&username=${process.env.FREEPBX_USERNAME}&password=${process.env.FREEPBX_PASSWORD}&login=1`,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${baseUrl}/config.php?display=login`,
      },
    },
  );

  const setCookie = resp.headers["set-cookie"];
  if (!setCookie) {
    throw new Error("FreePBX login failed - no session cookie returned");
  }

  const cookie = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
  pbxSessionCookie = cookie;
  pbxSessionExpiry = Date.now() + 25 * 60 * 1000;

  return pbxSessionCookie;
}

// 10. Download recording audio file using PHP session auth
export async function getRecordingFileStream(filename) {
  const cookie = await getPbxSession();

  const match = filename.match(/-(\d+\.\d+)\.\w+$/);
  if (!match) {
    throw new Error("Could not extract uniqueid from filename");
  }
  const uid = match[1];

  const baseUrl = FREEPBX_TOKEN_URL.replace("/api/api/token", "");

  const response = await axios.get(`${baseUrl}/config.php`, {
    params: {
      display: "cdr",
      action: "download_audio",
      cdr_file: uid,
    },
    headers: {
      Cookie: cookie,
      Referer: `${baseUrl}/config.php?display=cdr`,
      Accept: "application/octet-stream,*/*",
    },
    responseType: "stream",
  });

  return response;
}
// 11. Block a phone number via FreePBX Blacklist
export async function blockPhoneNumber(phoneNumber) {
  const token = await getAdminToken();

  const { data } = await axios.post(
    FREEPBX_GQL_URL,
    {
      query: `mutation {
        addBlacklist(input: { number: "${phoneNumber}", description: "Blocked via OmniChannel" }) {
          clientMutationId
          blacklist { number description }
        }
      }`,
    },
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

  return data.data.addBlacklist.blacklist;
}

// 12. Unblock a phone number via FreePBX Blacklist
export async function unblockPhoneNumber(phoneNumber) {
  const token = await getAdminToken();

  const { data } = await axios.post(
    FREEPBX_GQL_URL,
    {
      query: `mutation {
        removeBlacklist(input: { number: "${phoneNumber}" }) {
          clientMutationId
          deletedId
        }
      }`,
    },
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

  return data.data.removeBlacklist;
}

// 10. Get all Ring Groups (groupNumber + description) for the frontend
export async function getRingGroups() {
  const query = `
    query {
      fetchAllRingGroups {
        status
        message
        totalCount
        ringgroups {
          groupNumber
          description
        }
      }
    }
  `;

  const result = await gqlRequest(query);
  const { status, message, totalCount, ringgroups } = result.fetchAllRingGroups;

  if (!status) {
    throw new Error(message || "Failed to fetch ring groups from FreePBX");
  }

  return { totalCount, ringgroups: ringgroups || [] };
}
