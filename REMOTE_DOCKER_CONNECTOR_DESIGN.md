# CTP Remote Docker Connector Design

## Overview

This document describes the supported deployment model for
`cloudflare-tunnel-panel` (CTP):

- `cloudflared` runs in Docker as a standalone connector
- CTP does not manage Docker lifecycle
- CTP manages Cloudflare-side resources and application bindings
- CTP observes whether the connector is online and whether published bindings
  are reachable

The design keeps responsibilities separate:

- Docker hosts the connector process
- Cloudflare stores tunnel routing and DNS state
- CTP owns desired-state management for bindings and observability

## Goals

- Support a Dockerized `cloudflared` connector without Docker socket access
- Keep CTP responsible for:
  - local service registry
  - hostname-to-service binding
  - DNS synchronization
  - remote tunnel ingress configuration
- Show whether the connector is online, degraded, or offline
- Show whether a published hostname is externally reachable

## Non-goals

- CTP will not run `docker start`, `docker stop`, `docker restart`, or `docker compose`
- CTP will not install or update Docker
- CTP will not install or update `cloudflared` inside the container
- CTP will not write host-side `cloudflared` config files in this mode
- CTP will not depend on `systemctl` for tunnel apply or reload

## Deployment model

### Runtime topology

Recommended deployment:

1. A Docker container runs:

   ```bash
   cloudflared tunnel run --token <TUNNEL_TOKEN>
   ```

2. The tunnel is remote-managed by Cloudflare.

3. CTP uses the Cloudflare API to:
   - list zones
   - list tunnels
   - update tunnel ingress rules
   - create, update, and delete DNS records

4. Local services remain registered in CTP as targets such as:
   - `http://127.0.0.1:8080`
   - `http://127.0.0.1:3001`
   - `https://127.0.0.1:8443`

### Responsibility split

Docker side:

- keep the `cloudflared` connector process running
- reconnect to Cloudflare when restarted
- expose no lifecycle management contract to CTP

Cloudflare side:

- store ingress configuration for the tunnel
- maintain connector status and active connections
- resolve hostnames to the tunnel via proxied CNAME records

CTP side:

- persist desired bindings in SQLite
- publish ingress rules through the Cloudflare API
- publish DNS records through the Cloudflare API
- check connector health and binding reachability

### Why the token is still required

Even if CTP can create or update Cloudflare-side tunnel resources, the
connector container still needs `TUNNEL_TOKEN` to authenticate as a live
connector for that tunnel. Without a running authenticated connector, there is
no runtime path from the Cloudflare edge back to the origin services.

## Required Cloudflare permissions

CTP needs an API token with at least:

- `Zone: Read`
- `DNS: Read`
- `DNS: Edit`
- `Account: Cloudflare Tunnel: Read`
- `Account: Cloudflare Tunnel: Edit`

Without `Tunnel: Edit`, CTP can observe but cannot publish ingress rules.
Without `Tunnel: Read`, CTP cannot reliably determine connector status.

## Functional design

### 1. Binding publish flow

When an operator creates a binding such as:

- hostname: `app.example.com`
- target service: `http://127.0.0.1:8080`
- tunnel: `11111111-2222-3333-4444-555555555555`

CTP should:

1. validate that the hostname is not already bound
2. validate that the local service exists in the CTP database
3. validate that a tunnel is selected
4. update remote ingress through the Cloudflare API
5. ensure the CNAME record points to `<tunnel-id>.cfargotunnel.com`
6. run a reachability check against the public hostname
7. store resulting statuses in SQLite

At no point should CTP attempt to reload a local `cloudflared` process.

### 2. Connector health detection

CTP should expose connector health using the Cloudflare API, not Docker.

Primary signals:

- `listTunnels()` results
- active connector count
- Cloudflare-reported tunnel status

Suggested state mapping:

- `online`
  - tunnel exists
  - Cloudflare reports one or more active connections
- `degraded`
  - tunnel exists
  - config publish succeeds
  - connector count is `0` or status is ambiguous
- `offline`
  - tunnel is missing
  - the API cannot find the tunnel
  - or connector count remains `0` together with failed access checks

### 3. Binding reachability detection

Binding reachability should remain separate from connector health.

Suggested checks:

- DNS check
  - confirm a proxied CNAME exists
  - confirm it points to `<tunnel-id>.cfargotunnel.com`
- remote access check
  - perform an HTTPS request against the public hostname
  - treat `200-399` as healthy
  - treat `502/503` as a tunnel or origin problem
  - record the status code and message
- optional local origin check
  - probe the local service target from the `ctp` container
  - useful for distinguishing origin failure from tunnel failure

This gives three independent state dimensions:

- `dnsStatus`
- `tunnelStatus`
- `accessStatus`

## Product rules

### Operating mode

The supported operating mode is:

- `remote-docker`

Meaning:

