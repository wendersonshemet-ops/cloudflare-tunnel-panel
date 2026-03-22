# Agent Prompt Template

Use this template when you want another agent to take a local project from its
current state to a clean GitHub repository and optional tagged release in one
pass.

This template is designed to work together with:

- [Agent GitHub Publish Runbook](./AGENT_GITHUB_PUBLISH_RUNBOOK.md)
- [GitHub Publish Intake Template](./GITHUB_PUBLISH_INTAKE_TEMPLATE.md)
- [Release Playbook](./RELEASE_PLAYBOOK.md)

## How to use it

1. Fill in the placeholders below.
2. Paste the completed prompt into the agent session.
3. Provide the completed intake form once.
4. Let the agent execute the flow end to end.

## Standard prompt

```text
You are responsible for preparing this project for GitHub and completing the publish workflow end to end.

Project path:
- <LOCAL_PROJECT_PATH>

Your job:
- sanitize the repository for public or private GitHub publication
- verify the local project is in a safe state to publish
- create or verify the target GitHub repository
- commit and push the code
- set basic repository metadata
- if requested, create a tag and GitHub release

Execution rules:
- follow docs/AGENT_GITHUB_PUBLISH_RUNBOOK.md
- if needed, collect missing information once using docs/GITHUB_PUBLISH_INTAKE_TEMPLATE.md
- do not ask for the same information twice unless the original answer is unusable
- do not commit secrets, runtime databases, logs, local caches, or private deployment artifacts
- do not leave credentials embedded in the git remote URL
- use a one-command auth header approach for PAT-authenticated push
- scrub private hostnames, IPs, account IDs, local paths, and tokens from docs before publishing
- use sensible defaults when optional fields are missing
- if the user did not provide a license, default to MIT unless project constraints suggest otherwise
- if the user did not provide commit identity, prefer the GitHub login and noreply email when available
- if the repository already exists, reuse it and do not create a duplicate
- if a release is requested, follow docs/RELEASE_PLAYBOOK.md

Required outcomes:
- local repository is git-initialized if needed
- public-facing docs are cleaned up
- git status is clean after the final commit
- remote origin is configured with a clean HTTPS URL
- main branch is pushed
- repository description and topics are set if available
- release tag and GitHub release are created if requested

Closeout requirements:
- report the final repository URL
- report the latest commit SHA
- list the main cleanup and polish changes made
- clearly state whether a release was created
- remind the user to revoke the temporary GitHub PAT after success

User-provided intake:
<PASTE_COMPLETED_INTAKE_FORM_HERE>
```

## Minimal prompt variant

Use this when the repository is already clean and the agent only needs to push:

```text
Push this local project to GitHub using the supplied intake information.

Requirements:
- do not commit secrets
- use docs/AGENT_GITHUB_PUBLISH_RUNBOOK.md
- use clean PAT handling
- create the repo if missing
- push main
- report the final URL and remind the user to revoke the PAT

User-provided intake:
<PASTE_COMPLETED_INTAKE_FORM_HERE>
```

## Recommended defaults for the prompt

If you want the agent to behave consistently, prefer these defaults:

- branch: `main`
- license: `MIT`
- visibility: explicit, never inferred
- metadata: description plus 5 to 8 topics
- commit style:
  - `chore: prepare public release`
  - `docs: improve project homepage`
  - `docs: add release playbook`

## Notes for agent operators

- If the project contains screenshots, require a sanitized screenshot workflow.
- If the project has no git repository yet, the agent must fix `.gitignore`
  before the first `git add .`.
- If the user supplies a PAT in chat, the agent must never echo the PAT back in
  the final response.
