'use strict';

const express = require('express');
const getRawBody = require('raw-body');

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);

// Token configured in the WeCom Customer Service developer console.
// Signature verification and message decryption are deliberately deferred while
// this project is being used to inspect the callback handshake and payloads.
const token = process.env.WECOM_TOKEN || '';

app.get('/', (_req, res) => {
  res.type('text/plain').send('WeCom callback service is running');
});

// URL verification: WeCom calls this when the callback configuration is saved.
app.get('/callback', (req, res) => {
  const { echostr } = req.query;

  if (typeof echostr !== 'string') {
    return res.status(400).type('text/plain').send('missing echostr');
  }

  // Examination mode: echo the challenge without validating its signature.
  return res.type('text/plain').send(echostr);
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

const server = app.listen(port, () => {
  console.log(`WeCom callback listening on port ${port}`);
  if (!token) {
    console.warn('WECOM_TOKEN is not set; callback signature validation is disabled.');
  }
});

module.exports = { app, server };
