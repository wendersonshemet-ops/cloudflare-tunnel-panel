# Security Policy

## Supported deployment model

This repository currently supports one production shape:

- CTP in Docker
- `cloudflared` in Docker
- connector lifecycle managed outside the panel

## Reporting a vulnerability

If you discover a security issue, do not publish secrets, tokens, private
hostnames, or exploit details in a public issue.

Please contact the maintainer through a private channel and include:

- a short description of the issue
- affected version or commit
- reproduction steps
- expected impact
- any suggested mitigation

Until a dedicated security contact is documented, prefer a private report over
a public issue for anything involving credentials, authorization, or remote
access.

## Secret handling guidance

- Never commit real `.env` files
- Never commit Cloudflare API tokens or tunnel tokens
- Redact account IDs, zone IDs, hostnames, and internal paths before sharing
  logs
- Treat SQLite data under `data/` as private runtime state

Example env files in this repository are placeholders only and are intended to
be safe for publication.
