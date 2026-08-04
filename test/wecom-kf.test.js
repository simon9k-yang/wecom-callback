'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createKfClient } = require('../wecom-kf');

test('gets an access token, syncs messages, and sends text', async (context) => {
  const originalFetch = global.fetch;
  const requests = [];
  context.after(() => { global.fetch = originalFetch; });

  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('/gettoken?')) {
      return Response.json({ errcode: 0, access_token: 'access-token', expires_in: 7200 });
    }
    if (String(url).includes('/kf/sync_msg?')) {
      return Response.json({
        errcode: 0,
        has_more: 0,
        msg_list: [{ msgid: 'message-1', msgtype: 'text' }]
      });
    }
    return Response.json({ errcode: 0, msgid: 'sent-message' });
  };

  const client = createKfClient({ corpId: 'ww-corp', secret: 'kf-secret' });
  const messages = await client.syncMessages({ callbackToken: 'callback-token', openKfid: 'wk-id' });
  await client.sendText({ toUser: 'external-user', openKfid: 'wk-id', content: 'hello CB response' });

  assert.equal(messages[0].msgid, 'message-1');
  assert.equal(requests.filter(({ url }) => url.includes('/gettoken?')).length, 1);
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    cursor: '',
    token: 'callback-token',
    limit: 1000,
    voice_format: 0,
    open_kfid: 'wk-id'
  });
  assert.deepEqual(JSON.parse(requests[2].options.body).text, { content: 'hello CB response' });
});

test('throws when WeCom returns an API error', async (context) => {
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => Response.json({ errcode: 40013, errmsg: 'invalid corpid' });

  const client = createKfClient({ corpId: 'bad', secret: 'bad' });
  await assert.rejects(
    client.syncMessages({ callbackToken: 'token', openKfid: 'wk-id' }),
    /40013.*invalid corpid/
  );
});
