# WeCom Function Lab

A minimal Node.js sandbox for examining WeCom functions. The first function is a WeCom Customer Service callback suitable for an initial Render deployment.

## Run locally

```sh
npm install
cp .env.example .env
PORT=3000 \
WECOM_TOKEN=your-token \
WECOM_ENCODING_AES_KEY=your-43-character-key \
WECOM_CORP_ID=your-corp-id \
WECOM_KF_SECRET=your-customer-service-secret \
npm start
```

The GET callback must use a real encrypted `echostr` and matching `msg_signature`, so the simplest verification is saving the callback configuration in WeCom. A plain `echostr=hello` curl request is expected to fail after signature verification is enabled. You can still test the notification acknowledgement:

```sh
curl -X POST -H 'Content-Type: application/xml' --data '<xml><Encrypt>sample</Encrypt></xml>' http://localhost:3000/callback
```

The expected POST response is `success`.

## Deploy on Render

1. Push this directory to a Git repository.
2. In Render, create a Blueprint from the repository. `render.yaml` supplies the build, start, and health-check settings.
3. Set `WECOM_TOKEN`, `WECOM_ENCODING_AES_KEY`, `WECOM_CORP_ID`, and `WECOM_KF_SECRET` in Render. The first two values must exactly match the WeCom Customer Service callback configuration; the Corp ID comes from the enterprise information page, and the secret must be the dedicated WeCom Customer Service secret.
4. Configure the public callback URL in WeCom as `https://YOUR-SERVICE.onrender.com/callback`.

Render supplies `PORT`; the service listens on it automatically.

## Security status

GET URL verification validates and decrypts `echostr`. POST callbacks are also verified and decrypted; `kf_msg_or_event` notifications trigger `kf/sync_msg`, and each new customer text message is echoed through `kf/send_msg` with ` CB response` appended. This is still an examination service: deduplication is only held in process memory and no durable cursor or message state is stored.
