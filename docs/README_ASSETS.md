# README Assets Workflow

This document explains how to generate README screenshots and other public-facing
assets without leaking private deployment data.

## Rule zero

Do not generate screenshots from:

- `.env.production.local`
- a live deployment database
- real Cloudflare credentials
- private hostnames or DNS state

Use a sanitized demo database instead.

## Seed the demo database

Run:

```bash
npm run demo:seed-readme
```

This creates a local demo database at:

```text
data/readme-demo.db
```

It also creates a login-specific demo database at:

```text
data/readme-login-demo.db
```

The seeded data uses safe placeholders such as:

- `example.com`
- `app.example.com`
- `nas.example.com`
- `prod-tunnel`
- `home-tunnel`

## Start the app with demo data

### PowerShell

Bindings, settings, and overview screenshots without login:

```powershell
$env:DATABASE_URL = "data/readme-demo.db"
$env:PORT = "33020"
$env:PANEL_PASSWORD = ""
npm run dev
```

Login page screenshot:

```powershell
$env:DATABASE_URL = "data/readme-login-demo.db"
$env:PORT = "33021"
npm run dev
```

### Bash

Bindings, settings, and overview screenshots without login:

```bash
DATABASE_URL=data/readme-demo.db PORT=33020 PANEL_PASSWORD= npm run dev
```

Login page screenshot:

```bash
DATABASE_URL=data/readme-login-demo.db PORT=33021 npm run dev
```

## Capture screenshots with Playwright

If you have Playwright available, you can capture screenshots like this:

```bash
npx playwright screenshot http://127.0.0.1:33021/login docs/readme/screenshots/login.png
npx playwright screenshot http://127.0.0.1:33020/bindings docs/readme/screenshots/bindings.png
npx playwright screenshot http://127.0.0.1:33020/ docs/readme/screenshots/overview.png
npx playwright screenshot http://127.0.0.1:33020/settings docs/readme/screenshots/settings.png
```

## Review before committing

Before committing screenshots, verify that they do not expose:

- real hostnames
- real Cloudflare account IDs
- tokens or passwords
- private Docker container names
- internal machine paths

If anything sensitive appears, discard the images and regenerate from demo data.
