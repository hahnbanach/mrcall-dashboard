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

Test runs `v2.2.22`, which is `60c1522`, the tip of branch `v2.2`. It adds the
Configure-via-chat skill work, which needs the mrcall-agent deployed on test: the
agent on beta and production lacks the pending and reconcile endpoints, and the
skill fields of apply-changes. See the
[integration contract](integration/zylch-integration.md).

The session guard and the single owner of 401 are implemented, uncommitted, in
worktree `shell-auth-guard` onto `60c1522`
([brief](briefs/2026-10-13-shell-session-guard.md),
[plan](execution-plans/2026-10-13-shell-session-guard.md)). The changes:

- Every route needs a session unless it declares `meta.public`.
- The Axios interceptor alone ends a session. Components skip their failure UI
  for `isSessionEnded(error)`.
- The browser-test fixture mocks mrcall-agent, as it already mocked StarChat.

Verified locally: vitest 120 of 120; Playwright 733 passed and 3 skipped on desktop,
tablet and mobile; the test-mode build. Not yet released or checked on a live
environment.

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

- Commit the session-guard work onto `v2.2` and deploy it to test, which needs
  separate authorization. Then check on the test domain that a deep link without a
  session reaches sign-in and returns, and that an expired session shows the
  session-expired dialog.
- Integrate `restaurant-tables-page` when its session delivers it, rebased on the
  `v2.2` tip. It needs the StarChat named-tables release on the same environment.
- Promoting the chat skill work beyond test requires promoting mrcall-agent first,
  plus authorization.
