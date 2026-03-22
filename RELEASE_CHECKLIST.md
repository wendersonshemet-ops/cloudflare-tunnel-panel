# Release Checklist

Use this checklist before tagging a new public release.

## Repository hygiene

- Confirm `.env`, database, log, and local workspace files are ignored
- Confirm no private hostnames, account IDs, internal paths, or tokens appear
  in tracked files
- Confirm example environment files still use placeholders only
- Review [README.md](./README.md), [DEPLOYMENT.md](./DEPLOYMENT.md), and
  [SECURITY.md](./SECURITY.md) for accuracy

## Product validation

- Run `npm ci`
- Run `npm run lint`
- Run `npm run build`
- Verify Docker image build succeeds with `docker compose build ctp`
- Verify compose config resolves cleanly with
  `docker compose -f docker-compose.yml config`

## Runtime validation

- Verify CTP starts with `.env.production`
- Verify `cloudflared` starts with `.env.cloudflared`
- Verify the panel can read zones and tunnels with the configured API token
- Create a test binding and confirm ingress publication succeeds
- Confirm the matching proxied CNAME is created or updated
- Confirm public HTTPS reachability for a test hostname
- Stop the connector and confirm CTP reports degraded or offline status without
  trying to restart Docker

## Release preparation

- Update docs if runtime assumptions changed
- Update roadmap status if any planned items shipped
- Decide whether the release needs a migration note
- Write a concise changelog or release summary
- Tag the release in git and publish GitHub release notes
