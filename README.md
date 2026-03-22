# Cloudflare Tunnel Panel

Cloudflare Tunnel Panel (CTP) is a Docker-first control plane for managing
Cloudflare Tunnel hostname bindings without taking ownership of the connector
runtime itself.

In this project shape:

- `ctp` runs in Docker
- `cloudflared` also runs in Docker, but is treated as an external runtime
- CTP manages Cloudflare-side ingress rules and DNS records through the
  Cloudflare API
- CTP observes connector status and binding reachability
- CTP does not control Docker lifecycle, host `cloudflared` config, or `systemd`

## Features

- Create, update, and delete hostname-to-origin bindings
- Publish tunnel ingress rules through the Cloudflare Tunnel API
- Create and update proxied CNAME records automatically
- Detect connector health from Cloudflare tunnel status
- Check local origin health and public HTTPS reachability
- Detect drift between expected bindings and current remote ingress
- Run as a standalone Next.js production image in Docker

## Runtime model

This repository supports one deployment model:

- `remote-docker-only`

Recommended runtime topology:

- `ctp` container: control plane and health checks
- `cloudflared` container: `tunnel --no-autoupdate run`
- both services use `network_mode: host`

That host-networked model keeps existing targets such as
`http://127.0.0.1:8080` working from both containers without relying on
`host.docker.internal`.

## Responsibility split

CTP manages:

- Cloudflare tunnel ingress configuration
- proxied DNS records pointing to `<tunnel-id>.cfargotunnel.com`
- binding state and health metadata
- drift detection and connector observation

CTP does not manage:

- `docker start`, `docker stop`, or `docker restart`
- the host `cloudflared` binary
- `/etc/cloudflared/config.yml`
- `systemctl`
- PID files or local reload hooks

## Why `cloudflared` still needs `TUNNEL_TOKEN`

CTP can manage the Cloudflare-side tunnel configuration, but it still needs a
running connector process to carry traffic from Cloudflare back to your origin
services.

The `TUNNEL_TOKEN` gives the `cloudflared` container permission to join a
specific remote-managed tunnel. Without that token, CTP may successfully create
DNS records and ingress rules, but no live connector will be available to serve
requests.

## Prerequisites

- Docker Engine with the Compose plugin
- A Cloudflare account with at least one zone
- A remote-managed Cloudflare Tunnel
- A Cloudflare API token with:
  - `Zone Read`
  - `DNS Read`
  - `DNS Edit`
  - `Cloudflare Tunnel Read`
  - `Cloudflare Tunnel Edit`
- A connector token for the `cloudflared` container

## Quick start

1. Copy the example environment files.

   ```bash
   cp .env.production.example .env.production
   cp .env.cloudflared.example .env.cloudflared
   ```

2. Fill in the required values.

   `.env.production`

   ```env
   NODE_ENV=production
   PORT=3000
   HOSTNAME=0.0.0.0
   DATABASE_URL=/app/data/app.db
   CLOUDFLARE_API_TOKEN=
   CLOUDFLARE_ACCOUNT_ID=
   HEALTH_TIMEOUT_MS=3000
   TUNNEL_SELECTION_STRATEGY=least-bindings
   SERVICE_DISCOVERY_DOCKER_ENABLED=false
   SERVICE_DISCOVERY_SYSTEMD_ENABLED=false
   PANEL_PASSWORD=
   ```

   `.env.cloudflared`

   ```env
   TUNNEL_TOKEN=
   ```

3. Build and start the stack.

   ```bash
   docker compose build ctp
   docker compose up -d
   ```

4. Open the panel at `http://127.0.0.1:<PORT>`.

## Docker deployment

The repository ships with:

- `Dockerfile` for the CTP production image
- `docker-compose.yml` for the runtime stack
- `docker-compose.prod.yml` as the equivalent production compose file

Example deployment path:

```text
/opt/cloudflare-tunnel-panel
```

If host port `3000` is already in use, change `PORT` in `.env.production`.
Because the compose healthcheck reads `PORT`, no other compose changes are
required.

## Example binding flow

For a binding like:

- hostname: `app.example.com`
- origin: `http://127.0.0.1:8080`

CTP will:

1. publish the ingress rule to the selected tunnel
2. create or update the proxied CNAME record
3. check local origin reachability from inside the `ctp` container
4. check public HTTPS reachability through Cloudflare
5. display connector health using Cloudflare tunnel data

If the `cloudflared` container stops, CTP will show the connector as degraded
or offline, but it will not try to restart the container.

## Local development

```bash
npm ci
npm run lint
npm run build
```

## Scope and non-goals

This repository intentionally does not try to become a container orchestrator.

Out of scope:

- Docker socket integration
- container lifecycle management from the panel
- local `cloudflared` config file generation
- `systemd` integration
- host binary installation or upgrade workflows

## Repository safety

- Example environment files are safe placeholders
- real `.env` files, logs, databases, and local workspace data are ignored by
  git
- public docs use generic hostnames, paths, and deployment examples

## License

This project is released under the [MIT License](./LICENSE).

## Additional docs

- [Deployment Guide](./DEPLOYMENT.md)
- [Remote Docker Connector Design](./REMOTE_DOCKER_CONNECTOR_DESIGN.md)
- [Roadmap](./ROADMAP.md)
- [Release Checklist](./RELEASE_CHECKLIST.md)
- [Security Policy](./SECURITY.md)
