import axios from "axios";

const BASE_URL = process.env.CHATWOOT_BASE_URL;
const PLATFORM_TOKEN = process.env.CHATWOOT_PLATFORM_TOKEN;

function chatwootApi(token, prefix = "") {
  return axios.create({
    baseURL: `${BASE_URL}${prefix}/api/v1`,
    headers: {
      "Content-Type": "application/json",
      api_access_token: token,
    },
  });
}

export async function createChatwootUser({ name, email, password }) {
  const { data } = await chatwootApi(PLATFORM_TOKEN, "/platform").post(
    "/users",
    {
      name,
      email,
      password,
      custom_attributes: {},
    },
  );
  return { chatwootId: data.id, apiKey: data.access_token };
}

export async function createChatwootAccountUser({ user_id, role, accountId }) {
  const { data } = await chatwootApi(PLATFORM_TOKEN, "/platform").post(
    `/accounts/${accountId}/account_users`,
    {
      user_id,
      role,
    },
  );
  return { resultRole: data.role };
}

export async function getInboxes(accountId, token) {
  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/inboxes`,
  );
  return data;
}
