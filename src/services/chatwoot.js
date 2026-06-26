import axios from 'axios';

const BASE_URL = process.env.CHATWOOT_BASE_URL;
const PLATFORM_TOKEN = process.env.CHATWOOT_PLATFORM_TOKEN;

const chatwootApi = axios.create({
  baseURL: `${BASE_URL}/platform/api/v1`,
  headers: {
    'Content-Type': 'application/json',
    api_access_token: PLATFORM_TOKEN,
  },
});

export async function createChatwootUser({ name, email, password }) {
  const { data } = await chatwootApi.post('/users', {
    name, email, password, custom_attributes: {},
  });

  return { chatwootId: data.id, apiKey: data.access_token };
}

export async function createChatwootAccount(chatwootUserId, accountName) {
  const { data } = await chatwootApi.post(`/users/${chatwootUserId}/accounts`, {
    name: accountName || 'Default Account',
  });

  return { accountId: data.id };
}

export async function getChatwootUser(chatwootUserId) {
  const { data } = await chatwootApi.get(`/users/${chatwootUserId}`);
  return data;
}
