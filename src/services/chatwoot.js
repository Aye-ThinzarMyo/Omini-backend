import axios from "axios";

const BASE_URL = process.env.CHATWOOT_BASE_URL;
const PLATFORM_TOKEN = process.env.CHATWOOT_PLATFORM_TOKEN;

function chatwootApi(token) {
  return axios.create({
    baseURL: `${BASE_URL}/platform/api/v1`,
    headers: {
      "Content-Type": "application/json",
      api_access_token: token,
    },
  });
}

export async function createChatwootUser({ name, email, password }) {
  const { data } = await chatwootApi(PLATFORM_TOKEN).post("/users", {
    name,
    email,
    password,
    custom_attributes: {},
  });
  return { chatwootId: data.id, apiKey: data.access_token };
}

export async function getInboxes(accountId, token) {
  console.log("account id:::", accountId);
  console.log("token:::", token);

  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/inboxes`,
  );
  console.log("data:::", data);
  return data;
}
