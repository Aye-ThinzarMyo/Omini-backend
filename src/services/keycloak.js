import axios from "axios";

const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
const REALM = process.env.KEYCLOAK_REALM;
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;

let adminTokenCache = null;
let tokenExpiry = 0;

async function getAdminToken() {
  if (adminTokenCache && Date.now() < tokenExpiry) {
    return adminTokenCache;
  }

  const form = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const { data } = await axios.post(
    `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
    form.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  adminTokenCache = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60000;

  return adminTokenCache;
}

function adminApi(token) {
  return axios.create({
    baseURL: `${KEYCLOAK_URL}/admin/realms/${REALM}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export async function createKeycloakUser({
  name,
  email,
  password,
  department,
  role,
}) {
  const token = await getAdminToken();
  const api = adminApi(token);

  await api.post("/users", {
    username: name,
    email,
    enabled: true,
    attributes: {
      department: department,
      role: role,
    },
  });

  const searchRes = await api.get(`/users?email=${encodeURIComponent(email)}`);
  const keycloakUser = searchRes.data?.[0];
  if (!keycloakUser?.id) {
    throw new Error("Keycloak user created but ID not found");
  }
  await api.put(`/users/${keycloakUser.id}/reset-password`, {
    type: "password",
    value: "Agb@2026",
    temporary: true,
  });

  return keycloakUser.id;
}

export async function assignRealmRole(keycloakUserId, roleName) {
  const token = await getAdminToken();
  const api = adminApi(token);

  const rolesRes = await api.get("/roles");
  const role = rolesRes.data.find(
    (r) => r.name?.toLowerCase() === roleName?.toLowerCase(),
  );
  if (!role) return;

  await api.post(`/users/${keycloakUserId}/role-mappings/realm`, [
    { id: role.id, name: role.name },
  ]);
}

export async function deleteKeycloakUser(keycloakUserId) {
  const token = await getAdminToken();
  const api = adminApi(token);

  await api.delete(`/users/${keycloakUserId}`);
}
