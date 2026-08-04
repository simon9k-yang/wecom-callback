'use strict';

const express = require('express');
const getRawBody = require('raw-body');
const { verifyAndDecryptEchoStr } = require('./wecom-crypto');

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);

const token = process.env.WECOM_TOKEN || '';
const encodingAesKey = process.env.WECOM_ENCODING_AES_KEY || '';
const corpId = process.env.WECOM_CORP_ID || '';

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

    console.log('Received encrypted WeCom message (not decrypted):', xml.slice(0, 200));
    return res.type('text/plain').send('success');
  } catch (error) {
    console.error('Unable to read WeCom callback body:', error.message);
    return res.status(400).type('text/plain').send('invalid body');
  }
});

let server;
if (require.main === module) {
  server = app.listen(port, () => {
    console.log(`WeCom callback listening on port ${port}`);
    if (!token || !encodingAesKey || !corpId) {
      console.warn('WECOM_TOKEN, WECOM_ENCODING_AES_KEY and WECOM_CORP_ID are required for URL verification.');
    }
  });
}

module.exports = { app, server };
