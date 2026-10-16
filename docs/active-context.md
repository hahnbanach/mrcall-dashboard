---
doc_baseline_commit: d52785ef965c256ebb192c7e9484602d350a5e15
doc_baseline_date: 2026-10-08
---

# Active Context

<!-- doc-scope:start -->
Scope: Current dashboard operating state, unresolved verification limits, and immediate next actions; durable contracts live in the indexed documentation.
<!-- doc-scope:end -->

## State now

Production and beta run `v2.2.21` (`6d3b5dd`, a commit on `v2.2.19`). It carries the
restaurant booking page, the hiding of platform-only skill fields from owners, and
the credit balance shown net of debt. A balance that StarChat does not give is shown
as a dash, not as zero. Each deployment was checked on its live domain: served
bundle, 57 static routes and the Businesses page.

Test runs `v2.2.24`, the tip of branch `v2.2`. It carries the restaurant bookings
page on named tables, which needs StarChat 9.34.68 or later (9.34.69 for the
tables) on the same environment; see
[the restaurant integration](integration/restaurant-booking.md). Production stays
off until StarChat reaches production. It also carries the Configure-via-chat
skill work, which needs the mrcall-agent deployed on test: the
agent on beta and production lacks the pending and reconcile endpoints, and the
skill fields of apply-changes. See the
[integration contract](integration/zylch-integration.md).

And it carries the session guard and the single owner of 401
([brief](briefs/2026-10-13-shell-session-guard.md),
[plan](execution-plans/2026-10-13-shell-session-guard.md)):

- Every route needs a session unless it declares `meta.public`.
- The Axios interceptor alone ends a session. Components skip their failure UI
  for `isSessionEnded(error)`.
- The browser-test fixture mocks mrcall-agent, as it already mocked StarChat.

Before release: vitest 120 of 120, and Playwright 733 passed with 3 skipped on
desktop, tablet and mobile. On the test domain, a fresh browser without a session is
sent from a deep link to sign-in with the full link to return to, and a public page
stays open. With a real session, the configuration page and its chat load, and the
session stays open. The session-expired dialog is covered only by the browser
tests, because it needs a real session that the server refuses.

## Unresolved

- The AI chat SSE client uses native fetch and bypasses the Axios interceptor;
  see [harness-backlog](harness-backlog.md).
- WebSocket connections (Whatsappweb, the Aladdin configurator, TestChat, the
  webcall text chat and voice button) do not pass through the interceptor either.
- Real model quality, and actual Google consent and provider grants, remain
  unverified.
- `tests/unit/skillsOwnerSave.spec.js` takes 3.5 to 5.3 s against a 5 s timeout
  in a fresh worktree, and can time out there.

## Next

- Bring the session guard to production: either with the whole `v2.2` line once
  mrcall-agent and StarChat are promoted, or as a tag on `v2.2.21`. Either way
  needs authorization.
- `tests/e2e/skills/oauth.spec.js` fails on the mobile project under repeated runs:
  3 and 4 of 78 tests failed in the second and third of three repeats, on 5 s waits
  for a button to become enabled. The cause is not yet measured.
- Promoting the chat skill work beyond test requires promoting mrcall-agent first,
  plus authorization.
