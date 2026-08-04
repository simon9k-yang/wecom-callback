'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { getSignature, verifyAndDecryptEchoStr } = require('../wecom-crypto');

function encryptFixture(encodingAesKey, message, receiveId) {
  const key = Buffer.from(`${encodingAesKey}=`, 'base64');
  const messageBuffer = Buffer.from(message);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(messageBuffer.length);
  const unpadded = Buffer.concat([Buffer.alloc(16, 7), length, messageBuffer, Buffer.from(receiveId)]);
  const paddingLength = 32 - (unpadded.length % 32);
  const padded = Buffer.concat([unpadded, Buffer.alloc(paddingLength, paddingLength)]);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString('base64');
}

test('verifies the signature and decrypts an echostr challenge', () => {
  const token = 'test-token';
  const timestamp = '1722700000';
  const nonce = 'test-nonce';
  const receiveId = 'ww1234567890abcdef';
  const encodingAesKey = Buffer.alloc(32, 9).toString('base64').slice(0, 43);
  const echostr = encryptFixture(encodingAesKey, '1234567890123456', receiveId);
  const msgSignature = getSignature(token, timestamp, nonce, echostr);

  assert.equal(verifyAndDecryptEchoStr({
    token,
    encodingAesKey,
    receiveId,
    msgSignature,
    timestamp,
    nonce,
    echostr
  }), '1234567890123456');
});

test('rejects a callback with an invalid signature', () => {
  assert.throws(() => verifyAndDecryptEchoStr({
    token: 'token',
    encodingAesKey: Buffer.alloc(32, 1).toString('base64').slice(0, 43),
    receiveId: 'ww-corp',
    msgSignature: 'invalid',
    timestamp: '1',
    nonce: '2',
    echostr: 'encrypted'
  }), /Invalid WeCom callback signature/);
});

test('rejects a decrypted challenge for another receiveid', () => {
  const token = 'token';
  const timestamp = '1';
  const nonce = '2';
  const encodingAesKey = Buffer.alloc(32, 3).toString('base64').slice(0, 43);
  const echostr = encryptFixture(encodingAesKey, 'echo', 'ww-other');

  assert.throws(() => verifyAndDecryptEchoStr({
    token,
    encodingAesKey,
    receiveId: 'ww-expected',
    msgSignature: getSignature(token, timestamp, nonce, echostr),
    timestamp,
    nonce,
    echostr
  }), /receiveid/);
});
