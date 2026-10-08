# Development and deployment

## Commands

The entry point is `src/main.js`. Package scripts use Vue CLI for both development and production builds.

```bash
npm run serve                    # Vue CLI development server, default port 8080
npm run build                    # Production build with Webpack
npm run lint                     # ESLint with automatic fixes
npm run test:e2e                  # Playwright browser tests
npm run test:e2e:ui               # Interactive Playwright UI
npm run test:e2e:update-snapshots  # Update visual snapshots
npm run i18n:report               # Translation coverage report
npx playwright test tests/e2e/auth/businesses.spec.js
npx playwright test --grep "test name"
npx playwright test --project=desktop
```

## Browser tests

`playwright.config.js` configures `tests/e2e/`, with domain suites including `auth/`, `public/`, `admin/`, `responsive/`, and `visual/`. Page objects live in `tests/e2e/pages/`; fixtures live in `tests/e2e/fixtures/`.

The base URL is `http://localhost:8080`. Desktop, tablet and mobile projects use widths of 1440, 768 and 375 pixels. Visual specs run only under the desktop project and select their own viewport sizes. The test server runs `npm run serve -- --mode test`; the test process loads `.env.test` when present and otherwise `.env`. Supply local configuration before running the application; do not commit credentials.

## Environment routing

Deployment is owned by `.github/workflows/deploy.yml` in this repository.

| Environment | Deploy tag | Bucket | Domain |
|---|---|---|---|
| Test | `vX.Y.Z-test` | `mrcall-dashboard-test` | `dashboard-test.mrcall.ai` |
| Beta | `vX.Y.Z-beta` | `mrcall-dashboard-beta` | `dashboard-beta.mrcall.ai` |
| Production | `vX.Y.Z-production` | `mrcall-dashboard` | `dashboard.mrcall.ai` |

A bare `vX.Y.Z` tag marks a release and triggers no deployment. Promotion uses environment tags on the same commit. Branches use numbered names such as `v2.0`; there are no `test-env`, `beta-env`, or `production-env` branches.

The workflow selects its GitHub environment from the tag suffix, writes `.env.<mode>` from that environment's `ENV_FILE`, builds, and syncs `dist/` to Scaleway Object Storage in `fr-par`. Each GitHub environment supplies its own `SCW_ACCESS_KEY` and `SCW_SECRET_KEY`. These values belong in GitHub secrets. Every `VUE_APP_*` value is public build configuration, never a place for private secrets.

All environment builds explicitly set `NODE_ENV=production` and `BABEL_ENV=production` on the build step; `--mode` selects the environment file. Preserve that separation so test and beta receive production optimization. This documentation does not authorize a release or deployment.

## Related repositories

Cross-project ownership and operating context live in `~/hb/docs/`. Related working trees under `~/hb/` include `mrcall-agent/` (AI configuration backend), `starchat/` (telephony, CRM, payments and business configuration), and `mrcall-website/` (public website). Check the owning repository before merging a cross-project contract change. The dashboard uses `VUE_APP_ZYLCH_URL` for the AI backend and `VUE_APP_STARCHAT_URL` for StarChat.
