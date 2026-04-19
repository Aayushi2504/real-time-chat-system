# Release checklist (before making the repo public)

Use this before flipping **GitHub → Settings → Danger Zone → Change repository visibility** to **public**, or before advertising the URL.

## Secrets and configuration

- [ ] **No `.env`** in the repo or in commit history (`git log -p` spot check; use [git-secrets](https://github.com/awslabs/git-secrets) or [trufflehog](https://github.com/trufflesecurity/trufflehog) for a deeper scan).
- [ ] Root **`.env.example`** and **`backend/.env.example`**, **`frontend/.env.example`** contain only placeholders—no real `JWT_SECRET`, DB passwords, or API keys.
- [ ] **`docker-compose.yml`** and docs use obvious dev defaults; production deploy will use different secrets via env/secrets manager.
- [ ] If you ever pasted a token in a commit, **rotate** that token and consider `git filter-repo` or a fresh repo—do not rely on follow-up commits alone.

## Code and build sanity

- [ ] **`npm run build`** succeeds in **`backend/`** and **`frontend/`** (or your CI runs the same).
- [ ] **`npx prisma validate`** passes in **`backend/`**.
- [ ] **Docker**: `docker compose build` succeeds (optional but recommended before a “release” tag).

## Tests

- [ ] Backend tests pass with `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` set (`cd backend && npm test`).
- [ ] Frontend tests pass (`cd frontend && npm test`).  
  (SKIPs or known gaps are fine for a portfolio; document them in README if relevant.)

## Documentation

- [ ] **`README.md`** URLs and ports match how you actually run the project.
- [ ] You are comfortable with **`docs/`** content being public (no employer data, private emails, or harsh opinions you would not stand behind).

## GitHub repository settings (public)

- [ ] **Branch protection** (optional): require PR for `main`.
- [ ] **Dependabot** or periodic `npm audit` awareness.
- [ ] **License file** added if you want others to know terms of reuse (e.g. MIT)—optional but common for portfolios.

## Personal data

- [ ] Seed/demo accounts in **`prisma/seed.ts`** use fake emails only (e.g. `@example.com`).
- [ ] No personal phone, address, or internal hostnames in docs or scripts.

---

**Minimal “good enough for public portfolio” bar:** secrets never committed, `.env.example` only placeholders, README accurate, one successful local build.
