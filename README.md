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
3. Set `WECOM_TOKEN`, `WECOM_ENCODING_AES_KEY`, and `WECOM_CORP_ID` in Render. The first two values must exactly match the WeCom Customer Service callback configuration; the Corp ID comes from the enterprise information page.
4. Configure the public callback URL in WeCom as `https://YOUR-SERVICE.onrender.com/callback`.

Render supplies `PORT`; the service listens on it automatically.

## Security status

GET URL verification validates the SHA-1 signature, decrypts `echostr`, and checks its embedded receiveid against `WECOM_CORP_ID`. POST notifications are still only acknowledged: their signatures and encrypted XML bodies are not yet validated or decrypted. Do not use this as a production message processor until POST verification and decryption are implemented.
