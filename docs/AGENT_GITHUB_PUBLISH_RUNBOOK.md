# Agent GitHub Publish Runbook

This runbook is for agents that need to prepare a local project for GitHub,
create the repository, push the code, and finish with a clean handoff.

It is written to support a one-pass workflow:

- ask for the minimum required information once
- prepare the repository safely
- create or verify the GitHub repository
- commit and push without leaking credentials
- update metadata and close with a clear summary

## Scope

Use this workflow when the user wants an agent to:

- make a local project GitHub-ready
- create a new GitHub repository
- push local code to GitHub
- set basic repository metadata

## Non-negotiables

- Never commit real secrets, `.env` files, databases, logs, or local runtime artifacts.
- Never write a GitHub PAT into a tracked file.
- Never leave a PAT embedded in the git remote URL.
- Prefer a temporary PAT and tell the user to revoke it after the push.
- Scrub private hostnames, account IDs, internal IPs, and local paths from docs before publishing.

## Required information from the user

Ask for these items once, in a single message if possible:

- GitHub owner
  - a personal username or organization name
- Repository name
- Visibility
  - `public` or `private`
- Authentication method
  - preferred: temporary GitHub PAT
  - alternative: already-authenticated `gh`

If the user wants a more polished result, also ask for:

- preferred license
  - recommended default: `MIT`
- repository description
- homepage URL
- topics
- commit author name
- commit author email

## Safe defaults

If the user does not provide everything, use these defaults unless the repo
context suggests otherwise:

- default branch: `main`
- license: `MIT`
- description: one concise sentence derived from the README
- topics: 5 to 8 relevant topics based on the project
- commit author name:
  - if unknown, use the GitHub login
- commit author email:
  - if unknown, use the GitHub noreply format when the account ID is known:
    - `<github-id>+<login>@users.noreply.github.com`

## Token guidance

Do not store the actual token in this repository or in documentation.

Practical guidance:

- simplest baseline:
  - classic PAT
  - `public_repo` or `repo` for public repo creation
  - `repo` for private repo creation
- for fine-grained tokens:
  - ensure the token can create repositories for the chosen owner
  - ensure it has repository administration write access for creation
  - ensure it can write repository contents for push operations

Notes:

- some organizations restrict classic PAT usage
- some organizations require SSO authorization for PAT use
- if the owner is an organization, the authenticated user must have permission
  to create repositories there

Official references:

