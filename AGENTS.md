# WeCom Function Lab

## Purpose

This repository exists only to examine and learn WeCom (Enterprise WeChat) functions through small, isolated experiments. It is not currently a production application.

The first experiment is an HTTP callback for WeCom Customer Service messages. It supports:

- `GET /callback` for the callback URL verification request.
- `POST /callback` for receiving the raw encrypted XML notification body.
- `GET /` as a simple deployment health check.

## Current limitations

`GET /callback` validates the WeCom SHA-1 signature, decrypts `echostr`, and validates the embedded receiveid. `POST /callback` validates and decrypts the event, acknowledges it promptly, calls `kf/sync_msg`, and echoes new customer text through `kf/send_msg` with ` CB response` appended. Message IDs are deduplicated only in memory; no cursor or state survives a restart.

Treat all callback payloads as untrusted. Never commit real tokens, encoding AES keys, corp IDs, secrets, decrypted customer content, or `.env` files. Avoid logging full customer messages or personal information.

## Project conventions

- Use Node.js 20 or newer and CommonJS modules.
- Keep each WeCom experiment small and independently understandable.
- Preserve the exact raw request body for callback signature verification and decryption; do not add a global JSON or XML parser ahead of callback routes.
- Read configuration and credentials from environment variables.
- Keep `/callback` backward compatible as later verification and decryption stages are added.
- Add tests when implementing signature verification, AES decryption, XML parsing, or outbound API calls.
- Update `README.md` and this file when the project scope or security posture changes.

## Verification

Before considering a change complete, run `npm test` and manually verify the health endpoint and both callback methods. Do not claim production readiness until signature validation, AES decryption, replay resistance, safe logging, and appropriate error handling are implemented.
