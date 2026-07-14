import axios from "axios";

const BASE_URL = process.env.CHATWOOT_BASE_URL;
const PLATFORM_TOKEN = process.env.CHATWOOT_PLATFORM_TOKEN;

function chatwootApi(token, prefix = "", version = "v1") {
  return axios.create({
    baseURL: `${BASE_URL}${prefix}/api/${version}`,
    headers: {
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

export async function getAccountUsers(accountId) {
  const { data } = await chatwootApi(PLATFORM_TOKEN, "/platform").get(
    `/accounts/${accountId}/account_users`,
  );
  return data;
}

export async function getConversations(accountId, token, filters = {}) {
  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/conversations`,
    { params: filters },
  );
  return data;
}

export async function assignConversation(
  accountId,
  conversationId,
  assigneeId,
  token,
) {
  const { data } = await chatwootApi(token).post(
    `/accounts/${accountId}/conversations/${conversationId}/assignments`,
    { assignee_id: assigneeId },
  );
  return data;
}

export async function getConversation(accountId, conversationId, token) {
  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/conversations/${conversationId}`,
  );
  return data;
}

export async function getAgents(accountId, token) {
  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/agents`,
  );
  return data;
}

export async function getAccount(accountId, token) {
  const { data } = await chatwootApi(token).get(`/accounts/${accountId}`);
  return data;
}

export async function getReport(
  accountId,
  token,
  { metric, type, since, until, id },
) {
  const { data } = await chatwootApi(token, "", "v2").get(
    `/accounts/${accountId}/reports`,
    { params: { metric, type, since, until, ...(id && { id }) } },
  );
  return data;
}

export async function getMessages(accountId, conversationId, token) {
  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/conversations/${conversationId}/messages`,
  );
  return data;
}

export async function sendMessage(
  accountId,
  conversationId,
  token,
  payload,
  isFormData = false,
) {
  const api = chatwootApi(token);
  if (isFormData) {
    delete api.defaults.headers["Content-Type"];
  }
  const { data } = await api.post(
    `/accounts/${accountId}/conversations/${conversationId}/messages`,
    payload,
  );
  return data;
}

export async function updateLastSeen(accountId, conversationId, token) {
  const { data } = await axios.post(
    `${BASE_URL}/api/v1/accounts/${accountId}/conversations/${conversationId}/update_last_seen`,
    {},
    { headers: { api_access_token: token } },
  );
  return data;
}

export async function getDashboardData(accountId, token, since, until) {
  const inboxData = await getInboxes(accountId, token);
  const inboxes = inboxData?.payload ?? [];

  const reportPromises = inboxes.map(async (inbox) => {
    const { data } = await chatwootApi(token, "", "v2").get(
      `/accounts/${accountId}/reports`,
      {
        params: {
          metric: "conversations_count",
          type: "inbox",
          id: inbox.id,
          since,
          until,
        },
      },
    );
    const total = data.reduce((sum, day) => sum + day.value, 0);
    return {
      name: inbox.name,
      channelType: inbox.channel_type.replace("Channel::", ""),
      total,
    };
  });

  const channels = await Promise.all(reportPromises);
  return { channels };
}
