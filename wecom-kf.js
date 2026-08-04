'use strict';

const API_BASE_URL = 'https://qyapi.weixin.qq.com/cgi-bin';
const ACCESS_TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;

function assertApiSuccess(data, operation) {
  if (!data || data.errcode !== 0) {
    const code = data?.errcode ?? 'unknown';
    const message = data?.errmsg ?? 'invalid response';
    throw new Error(`${operation} failed (${code}): ${message}`);
  }
  return data;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) {
    throw new Error(`WeCom API returned HTTP ${response.status}`);
  }
  return response.json();
}

function createKfClient({ corpId, secret }) {
  let cachedAccessToken = '';
  let accessTokenExpiresAt = 0;

  async function getAccessToken() {
    if (cachedAccessToken && Date.now() < accessTokenExpiresAt) {
      return cachedAccessToken;
    }

    const url = new URL(`${API_BASE_URL}/gettoken`);
    url.searchParams.set('corpid', corpId);
    url.searchParams.set('corpsecret', secret);
    const data = assertApiSuccess(await requestJson(url), 'get access token');
    cachedAccessToken = data.access_token;
    accessTokenExpiresAt = Date.now()
      + Math.max(0, (data.expires_in * 1000) - ACCESS_TOKEN_SAFETY_MARGIN_MS);
    return cachedAccessToken;
  }

  async function callWithAccessToken(path, body) {
    const accessToken = await getAccessToken();
    const url = new URL(`${API_BASE_URL}${path}`);
    url.searchParams.set('access_token', accessToken);
    return assertApiSuccess(await requestJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }), path);
  }

  async function syncMessages({ callbackToken, openKfid }) {
    const messages = [];
    let cursor = '';

    do {
      const data = await callWithAccessToken('/kf/sync_msg', {
        cursor,
        token: callbackToken,
        limit: 1000,
        voice_format: 0,
        open_kfid: openKfid
      });
      messages.push(...(data.msg_list || []));
      cursor = data.has_more === 1 ? data.next_cursor : '';
    } while (cursor);

    return messages;
  }

  async function sendText({ toUser, openKfid, content }) {
    return callWithAccessToken('/kf/send_msg', {
      touser: toUser,
      open_kfid: openKfid,
      msgtype: 'text',
      text: { content }
    });
  }

  return { sendText, syncMessages };
}

module.exports = { createKfClient };