- GitHub PAT management:
  - [Managing your personal access tokens](https://docs.github.com/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- GitHub REST repository endpoints:
  - [REST API endpoints for repositories](https://docs.github.com/rest/repos/repos)

## One-shot user intake template

Use something like this when information is missing:

```text
Please send these in one reply:

- GitHub owner:
- Repository name:
- Visibility: public/private
- License preference: MIT / Apache-2.0 / GPL-3.0 / none
- Repository description: (optional)
- Homepage URL: (optional)
- Topics: (optional)
- Commit author name: (optional)
- Commit author email: (optional)
- GitHub PAT: temporary token preferred
```

## Pre-publish checklist

Before creating or pushing a repository:

1. Audit `.gitignore`
   - ensure `.env`, databases, logs, build output, and local tooling folders are ignored
2. Audit documentation
   - remove real hostnames, zone names, account IDs, internal IPs, and private paths
3. Confirm example env files use placeholders only
4. Verify the project builds cleanly
   - run lint/build when appropriate
5. Check whether the directory is already a git repository
6. Check whether the target GitHub repository already exists

## Preferred execution order

### 1. Prepare the repository locally

- harden `.gitignore`
- sanitize README and docs
- add standard public-facing project files when useful:
  - `LICENSE`
  - `SECURITY.md`
  - `CONTRIBUTING.md`
  - issue and PR templates

### 2. Verify local quality gates

Recommended commands:

```bash
npm run lint
npm run build
```

For Docker projects, also consider:

```bash
docker compose -f docker-compose.yml config
docker compose build
```

### 3. Initialize git if needed

```bash
git init -b main
```

### 4. Resolve commit identity

If the user did not provide author info:

1. query the authenticated GitHub user via API
2. use the login as `user.name`
3. if possible, use the GitHub noreply email format for `user.email`

Example:

```bash
git config user.name "OWNER_LOGIN"
git config user.email "GITHUB_ID+OWNER_LOGIN@users.noreply.github.com"
```

### 5. Check whether the repository already exists

Use:

- `GET /repos/{owner}/{repo}`

If it exists:

- reuse it
- do not recreate it

If it does not exist:

- create it with the appropriate endpoint

### 6. Create the GitHub repository

For a personal account:

- `POST https://api.github.com/user/repos`

For an organization:

- `POST https://api.github.com/orgs/{org}/repos`

Recommended body fields:

- `name`
- `description`
- `homepage`
- `private`

Optional:

- `has_issues`
- `has_wiki`
- `has_projects`

### 7. Commit local changes

```bash
git add .
git commit -m "chore: prepare public release"
```

### 8. Add a clean remote

Use a clean HTTPS remote with no embedded credentials:

```bash
git remote add origin https://github.com/OWNER/REPO.git
```

### 9. Push without storing the PAT in the remote URL

Preferred PowerShell pattern:

```powershell
$pair = "x-access-token:$env:GITHUB_PAT"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$b64 = [Convert]::ToBase64String($bytes)
git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $b64" push -u origin main
```

Why this pattern is preferred:

- the remote URL stays clean
- credentials are not written into `.git/config`
- the push is authenticated only for that command

### 10. Set repository metadata after push

Useful metadata tasks:

- description
- homepage
- topics

Common endpoints:

- `PATCH /repos/{owner}/{repo}`
- `PUT /repos/{owner}/{repo}/topics`

### 11. Confirm the final state

Verify:

- local git status is clean
- `origin` points to the clean HTTPS remote
- default branch is tracking the remote
- the repo URL opens correctly
- screenshots and docs render as expected on GitHub

## PowerShell API examples

### Read the authenticated GitHub user

```powershell
$headers = @{
  Authorization = "token $env:GITHUB_PAT"
  "User-Agent" = "agent"
  Accept = "application/vnd.github+json"
}

Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/user"
```

### Create a personal repository

```powershell
$headers = @{
  Authorization = "token $env:GITHUB_PAT"
  "User-Agent" = "agent"
  Accept = "application/vnd.github+json"
}

$body = @{
  name = "repo-name"
  private = $false
  description = "Short repository description"
  homepage = ""
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Headers $headers `
  -Uri "https://api.github.com/user/repos" `
  -Body $body `
  -ContentType "application/json"
```

### Create an organization repository

```powershell
$headers = @{
  Authorization = "token $env:GITHUB_PAT"
  "User-Agent" = "agent"
  Accept = "application/vnd.github+json"
}

$body = @{
  name = "repo-name"
  private = $false
  description = "Short repository description"
  homepage = ""
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Headers $headers `
  -Uri "https://api.github.com/orgs/ORG_NAME/repos" `
  -Body $body `
  -ContentType "application/json"
```

## What a good final result includes

By the end of the workflow, the agent should ideally deliver:

- sanitized public repository contents
- initialized git history
- clean remote configuration
- pushed `main` branch
- license and core documentation
- basic GitHub metadata
- contribution and review templates when appropriate
- a short closeout summary with:
  - repository URL
  - last commit SHA
  - what was added or cleaned up
  - reminder to revoke the temporary PAT

## What not to do

- Do not echo the PAT back in chat after receiving it.
- Do not save the PAT into `.env`, README, docs, scripts, or remote URLs.
- Do not commit private runtime artifacts just because the folder is not yet a git repo.
- Do not assume the user has already set `git user.name` and `git user.email`.
- Do not create duplicate repositories if the target already exists.

## Recommended post-publish reminder

After a successful push, tell the user to:

1. verify the repository page
2. revoke the temporary GitHub PAT
3. optionally create the first tagged release

## Suggested one-pass agent behavior

If the user asks for a GitHub publish workflow, the agent should:

1. gather the required inputs once
2. sanitize the repository first
3. verify local quality checks
4. create the repository only after the local repo is ready
5. push with clean credential handling
6. finish by reporting the exact URL and reminding the user to revoke the token
