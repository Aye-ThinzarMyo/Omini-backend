import jwt from "jsonwebtoken";
import axios from "axios";

const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
const REALM = process.env.KEYCLOAK_REALM;

let publicKeyCache = null;
let cacheExpiry = 0;

async function getRealmPublicKey() {
  if (publicKeyCache && Date.now() < cacheExpiry) {
    console.log("public key=============", publicKeyCache);
    return publicKeyCache;
  }

  const { data } = await axios.get(
    `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
  );
  console.log("DATA=============", data);

  const cert = data.keys?.[0];
  if (!cert?.x5c?.[0]) {
    throw new Error("No certificate found in Keycloak certs endpoint");
  }

  const base64 = cert.x5c[0];
  const pem = [
    "-----BEGIN CERTIFICATE-----",
    base64.match(/.{1,64}/g).join("\n"),
    "-----END CERTIFICATE-----",
  ].join("\n");

  publicKeyCache = pem;
  cacheExpiry = Date.now() + 3600000;
  return publicKeyCache;
}

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    // if (!authHeader?.startsWith("Bearer ")) {
    //   return res.status(401).json({ error: "No token provided" });
    // }

    const token = authHeader.split(" ")[1];
    console.log("TOKEN=========", token);
    const publicKey = await getRealmPublicKey();
    console.log("public key=========", publicKey);

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: `${KEYCLOAK_URL}/realms/${REALM}`,
    });
    console.log("DECODED=========", decoded);

    req.user = {
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name || decoded.preferred_username,
      preferred_username: decoded.preferred_username,
      roles: decoded.realm_access?.roles || [],
    };

    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Invalid token", detail: err.message });
  }
}
