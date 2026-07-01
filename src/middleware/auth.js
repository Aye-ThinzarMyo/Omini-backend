import jwt from "jsonwebtoken";
import axios from "axios";

const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
const REALM = process.env.KEYCLOAK_REALM;

let jwksCache = null;
let cacheExpiry = 0;

// 1. Get Keycloak public keys (JWKS)
async function getRealmKeys() {
  if (jwksCache && Date.now() < cacheExpiry) {
    console.log("1. Using cached JWKS");
    return jwksCache;
  }

  console.log("2. Fetching JWKS from Keycloak...");

  const { data } = await axios.get(
    `https://auth.agbisp.net/realms/omnichannel/protocol/openid-connect/certs`,
  );

  console.log("3. JWKS received");

  jwksCache = data.keys;
  cacheExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

  return jwksCache;
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
    console.log("=== AUTH MIDDLEWARE START ===");

    // 1. Get auth header
    const authHeader = req.headers.authorization;
    console.log("1. authHeader:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("2. Missing Bearer token");
      return res.status(401).json({ error: "No token provided" });
    }

    // 2. Extract token
    const token = authHeader.split(" ")[1];
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
    console.error("AUTH ERROR:", err.message);
    console.error("STACK:", err.stack);

    return res.status(401).json({
      error: "Invalid token",
      detail: err.message,
    });
  }
}
