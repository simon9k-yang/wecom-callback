'use strict';

const express = require('express');
const getRawBody = require('raw-body');
const { verifyAndDecryptEchoStr, verifyAndDecryptMessage } = require('./wecom-crypto');
const { createKfClient } = require('./wecom-kf');

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);

const token = process.env.WECOM_TOKEN || '';
const encodingAesKey = process.env.WECOM_ENCODING_AES_KEY || '';
const corpId = process.env.WECOM_CORP_ID || '';
const kfSecret = process.env.WECOM_KF_SECRET || '';
const kfClient = createKfClient({ corpId, secret: kfSecret });
const processedMessageIds = new Set();

function getXmlValue(xml, elementName) {
  const match = xml.match(new RegExp(
    `<${elementName}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${elementName}>`
  ));
  return match ? (match[1] ?? match[2]).trim() : '';
}

async function echoCustomerMessages(callbackToken, openKfid) {
  const messages = await kfClient.syncMessages({ callbackToken, openKfid });

  for (const message of messages) {
    if (
      message.origin !== 3
      || message.msgtype !== 'text'
      || !message.msgid
      || !message.external_userid
      || !message.open_kfid
      || typeof message.text?.content !== 'string'
      || processedMessageIds.has(message.msgid)
    ) {
      continue;
    }

    processedMessageIds.add(message.msgid);
    try {
      await kfClient.sendText({
        toUser: message.external_userid,
        openKfid: message.open_kfid,
        content: `${message.text.content} CB response`
      });
      console.log('Echoed WeCom customer message:', message.msgid);
    } catch (error) {
      processedMessageIds.delete(message.msgid);
      throw error;
    }
  }
}

app.get('/', (_req, res) => {
  res.type('text/plain').send('WeCom callback service is running');
});

// URL verification: WeCom calls this when the callback configuration is saved.
app.get('/callback', (req, res) => {
  const { msg_signature: msgSignature, timestamp, nonce, echostr } = req.query;

  if ([msgSignature, timestamp, nonce, echostr].some((value) => typeof value !== 'string')) {
    return res.status(400).type('text/plain').send('missing callback parameters');
  }

  try {
    const plainEchoStr = verifyAndDecryptEchoStr({
      token,
      encodingAesKey,
      receiveId: corpId,
      msgSignature,
      timestamp,
      nonce,
      echostr
    });
    res.set('Content-Type', 'text/plain; charset=utf-8');
    return res.send(plainEchoStr);
  } catch (error) {
    console.warn('WeCom callback URL verification failed:', error.message);
    return res.status(401).type('text/plain').send('invalid');
  }
});

// Receive encrypted customer-message notifications. Do not register a JSON or
// XML body parser before this route: WeCom signature/decryption work needs the
// exact request bytes.
app.post('/callback', async (req, res) => {
  try {
    const xml = await getRawBody(req, {
      length: req.headers['content-length'],
      limit: '1mb',
      encoding: 'utf8'
    });
    const { msg_signature: msgSignature, timestamp, nonce } = req.query;
    const encrypted = getXmlValue(xml, 'Encrypt');

    if ([msgSignature, timestamp, nonce, encrypted].some((value) => typeof value !== 'string' || !value)) {
      console.warn('WeCom POST callback is missing signed parameters or Encrypt.');
      return res.type('text/plain').send('success');
    }

    const decryptedXml = verifyAndDecryptMessage({
      token,
      encodingAesKey,
      receiveId: corpId,
      msgSignature,
      timestamp,
      nonce,
      encrypted
    });
    const event = getXmlValue(decryptedXml, 'Event');
    const callbackToken = getXmlValue(decryptedXml, 'Token');
    const openKfid = getXmlValue(decryptedXml, 'OpenKfId');

    // Acknowledge promptly; API synchronization and reply continue after the response.
    res.type('text/plain').send('success');

    if (event === 'kf_msg_or_event' && callbackToken && openKfid) {
      echoCustomerMessages(callbackToken, openKfid).catch((error) => {
        console.error('Unable to sync or echo WeCom customer message:', error.message);
      });
    } else {
      console.log('Ignored unsupported WeCom callback event:', event || '(missing event)');
    }
    return undefined;
  } catch (error) {
    console.error('Unable to verify or decrypt WeCom POST callback:', error.message);
    return res.type('text/plain').send('success');
  }
});

let server;
if (require.main === module) {
  server = app.listen(port, () => {
    console.log(`WeCom callback listening on port ${port}`);
    if (!token || !encodingAesKey || !corpId || !kfSecret) {
      console.warn('WECOM_TOKEN, WECOM_ENCODING_AES_KEY, WECOM_CORP_ID and WECOM_KF_SECRET are required.');
    }
  });
}

module.exports = { app, server };
