---
doc_baseline_commit: 933899e387b1dec241c0765873572823bcbde396
doc_baseline_date: 2026-11-02
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

Production, beta and test serve `v2.2.47` (production and beta at `adbb851`, test at `8f194be`, the same code), with
StarChat 9.34.128 behind production (all three pods, 2026-11-02) and the analytics routes it added on beta too. The
`v2.2` line holds the classification feedback and the analytics UX rework, both live since `v2.2.45`
([analytics UX brief](briefs/2026-10-31-analytics-ux.md), [plan](execution-plans/2026-10-31-analytics-ux.md)), and the
bundles uploaded gzipped (`v2.2.47`): 7.9 MB of JavaScript on a first load became 1.98 MB, the login page's first
paint at 9 Mbps 9.3 s to 3.8 s.

The rest of the load work is on branch `dashboard-load` (worktree `mrcall-dashboard-wt/dashboard-load`, local only,
not deployed): pages, locales, the call client and the JSON editor on demand (initial JS 462 027 B gzip in 2 files,
from 1 991 975 B in 103), a splash and mounting without waiting for the router, one auth readiness with a claim check
instead of forced refreshes, and the upload with 14-day retention and a per-environment cache header, rehearsed on a
local S3 ([brief](briefs/2026-10-23-dashboard-load.md), [plan](execution-plans/2026-10-23-dashboard-load.md), its
Status table). Its release (M9) is not authorised yet and needs `ASSET_CACHE_CONTROL` on each GitHub environment first:
the new Deploy step stops without it.

Session ownership: every nonpublic route needs a session, the Axios interceptor alone ends it, and components suppress
their failure UI for `isSessionEnded`. Browser tests mock StarChat and mrcall-agent; their ID tokens are JWT-shaped and
the StarChat mock refuses an unverified one, as StarChat does.

## Unresolved

- The AI chat SSE client uses native fetch and bypasses the Axios interceptor; WebSockets
  (Whatsappweb, the Aladdin configurator, TestChat, the webcall text chat and voice button) do
  not pass through it either. See [harness-backlog](harness-backlog.md).
- Actual production consent, model behavior, caller booking and post-call append
  remain operator-owned acceptance; the operator confirms TEST setup works.
- On `v2.2.34`, the first callback response of the reported calendar Save is unexplained; the
  call-history reads available returned no record for it.
- `tests/unit/skillsOwnerSave.spec.js` takes 3.5 to 5.3 s against a 5 s timeout in a fresh
  worktree, and can time out there.
- Under a full Playwright run, 10 to 24 tablet and mobile cases fail and pass alone with one worker (commit `c61ddf2`, and the load plan's Status table); it follows the
  machine's load (more with a rehearsal or a build beside it), the cause is not measured further.
- A blank first load of about a minute was seen once in a Chrome with extensions, right after a deploy, and not in a
  clean Chromium (5 cold runs, 1.0 to 1.3 s): not reproduced, not explained.
- The `__BOOKING__` section's move into `__CONVERSATION__` by StarChat, and the U19r6 field names assumed against
  StarChat's U19r7a, were not re-checked on 2026-11-02.

## Next

- Dashboard load, M9: Angelo authorises creating `ASSET_CACHE_CONTROL` (`none`) on the test, beta and production
  environments and the test deploy; then the 60 s probe, the immutable header, the protocol's measurements on test,
  and beta and production with their fallback tags verified.
- Analytics UX: the final review through the final-user path, then this file's closure with `doc-end`.
- Operator: verify the production flow and actual call results with the chosen account.
- Remove `__BOOKING__` from `menuGroups` once StarChat's move is on test.
