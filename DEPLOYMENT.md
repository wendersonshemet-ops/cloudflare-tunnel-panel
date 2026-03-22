# Deployment Guide

This repository is intentionally narrowed to one runtime model:

- `ctp` runs in Docker
- `cloudflared` runs in Docker
- both services use `network_mode: host`
- CTP manages Cloudflare DNS and tunnel ingress only
- Docker owns connector lifecycle

## 1. Prepare the project directory

Clone or copy the project to your Docker host. Example:

```text
/opt/cloudflare-tunnel-panel
```

## 2. Create environment files

Create `.env.production` from `.env.production.example`.

Required values:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Optional values:

- `HEALTH_TIMEOUT_MS`
- `TUNNEL_SELECTION_STRATEGY`
- `SERVICE_DISCOVERY_DOCKER_ENABLED`
- `SERVICE_DISCOVERY_SYSTEMD_ENABLED`
- `PANEL_PASSWORD`

Create `.env.cloudflared` from `.env.cloudflared.example`.

Required value:

- `TUNNEL_TOKEN`

These credentials serve different purposes:

- `CLOUDFLARE_API_TOKEN` is used by CTP to manage DNS and tunnel ingress
- `TUNNEL_TOKEN` is used by the `cloudflared` connector to attach to a
  remote-managed tunnel

## 3. Build the CTP image on the target host

```bash
docker compose build ctp
```

The compose file builds the panel image locally with `build: .`.

## 4. Start the stack

```bash
docker compose up -d
```

Services started by the compose stack:

- `ctp`
- `cloudflared`

Because both services use host networking:

- CTP listens on host port `PORT`
- origins such as `http://127.0.0.1:8080` remain valid from inside both
  containers

If port `3000` is already occupied, change `PORT` in `.env.production`.
Example:

```env
PORT=33018
```

The compose healthcheck follows the configured port automatically.

## 5. Connector runtime

The `cloudflared` service runs this command:

```bash
cloudflared tunnel --no-autoupdate run
```

The tunnel connector token is injected through `.env.cloudflared`.

This remains necessary even though CTP can manage Cloudflare-side resources:

- CTP can update remote tunnel ingress
- CTP can create and update DNS records
- only the running `cloudflared` connector can carry traffic for the tunnel

CTP does not:

- start the connector container
- stop the connector container
- restart the connector container
- reload host services

## 6. What happens when a binding is created

When you create or update a binding, CTP will:

1. publish the expected ingress rules to Cloudflare
2. create or update the proxied CNAME record
3. run local origin health checks from the `ctp` container
4. run public HTTPS checks against the hostname
5. compare expected bindings with current remote ingress and report drift

## 7. Observation model

`/api/cloudflared` and the dashboard expose observation-only status:

- known tunnels
- connector counts
- connector status derived from Cloudflare
- last remote publish result
- remote ingress drift

`/api/cloudflared/service` is intentionally unsupported in this product shape
because connector lifecycle is externally managed by Docker.

## 8. Token validation

Validate the API token against the endpoints CTP actually needs:

- `GET /client/v4/zones`
- `GET /client/v4/accounts/<account-id>/cfd_tunnel`

If a token can read zones but cannot read tunnels, DNS operations may work while
tunnel sync and ingress publication fail.

## 9. Example verification target

Example binding:

- hostname: `app.example.com`
- origin: `http://127.0.0.1:8080`

Expected result:

- CTP publishes tunnel ingress successfully
- CTP creates or updates the proxied CNAME
- `https://app.example.com/` becomes reachable
- stopping the `cloudflared` container is reflected in CTP as connector
  degradation or offline state
- CTP does not attempt to restart the connector
