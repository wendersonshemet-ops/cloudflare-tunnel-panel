# Roadmap

This roadmap focuses on making Cloudflare Tunnel Panel more reliable as a
remote-docker-only control plane.

## Near term

- Finalize the remote-only UX so all local-systemd language and legacy controls
  are removed from the UI and API responses
- Add better tunnel permission diagnostics so operators can distinguish missing
  `Tunnel Read` from missing `Tunnel Edit`
- Improve connector status presentation with clearer degraded, offline, and
  drift states
- Add a first-run setup guide inside the panel for Cloudflare API token,
  account ID, and connector token workflows

## Next wave

- Add import and export support for bindings and service definitions
- Add audit-friendly operation history with richer filtering and retention
- Add safe readonly diagnostics for Docker-hosted deployments without requiring
  Docker socket access
- Improve public reachability checks with retry policies and clearer error
  attribution between DNS, tunnel, and origin failures

## Stretch goals

- Add multi-operator authentication options beyond a single panel password
- Add role-based permissions for readonly versus management access
- Add notification hooks for tunnel offline events and binding health failures
- Add a release pipeline for container images and versioned changelogs

## Non-goals

- Managing the `cloudflared` container lifecycle from the panel
- Mounting the Docker socket into CTP
- Reintroducing host `systemd` or local config-file ownership as a primary
  deployment mode
