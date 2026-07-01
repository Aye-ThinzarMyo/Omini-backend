import "dotenv/config";
import axios from "axios";
import jwt from "jsonwebtoken";

const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
const REALM = process.env.KEYCLOAK_REALM;

async function debug() {
  console.log("=== Step 1: Fetch certs ===");
  const { data } = await axios.get(
    `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`
  );
  console.log("Certs response keys:", JSON.stringify(data.keys?.map(k => ({ kid: k.kid, alg: k.alg, use: k.use })), null, 2));

  const cert = data.keys?.[0];
  console.log("\nFirst cert kid:", cert?.kid, "alg:", cert?.alg, "use:", cert?.use);

  if (cert?.x5c?.[0]) {
    const base64 = cert.x5c[0];
    const pem = [
      "-----BEGIN CERTIFICATE-----",
      base64.match(/.{1,64}/g).join("\n"),
      "-----END CERTIFICATE-----",
    ].join("\n");
    console.log("\n=== PEM ===");
    console.log(pem.substring(0, 200) + "...");

    // Test with a real token
    const token = process.argv[2];
    if (token) {
      console.log("\n=== Step 2: Verify token ===");
      console.log("Token (first 50 chars):", token.substring(0, 50) + "...");
      
      // Decode header to see algorithm
      const header = JSON.parse(Buffer.from(token.split(".")[0], "base64").toString());
      console.log("Token header:", header);

      try {
        const decoded = jwt.verify(token, pem, {
          algorithms: [header.alg || "RS256"],
          issuer: `${KEYCLOAK_URL}/realms/${REALM}`,
        });
        console.log("\n✅ VERIFIED!");
        console.log("Decoded:", JSON.stringify(decoded, null, 2));
      } catch (err) {
        console.log("\n❌ Verify failed:", err.message);
        
        // Try without issuer check
        try {
          const decoded2 = jwt.verify(token, pem, {
            algorithms: [header.alg || "RS256"],
            issuer: [
              `${KEYCLOAK_URL}/realms/${REALM}`,
              `${KEYCLOAK_URL}/auth/realms/${REALM}`,
            ],
          });
          console.log("✅ Works with auth/ prefix");
        } catch (err2) {
          console.log("Still fails:", err2.message);
        }
      }
    } else {
      console.log("\nUsage: node test-auth.js YOUR_TOKEN");
      console.log("Get token from Postman first, then pass it as argument");
    }
  } else {
    console.log("❌ No x5c certificate found");
    console.log("Full data:", JSON.stringify(data, null, 2));
  }
}

debug().catch(console.error);
