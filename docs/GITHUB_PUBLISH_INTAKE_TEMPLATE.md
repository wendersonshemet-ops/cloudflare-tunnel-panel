# GitHub Publish Intake Template

Use this form when you want the user to provide everything needed for a
GitHub-ready publish in a single reply.

This template is designed to reduce back-and-forth and support a one-pass
publish workflow.

## Copy-paste form

```text
GitHub Publish Intake

Repository owner:
- GitHub username or organization:

Repository target:
- Repository name:
- Visibility: public / private
- License: MIT / Apache-2.0 / GPL-3.0 / none

Repository metadata:
- Description:
- Homepage URL:
- Topics: comma-separated

Commit identity:
- Commit author name:
- Commit author email:

Authentication:
- Auth method: GitHub PAT / gh / existing remote
- GitHub PAT:

Release plan:
- Create release now: yes / no
- Release tag: e.g. v0.1.0
- Release title:
- Release notes summary:
- Draft release: yes / no
- Pre-release: yes / no

Constraints or preferences:
- Private data that must be scrubbed before publish:
- Files or folders that must never be committed:
- Anything the agent should preserve exactly:
```

## Required vs optional fields

Required:

- GitHub username or organization
- repository name
- visibility
- authentication method
- GitHub PAT or equivalent working auth

Strongly recommended:

- license
- description
- commit author name
- commit author email

Optional:

- homepage
- topics
- release fields
- extra constraints

## Safe defaults if the user omits values

- license:
  - `MIT`
- description:
  - derive from the README in one concise sentence
- topics:
  - derive 5 to 8 from the project domain
- commit author name:
  - GitHub login
- commit author email:
  - GitHub noreply email when available
- create release now:
  - `no`

## Fast-fill example

```text
GitHub Publish Intake

Repository owner:
- GitHub username or organization: example-user

Repository target:
- Repository name: cloudflare-tunnel-panel
- Visibility: public
- License: MIT

Repository metadata:
- Description: Remote-docker control plane for Cloudflare Tunnel ingress, DNS, and connector observability
- Homepage URL:
- Topics: cloudflare, cloudflare-tunnel, docker, dns, nextjs, self-hosted, devops

Commit identity:
- Commit author name: example-user
- Commit author email: 123456+example-user@users.noreply.github.com

Authentication:
- Auth method: GitHub PAT
- GitHub PAT: <temporary token>

Release plan:
- Create release now: no
- Release tag:
- Release title:
- Release notes summary:
- Draft release: no
- Pre-release: no

Constraints or preferences:
- Private data that must be scrubbed before publish: internal IPs, real hostnames, account IDs
- Files or folders that must never be committed: .env files, data/, logs, .next/
- Anything the agent should preserve exactly: existing Docker deployment model
```

## Agent instruction

If this form is fully filled, the agent should avoid asking open-ended follow-up
questions unless a provided value is clearly invalid or unsafe.