- tunnel config is remote-managed by the Cloudflare API
- connector runtime is external to CTP
- CTP does not perform local apply, reload, start, or stop operations

### UI behavior

In `remote-docker` mode:

- show tunnel online status
- show connector count
- show last Cloudflare sync result
- show binding health
- hide or disable:
  - start service
  - stop service
  - apply local config
  - config path validation controls

Suggested wording:

- `Connector runtime is externally managed by Docker`
- `CTP can observe connector health but cannot start or stop the container`

### Error messaging

Use explicit operator-facing messages:

- `Cloudflare Tunnel API permissions missing; cannot publish ingress rules`
- `Connector appears offline in Cloudflare; check Docker container runtime`
- `DNS record is healthy, but public access check failed`
- `CTP does not manage Docker lifecycle in this mode`

## Backend design

### Cloudflare adapter

Keep and strengthen:

- `listZones()`
- `listTunnels()`
- `getTunnelConfig()`
- `putTunnelConfig()`
- DNS CRUD methods

No Docker lifecycle calls belong here.

### Orchestrator

Desired behavior:

- always use the remote API path for tunnel publication
- never fall back to local config file writes
- never invoke local apply or service restart behavior

### Cloudflared adapter

In this model, the adapter should be observation-only or bypassed.

Allowed:

- lightweight capability inspection if needed

Not allowed:

- `startService()`
- `stopService()`
- `applyConfig()`

### Dashboard state

The dashboard should combine:

- Cloudflare sync state
- connector state from the Cloudflare API
- binding health checks

Lack of `systemctl` should never be treated as an error in this mode.

## API behavior

### Primary control surface

Main control endpoints remain:

- `GET /api/dashboard`
- `GET /api/bindings`
- `POST /api/bindings`
- `PATCH /api/bindings/:id`
- `DELETE /api/bindings/:id`
- `POST /api/bindings/:id/dns`
- `GET /api/settings`
- `POST /api/settings`

### Guardrail endpoint

`POST /api/cloudflared/service` should remain present only as a guardrail and
return an explicit unsupported response, such as:

- `Service lifecycle is externally managed by Docker`

### Deployment endpoint

`POST /api/deploy` should publish through the remote Cloudflare API only:

- no local file write
- no `systemd` reload
- no host service restart

## Health model

### Tunnel status

- `healthy`
  - connector count is greater than `0`
- `warning`
  - tunnel exists but connector count is `0`
  - or Cloudflare sync is stale
- `error`
  - tunnel is missing
  - or the Cloudflare API fails with auth or permission errors

### Binding access status

- `healthy`
  - the public hostname returns success
- `warning`
  - DNS is correct but the endpoint returns `4xx` or `5xx`
- `error`
  - DNS is missing
  - tunnel is missing
  - or public checks repeatedly fail

## Migration guidance

### From host-managed `cloudflared`

1. keep existing service records and bindings
2. add the Cloudflare API token and account ID
3. ensure the Docker connector is already running:

   ```bash
   cloudflared tunnel run --token <TUNNEL_TOKEN>
   ```

4. trigger remote sync
5. publish bindings through the Cloudflare API
6. remove any operator expectations that CTP will manage local services

### From ad hoc `--url` connector mode

If the current connector command is:

```bash
cloudflared tunnel run --token <TUNNEL_TOKEN> --url http://localhost:8080
```

Migrate to:

```bash
cloudflared tunnel run --token <TUNNEL_TOKEN>
```

Then let CTP own ingress rules remotely.

This matters because:

- `--url` hardcodes a single origin at container startup
- API-managed ingress supports multiple hostname bindings
- CTP can then control hostname-to-service mapping centrally

## Risks

- If the API token lacks `Tunnel: Edit`, DNS sync may work while ingress
  publication fails
- If the Docker connector is offline, Cloudflare config may still look correct
  while traffic fails
- If operators manually edit tunnel config in Cloudflare, CTP can drift from
  remote desired state
- If the connector token changes, CTP cannot repair runtime because Docker
  lifecycle is intentionally out of scope

## Tradeoffs

Advantages:

- clean separation of concerns
- no Docker socket exposure to CTP
- no host `cloudflared` dependency for normal operation
- natural fit for remote-managed tunnels
- simpler security model

Disadvantages:

- CTP cannot self-heal a stopped connector container
- operators still need an external Docker deployment process
- some actions are observe-only rather than fully managed

## Acceptance criteria

The design is successful when all of the following are true:

- operators can run `cloudflared` in Docker without granting Docker access to CTP
- CTP can create a binding and publish ingress rules through the Cloudflare API
- CTP can create the matching proxied CNAME record
- CTP can show whether the connector is online
- CTP can show whether the published hostname is externally reachable
- CTP does not call `systemctl` or local config apply in `remote-docker` mode
- the UI clearly communicates that runtime lifecycle is external
