# WeCom Function Lab

A minimal Node.js sandbox for examining WeCom functions. The first function is a WeCom Customer Service callback suitable for an initial Render deployment.

## Run locally

```sh
npm install
cp .env.example .env
PORT=3000 WECOM_TOKEN=your-token npm start
```

Try the verification and notification endpoints:

```sh
curl 'http://localhost:3000/callback?echostr=hello&timestamp=1&nonce=2&signature=ignored'
curl -X POST -H 'Content-Type: application/xml' --data '<xml><Encrypt>sample</Encrypt></xml>' http://localhost:3000/callback
```

The expected responses are `hello` and `success`.

## Deploy on Render

1. Push this directory to a Git repository.
2. In Render, create a Blueprint from the repository. `render.yaml` supplies the build, start, and health-check settings.
3. Set the secret `WECOM_TOKEN` environment variable in Render.
4. Configure the public callback URL in WeCom as `https://YOUR-SERVICE.onrender.com/callback`.

Render supplies `PORT`; the service listens on it automatically.

## Security status

This is an examination-only callback. It does **not** yet validate signatures or decrypt encrypted WeCom messages. Do not use it as a production message processor until those protections are implemented.
