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

export async function addInboxMember(accountId, inboxId, userIds, token) {
  const { data } = await chatwootApi(token).post(
    `/accounts/${accountId}/inbox_members`,
    { inbox_id: inboxId, user_ids: userIds },
  );
  return data;
}

export async function listContacts(accountId, token, params = {}) {
  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/contacts`,
    { params },
  );
  return data;
}

export async function searchContacts(accountId, token, q) {
  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/contacts/search`,
    { params: { q } },
  );
  return data;
}

export async function createContact(accountId, token, payload) {
  const { data } = await chatwootApi(token).post(
    `/accounts/${accountId}/contacts`,
    payload,
  );
  return data;
}

export async function getContact(accountId, contactId, token) {
  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/contacts/${contactId}`,
  );
  return data;
}

export async function updateContact(accountId, contactId, token, payload) {
  const { data } = await chatwootApi(token).put(
    `/accounts/${accountId}/contacts/${contactId}`,
    payload,
  );
  return data;
}

export async function deleteContact(accountId, contactId, token) {
  const { data } = await chatwootApi(token).delete(
    `/accounts/${accountId}/contacts/${contactId}`,
  );
  return data;
}

export async function mergeContacts(
  accountId,
  baseContactId,
  token,
  mergeeContactId,
) {
  const { data } = await chatwootApi(token).put(
    `/accounts/${accountId}/contacts/${baseContactId}/merge`,
    { contact_id: mergeeContactId },
  );
  return data;
}

export async function getContactableInboxes(accountId, contactId, token) {
  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/contacts/${contactId}/contactable_inboxes`,
  );
  return data;
}

export async function createContactInbox(accountId, contactId, token, payload) {
  const { data } = await chatwootApi(token).post(
    `/accounts/${accountId}/contacts/${contactId}/contact_inboxes`,
    payload,
  );
  return data;
}

export async function getContactConversations(accountId, contactId, token) {
  const { data } = await chatwootApi(token).get(
    `/accounts/${accountId}/contacts/${contactId}/conversations`,
  );
  return data;
}

export async function findOrCreateContact(
  accountId,
  token,
  { email, phone_number, name, identifier, inbox_id },
) {
  if (email) {
    try {
      const searchResult = await searchContacts(accountId, token, email);
      const contacts = searchResult?.payload ?? [];
      if (contacts.length > 0) {
        return { contact: contacts[0], created: false };
      }
    } catch (e) {
      // search failed, proceed to create
    }
  }

  if (phone_number && !email) {
    try {
      const searchResult = await searchContacts(accountId, token, phone_number);
      const contacts = searchResult?.payload ?? [];
      if (contacts.length > 0) {
        return { contact: contacts[0], created: false };
      }
    } catch (e) {
      // search failed, proceed to create
    }
  }

  const payload = { inbox_id, name, email, phone_number, identifier };
  Object.keys(payload).forEach(
    (k) => payload[k] === undefined && delete payload[k],
  );

  const result = await createContact(accountId, token, payload);
  const contact = result?.payload ?? result;
  return { contact, created: true };
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
