# Contributing

Thanks for contributing to Cloudflare Tunnel Panel.

This project is intentionally scoped as a remote-docker-only control plane for:

- hostname-to-origin bindings
- Cloudflare Tunnel ingress publication
- DNS synchronization
- connector and binding observability

It is intentionally **not** a Docker lifecycle manager for `cloudflared`.

## Before you start

- Read [README.md](./README.md)
- Read [DEPLOYMENT.md](./DEPLOYMENT.md)
- Read [REMOTE_DOCKER_CONNECTOR_DESIGN.md](./REMOTE_DOCKER_CONNECTOR_DESIGN.md)

When proposing changes, try to preserve that product boundary unless the issue
explicitly argues for a scope change.

## Development setup

```bash
npm ci
npm run lint
npm run build
```

Local runtime defaults are driven by:

- `.env.production.example`
- `.env.cloudflared.example`

Do not commit real credentials, runtime databases, or private deployment data.

## Contribution guidelines

- Keep changes focused and easy to review
- Prefer small, descriptive commits
- Update docs when behavior or deployment assumptions change
- Preserve the remote-docker-only runtime model unless a deliberate redesign is requested
- Avoid introducing Docker socket access or host lifecycle ownership without a documented design decision

## UI and copy

- Keep operator-facing wording explicit and practical
- Prefer clear status language over vague platform jargon
- Avoid implying that CTP can start, stop, or restart the connector container

## Testing expectations

Before opening a PR, run:

```bash
npm run lint
npm run build
```

If your change affects deployment, also validate:

```bash
docker compose -f docker-compose.yml config
docker compose build ctp
```

## Safe README screenshots

Do not generate screenshots from a live deployment database or real `.env` file.

Use the demo-data workflow documented in [docs/README_ASSETS.md](./docs/README_ASSETS.md).
That workflow is designed to avoid leaking:

- real hostnames
- real account IDs
- real DNS records
- local machine paths
- private runtime state

## Pull requests

Good pull requests usually include:

- what changed
- why it changed
- deployment or UX impact
- screenshots when relevant
- testing notes

If a change intentionally expands project scope, call that out clearly so it can
be reviewed as a product decision, not just an implementation detail.
