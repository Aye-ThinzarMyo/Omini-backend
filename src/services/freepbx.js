import axios from "axios";
import qs from "qs";

const GQL_URL = process.env.FREEPBX_GQL_URL;
const TOKEN_URL = process.env.FREEPBX_TOKEN_URL;
const CLIENT_ID = process.env.FREEPBX_CLIENT_ID;
const CLIENT_SECRET = process.env.FREEPBX_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const { data } = await axios.post(
    TOKEN_URL,
    qs.stringify({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

export async function queryCdr(startDate, endDate) {
  const token = await getToken();

  const { data } = await axios.post(
    GQL_URL,
    {
      query: `
        query {
          fetchAllCdrs(first: 10000, startDate: "${startDate}", endDate: "${endDate}") {
            cdrs {
              id
              calldate
            }
          }
        }
      `,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return data.data?.fetchAllCdrs?.cdrs ?? [];
}

export async function getCallsByDate(startDate, endDate) {
  const cdrs = await queryCdr(startDate, endDate);

  const dateMap = {};
  for (const call of cdrs) {
    const day = call.calldate.slice(0, 10);
    dateMap[day] = (dateMap[day] || 0) + 1;
  }

  return Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
