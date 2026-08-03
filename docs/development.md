# Development Workflow

## Branches

- `main`: production-ready releases only.
- `qa`: integration branch for verified work.
- `feature/*`: new features from `qa`.
- `fix/*`: bug fixes from `qa`.

## Pull Requests

All changes into `qa` and `main` must go through PRs. This is a single-developer project, so review is not required, but CI checks are required.

## Required GitHub Checks

- `npm run check`

## Backend Development

The backend uses PostgreSQL and versioned SQL migrations.

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/smelly_cat_recipe
npm run backend:migrate
npm run backend:seed
npm run backend:dev
```

Add schema changes as new files under `backend/db/migrations` using an increasing numeric prefix, for example `002_add_notification_subscriptions.sql`. Do not edit an already-applied migration after it has been merged.

## Branch Protection

Protect both `main` and `qa`:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Do not require approvals.
- Disallow direct pushes.
- Prefer squash merge.

## Normal Flow

Always sync with GitHub before creating any development branch:

```bash
git switch qa
git fetch --prune origin
git pull --ff-only origin qa
git switch -c feature/name
npm run check
```

Open a PR from `feature/name` or `fix/name` to `qa`. Keep new work based on `qa` unless a release is being prepared.

## Release Flow

Day-to-day work stays on `qa`. Do not promote `qa` to `main` after every completed feature or fix.

Open a `qa` to `main` PR only when preparing a version update or production release. That release PR should include the version/change summary and must pass the same required `checks` status before merge.
