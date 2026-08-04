'use strict';

const crypto = require('node:crypto');

function getSignature(token, timestamp, nonce, encrypted) {
  return crypto
    .createHash('sha1')
    .update([token, timestamp, nonce, encrypted].map(String).sort().join(''))
    .digest('hex');
}

function signaturesMatch(actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') {
    return false;
  }

  const actualBuffer = Buffer.from(actual, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function decodeAesKey(encodingAesKey) {
  if (typeof encodingAesKey !== 'string' || encodingAesKey.length !== 43) {
    throw new Error('WECOM_ENCODING_AES_KEY must contain exactly 43 characters');
  }

  const key = Buffer.from(`${encodingAesKey}=`, 'base64');
  if (key.length !== 32) {
    throw new Error('WECOM_ENCODING_AES_KEY is not valid Base64');
  }
  return key;
}

function removePkcs7Padding(buffer) {
  if (buffer.length === 0) {
    throw new Error('Decrypted payload is empty');
  }

  const paddingLength = buffer[buffer.length - 1];
  if (paddingLength < 1 || paddingLength > 32 || paddingLength > buffer.length) {
    throw new Error('Invalid PKCS#7 padding');
  }

  for (let index = buffer.length - paddingLength; index < buffer.length; index += 1) {
    if (buffer[index] !== paddingLength) {
      throw new Error('Invalid PKCS#7 padding');
    }
  }
  return buffer.subarray(0, buffer.length - paddingLength);
}

function decryptEchoStr({ encodingAesKey, receiveId, encrypted }) {
  const key = decodeAesKey(encodingAesKey);
  let ciphertext;

  try {
    ciphertext = Buffer.from(encrypted, 'base64');
  } catch {
    throw new Error('echostr is not valid Base64');
  }

  if (ciphertext.length === 0 || ciphertext.length % 16 !== 0) {
    throw new Error('echostr has an invalid encrypted length');
  }

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
  decipher.setAutoPadding(false);
  const padded = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const payload = removePkcs7Padding(padded);

  if (payload.length < 20) {
    throw new Error('Decrypted payload is too short');
  }

  const messageLength = payload.readUInt32BE(16);
  const messageEnd = 20 + messageLength;
  if (messageEnd > payload.length) {
    throw new Error('Decrypted message length is invalid');
  }

  const message = payload.subarray(20, messageEnd).toString('utf8');
  const decryptedReceiveId = payload.subarray(messageEnd).toString('utf8');
  if (decryptedReceiveId !== receiveId) {
    throw new Error('Decrypted receiveid does not match WECOM_CORP_ID');
  }

  return message;
}

function verifyAndDecryptEchoStr({
  token,
  encodingAesKey,
  receiveId,
  msgSignature,
  timestamp,
  nonce,
  echostr
}) {
  const expectedSignature = getSignature(token, timestamp, nonce, echostr);
  if (!signaturesMatch(msgSignature, expectedSignature)) {
    throw new Error('Invalid WeCom callback signature');
  }

  return decryptEchoStr({ encodingAesKey, receiveId, encrypted: echostr });
}

module.exports = { decryptEchoStr, getSignature, verifyAndDecryptEchoStr };
