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

## Branch Protection

Protect both `main` and `qa`:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require branches to be up to date before merging.
- Do not require approvals.
- Disallow direct pushes.
- Prefer squash merge.

## Normal Flow

```bash
git switch qa
git pull
git switch -c feature/name
npm run check
```

Open a PR from `feature/name` to `qa`. After `qa` is stable, open a PR from `qa` to `main`.
