# Release Playbook

This playbook standardizes the full flow from local repository cleanup to a
published GitHub repository and optional tagged GitHub release.

It is designed for agent-driven execution.

Related docs:

- [Agent GitHub Publish Runbook](./AGENT_GITHUB_PUBLISH_RUNBOOK.md)
- [Agent Prompt Template](./AGENT_PROMPT_TEMPLATE.md)
- [GitHub Publish Intake Template](./GITHUB_PUBLISH_INTAKE_TEMPLATE.md)
- [Release Checklist](../RELEASE_CHECKLIST.md)

## Goals

- collect user input once
- prepare the repository safely
- publish to GitHub cleanly
- optionally create a release tag and GitHub release
- leave a repeatable audit trail in git history and docs

## Phase 1: Intake

Gather all required information once using:

- [GitHub Publish Intake Template](./GITHUB_PUBLISH_INTAKE_TEMPLATE.md)

Validate the answers before executing:

- owner exists and is spelled correctly
- visibility is explicit
- auth method is usable
- PAT is present if PAT auth is chosen
- release tag is present if a release is requested

## Phase 2: Local repository preparation

Before any git commit:

1. harden `.gitignore`
2. scrub docs and examples
3. confirm example env files are placeholders only
4. add missing public project files when useful

Recommended supporting files:

- `LICENSE`
- `README.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- issue templates
- PR template

## Phase 3: Quality verification

Run the applicable checks for the project.

For a Node project:

```bash
npm ci
npm run lint
npm run build
```

For a Docker project:

```bash
docker compose -f docker-compose.yml config
docker compose build
```

If a check cannot run, record that clearly in the final handoff.

## Phase 4: Git initialization and first publish

If no git repository exists:

```bash
git init -b main
```

Set commit identity:

```bash
git config user.name "<COMMIT_AUTHOR_NAME>"
git config user.email "<COMMIT_AUTHOR_EMAIL>"
```

Create the initial commit:

```bash
git add .
git commit -m "chore: prepare public release"
```

## Phase 5: Repository creation or verification

Check whether the target repository already exists.

If it exists:

- reuse it
- do not recreate it

If it does not exist:

- create it with the GitHub API

Common endpoints:

- personal repo:
  - `POST /user/repos`
- organization repo:
  - `POST /orgs/{org}/repos`

Recommended metadata on creation:

- `name`
- `description`
- `homepage`
- `private`

## Phase 6: Push strategy

Add a clean remote:

```bash
git remote add origin https://github.com/OWNER/REPO.git
```

Push with one-command credential injection.

PowerShell example:

```powershell
$pair = "x-access-token:$env:GITHUB_PAT"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$b64 = [Convert]::ToBase64String($bytes)
git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $b64" push -u origin main
```

This avoids persisting the PAT in `.git/config`.

## Phase 7: Repository metadata polish

After the first push, set:

- description
- homepage
- topics

Useful endpoints:

- `PATCH /repos/{owner}/{repo}`
- `PUT /repos/{owner}/{repo}/topics`

Recommended topic count:

- 5 to 8 focused tags

## Phase 8: Release decision

If the intake says `Create release now: no`:

- stop after push and metadata setup

If the intake says `Create release now: yes`:

- continue with tagging and release creation

## Phase 9: Tagging

Recommended tag format:

- `v0.1.0`
- `v0.2.0`
- `v1.0.0`

Create and push the tag:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

Prefer annotated tags over lightweight tags for public releases.

## Phase 10: GitHub release creation

Use the GitHub releases API if `gh` is unavailable.

Example payload fields:

- `tag_name`
- `target_commitish`
- `name`
- `body`
- `draft`
- `prerelease`

Suggested release notes structure:

- summary
- highlights
- deployment notes
- known limitations

If the project is very early, a concise release note is enough.

## Phase 11: Post-release verification

Verify:

- repository URL works
- README renders correctly
- screenshots load
- topics are set
- license is recognized
- tag exists remotely
- release page exists if a release was requested

Also verify local state:

- `git status` is clean
- `origin` uses a clean HTTPS URL
- `main` tracks `origin/main`

## Phase 12: Final handoff

A strong final handoff includes:

- repository URL
- latest commit SHA
- tag name, if created
- release URL, if created
- summary of what was cleaned up or added
- any checks run
- any checks that could not run
- reminder to revoke the temporary PAT

## Recommended commit sequence

If the repository needs significant cleanup and polish, prefer a small series of
meaningful commits rather than one massive commit.

Good examples:

- `chore: prepare public release`
- `docs: improve project homepage`
- `docs: add contribution workflow`
- `docs: add release playbook`

## Common failure points

- `.gitignore` is incomplete before first `git add .`
- README still contains private hostnames or paths
- the repo already exists and the agent tries to recreate it
- PAT gets embedded into the remote URL
- screenshots are taken from a live database with private data
- commit author identity is left unset
- release tag is created locally but never pushed

## Golden path summary

For most agent-driven publishes, the clean sequence is:

1. collect intake once
2. sanitize repository
3. run quality checks
4. initialize git if needed
5. commit
6. create or verify repository
7. push main
8. set metadata
9. create tag and release if requested
10. report the final URLs and tell the user to revoke the PAT
