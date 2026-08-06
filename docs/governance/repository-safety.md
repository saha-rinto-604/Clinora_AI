# Repository Safety Policy

## Secrets

Do not commit real credentials, tokens, API keys, private keys, production database URLs, or provider credentials.

Only placeholder values are allowed in `.env.example`.

## Local Files

The following must remain untracked:

- `.env` and `.env.*`
- `node_modules/`
- `dist/`
- `target/`
- `.venv/` and `venv/`
- Docker runtime data
- `Documents/`

## Publication Checks

Before publishing Phase 1 work, verify:

- No files under `Documents/` are staged.
- No real secret patterns are present in implementation files.
- No prohibited backend technologies are used.
- No Phase 2 features have been introduced.
- Frontend, backend, Docker Compose, OCR, and AI health verification have passed.

## GitHub Rules

Use only the approved repository:

`https://github.com/saha-rinto-604/Clinora_AI.git`

Do not force-push, change repository visibility, add production secrets, configure production deployment, or create a GitHub release during Phase 1 publication.
