import jwt from "jsonwebtoken";
import axios from "axios";
import crypto from "crypto";

<<<<<<< HEAD
const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
const REALM = process.env.KEYCLOAK_REALM;

let jwksCache = null;
let cacheExpiry = 0;

// 1. Get Keycloak public keys (JWKS)
async function getRealmKeys() {
  if (jwksCache && Date.now() < cacheExpiry) {
    console.log("1. Using cached JWKS");
    return jwksCache;
=======
// Cache: { [kid]: pem }
let keysCache = {};
let cacheExpiry = 0;

function buildPemFromJwk(jwk) {
  if (jwk.x5c?.[0]) {
    // Use x5c certificate if provided
    const base64 = jwk.x5c[0];
    return [
      "-----BEGIN CERTIFICATE-----",
      base64.match(/.{1,64}/g).join("\n"),
      "-----END CERTIFICATE-----",
    ].join("\n");
  }

  if (jwk.n && jwk.e) {
    // Build RSA public key from modulus + exponent (most common Keycloak format)
    return crypto
      .createPublicKey({ key: jwk, format: "jwk" })
      .export({ type: "spki", format: "pem" });
  }

  throw new Error(`JWK key (kid=${jwk.kid}) has no usable key material (no x5c, n, or e)`);
}

async function fetchKeys() {
  const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
  const REALM = process.env.KEYCLOAK_REALM;

  if (!KEYCLOAK_URL || !REALM) {
    throw new Error("KEYCLOAK_URL or KEYCLOAK_REALM is not set in environment");
>>>>>>> af6ec8831b83ba87b1ae8f05695d7cc12fcebe8d
  }

  console.log("2. Fetching JWKS from Keycloak...");

  const { data } = await axios.get(
<<<<<<< HEAD
    `https://auth.agbisp.net/realms/omnichannel/protocol/openid-connect/certs`,
  );

  console.log("3. JWKS received");

  jwksCache = data.keys;
  cacheExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

  return jwksCache;
=======
    `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`,
  );

  const newCache = {};
  for (const jwk of data.keys || []) {
    if (jwk.use === "sig" || !jwk.use) {
      try {
        newCache[jwk.kid] = buildPemFromJwk(jwk);
      } catch (e) {
        console.warn(`Skipping JWK kid=${jwk.kid}:`, e.message);
      }
    }
  }

  keysCache = newCache;
  cacheExpiry = Date.now() + 3600000; // cache for 1 hour
}

async function getPublicKeyForToken(token) {
  // Decode header to get kid without verifying signature
  const headerB64 = token.split(".")[0];
  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
  const kid = header.kid;

  // Refresh cache if expired or kid not found
  if (Date.now() >= cacheExpiry || !keysCache[kid]) {
    await fetchKeys();
  }

  const pem = keysCache[kid];
  if (!pem) {
    throw new Error(`No public key found for kid: ${kid}`);
  }

  return pem;
>>>>>>> af6ec8831b83ba87b1ae8f05695d7cc12fcebe8d
}

// 2. Convert x5c cert → PEM
function certToPEM(cert) {
  return (
    "-----BEGIN CERTIFICATE-----\n" +
    cert.match(/.{1,64}/g).join("\n") +
    "\n-----END CERTIFICATE-----\n"
  );
}

// 3. Middleware
export async function authMiddleware(req, res, next) {
  try {
<<<<<<< HEAD
    console.log("=== AUTH MIDDLEWARE START ===");
=======
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }
>>>>>>> af6ec8831b83ba87b1ae8f05695d7cc12fcebe8d

    // 1. Get auth header
    const authHeader = req.headers.authorization;
    console.log("1. authHeader:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("2. Missing Bearer token");
      return res.status(401).json({ error: "No token provided" });
    }

    // 2. Extract token
    const token = authHeader.split(" ")[1];
<<<<<<< HEAD
    console.log("3. token extracted");

    // 3. Decode token header (NO VERIFY)
    const decodedHeader = jwt.decode(token, { complete: true });
    console.log("4. token header:", decodedHeader?.header);

    if (!decodedHeader) {
      return res.status(401).json({ error: "Invalid token format" });
    }

    const kid = decodedHeader.header.kid;

    // 4. Get JWKS
    const keys = await getRealmKeys();
    console.log("5. keys loaded:", keys.length);

    // 5. Find matching key
    const key = keys.find((k) => k.kid === kid);

    if (!key) {
      console.log("6. No matching key found for kid:", kid);
      return res
        .status(401)
        .json({ error: "Invalid signing key (kid mismatch)" });
    }

    console.log("6. Matching key found");

    // 6. Convert cert to PEM
    const publicKey = certToPEM(key.x5c[0]);

    // 7. Verify token
    console.log("7. verifying token...");

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: `https://auth.agbisp.net/realms/omnichannel`,
=======

    const publicKey = await getPublicKeyForToken(token);

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`,
>>>>>>> af6ec8831b83ba87b1ae8f05695d7cc12fcebe8d
    });

    console.log("8. token verified");

    // 8. Attach user
    req.user = {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name || decoded.preferred_username,
      preferred_username: decoded.preferred_username,
      roles: decoded.realm_access?.roles || [],
    };

    console.log("9. user attached:", req.user);
    console.log("=== AUTH SUCCESS ===");

    next();
  } catch (err) {
<<<<<<< HEAD
    console.error("AUTH ERROR:", err.message);
    console.error("STACK:", err.stack);

    return res.status(401).json({
      error: "Invalid token",
      detail: err.message,
    });
=======
    return res.status(401).json({ error: "Invalid token", detail: err.message });
>>>>>>> af6ec8831b83ba87b1ae8f05695d7cc12fcebe8d
  }
}
