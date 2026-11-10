---
status: active
---

# Plan: dependency audit, the runtime dependencies first, then the development tools

Brief: [2026-11-09-dependency-audit](../briefs/2026-11-09-dependency-audit.md) (APPROVED on its second pass). Owner:
the lead of the dashboard session on `v2.2`. Working tree: the main checkout on `v2.2`. Commit, release and deployment
each need the CTO's authorisation, phase by phase.

## Dependencies

None outside this repository. The caller-checks correction ([plan](2026-11-09-caller-checks-correction.md)) shares
the line and the working tree: it is written after this plan's phase-1 commit, and phase 2 starts after its commit.
Each phase here takes the next free `v2.2.x` when it is released.

## Before any edit

- P0. On the untouched tree, run `npm run test:unit` (lint, then vitest), `npm run build` and the full Playwright
  run (three projects). Record each result, and the names of the Playwright cases that fail, as the baseline, so
  that a failure after an edit is attributed to the edit and not to the tree. While P0's tree still exists, rerun
  each failing case alone with one worker and record which ones still fail, with their error: the persistent P0
  failures. No `package.json` edit starts while P0 is going.

## Phase 1: runtime (milestone M1)

### R1. `package.json` and the lockfile

- `npm install axios@1.21.0 --save-exact`.
- `npm uninstall google-auth-library node-fetch`. Remove `node-fetch` from `resolutions`, and leave `whatwg-url`
  there.
- Move `vite` from `dependencies` to `devDependencies` by hand in `package.json`, still `6.3.4` exact, before the
  `npm update` below, which rewrites the lockfile's root entry to match. Its version moves in phase 2, so this step
  changes where it is declared, not what is installed.
- `npm update follow-redirects fast-uri`. Then check `npm ls follow-redirects fast-uri`: `follow-redirects` is
  1.16.2 or later, `fast-uri` is 3.1.9 or later.
- No `--force`, no `--legacy-peer-deps`. If npm reports a peer conflict, stop and revisit the brief.

### R2. Gates

1. `npm audit --omit=dev --json`: exactly `firebase`, `@firebase/firestore`, `@firebase/firestore-compat`,
   `@grpc/grpc-js`, `vuex-persist`, `deepmerge`.
2. `npm ls --depth=0`: `axios@1.21.0`; neither `google-auth-library` nor `node-fetch`.
3. `npm run test:unit`. It includes `tests/unit/sessionInterceptor.spec.js`, which drives real `axios`.
4. `npm run build`, compared with P0.
5. The full Playwright run, all three projects. Every failing case is rerun alone with one worker. It counts as
   unrelated to the change when it passes there (the load-sensitive cases `docs/active-context.md` records), or when
   it still fails alone and is one of P0's persistent failures, with the same error. Any other failure is a
   regression and stops the phase.
6. In the built `dist/`, the vendor chunk carries `axios`'s own version constant at `1.21.0` (the string next to
   `VERSION`, not a bare `1.21.0` anywhere), and no chunk contains `follow-redirects`, `gaxios` or `grpc`.

### R3. Milestone review M1

A fresh reviewer reviews the diff, the gates' output and the lockfile's changes. Phase 1 is then committed on the
CTO's authorisation, as one commit, and released to test on authorisation; after that deploy, the published vendor
chunk is checked for `axios` 1.21.0.

Phase 2 starts only once the phase-1 commit and the caller-checks commit exist, so the two phases never share a working tree and each stays one
commit with its own rollback. Its gates compare against M1's results as well as P0's.

## Phase 2: development tools (milestone M2)

### D1. `package.json`, the lockfile and one file removed

- `npm install --save-dev --save-exact vite@6.4.6 webpack@5.112.2`.
- `npm install --save-dev vitest@^4.1.12`. That is the lowest major that clears the advisories. If the unit specs
  need more than mechanical edits on it, stop and revisit the brief.
- `npm uninstall @intlify/unplugin-vue-i18n`. `git rm vite.config.js`.
- `npm update body-parser node-forge undici qs joi postcss-selector-parser launch-editor`.
- Read vitest 3's and 4's migration notes for the options `vitest.config.mjs` uses (`environment`, `include`,
  `setupFiles`, `globals`). Adjust only what they require.

### D2. Gates

1. `npm audit --json`: exactly the 32 entries the brief lists (the 6 runtime ones and the 26 development ones), none
   of the excluded names.
2. `npm run test:unit`: the 51 spec files pass on `vitest` 4.
3. `npm run build`.
4. The full Playwright run, judged as in R2. Playwright starts the Vue CLI dev server, which webpack 5.112.2 now
   runs.
5. `git grep` finds no reference to `vite.config.js` or `@intlify/unplugin-vue-i18n` outside `package-lock.json`,
   `docs/briefs/` and `docs/execution-plans/`.

### D3. Milestone review M2

A fresh reviewer reviews it before release. The deploy to test proves the Node 18 install, because the deploy runs
`npm ci` on Node 18.

## Closure

- `docs/system-rules.md`: Axios 1.21.0 and the webpack row's 5.112.2 (both columns). Add a vitest row if the table
  names the test tools, as it names Playwright.
- `docs/development.md`: any mention of `vite.config.js` or of the vitest version.
- `docs/active-context.md`: the dependency state, with the recorded residuals and the open CI-advisory decision under
  Unresolved.
- `doc-end`: the mechanical gate, `doc-critic`, the final review, and finalisation.

## Rollback

Each phase is one commit. Revert it, then redeploy the previous release's tag to the environment that needs it. The
lockfile returns with the commit, so `npm ci` restores the exact previous tree.

## Status

| Step | State |
|---|---|
| Brief | APPROVED (second pass, 2026-11-09) |
| Plan | APPROVED (third pass, 2026-11-09); its Dependencies paragraph and phase 2's start later sequenced with the caller-checks plan |
| P0 | unit 51 files / 702 tests; build ok; Playwright 2243 passed, 14 failed, 22 skipped, all 14 passing alone (no persistent failure) |
| Phase 1 (R1, R2) | audit `--omit=dev` exactly the 6 recorded entries; `axios@1.21.0`; unit 702/702; build ok, vendor chunk `"1.21.0"`, no `follow-redirects`/`gaxios`/`grpc`; Playwright 2240 passed, 17 failed, 22 skipped, all 17 passing alone |
| M1 | APPROVED (2026-11-09) |
