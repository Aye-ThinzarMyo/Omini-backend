import jwt from "jsonwebtoken";
import axios from "axios";
import crypto from "crypto";

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
  }

  const { data } = await axios.get(
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
}

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    const publicKey = await getPublicKeyForToken(token);

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`,
    });

    req.user = {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name || decoded.preferred_username,
      preferred_username: decoded.preferred_username,
      roles: decoded.realm_access?.roles || [],
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token", detail: err.message });
  }
}
