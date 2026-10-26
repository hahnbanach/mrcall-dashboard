---
status: active
brief: ../briefs/2026-10-26-remove-account-calendar-connect.md
owner: dashboard release lead (branch remove-legacy-calendar, off v2.2)
created: 2026-10-26
---

# Remove the account-level Google Calendar connect

## Classification

Removes a user-facing capability and the dashboard's last writer of a StarChat record, so it is
not on the fast path. No dependency, data or backend change. One lead, no delegation of the
implementation: the change is one coherent deletion across a dozen files. Release and deployment
are authorized separately.

## Dependencies

None. StarChat is unchanged; the facts this relies on are recorded in the brief.

## Commits

- C1: the empty-business guard and its test.
- C2: the deletion, with the locale keys and the test changes, plus the two browser cases of step 3.
- C3: documentation, this plan and the brief.

## Steps

1. Baseline on the branch point (`v2.2`, worktree `remove-legacy-calendar`): lint and vitest.
   - Done: lint clean, vitest 405 of 405.
2. C1. A Playwright case in `tests/e2e/skills/oauth.spec.js`, modelled on `legacy manual skill
   callback preserves business grant and provider account identity`, with `oauthBusinessId` empty:
   no `/connect` post, no registry write. Run it before the guard and record under this step the
   command and its real failing output; add the guard in `GoogleCallback.vue`; run it again.
   - Done. `E2E_PORT=8095 npx playwright test tests/e2e/skills/oauth.spec.js -g "without a business"
     --project=desktop` before the guard: failed at `expect(model.connects).toEqual([])`, received
     one post with `"businessId": ""`, `"grantName": "manual-instance-8"`. The guard refuses before
     the code exchange, so the case also asserts no exchange. After: the whole spec 79 of 81 on three
     viewports; the two tablet failures (`calendar check errors ...`, `malformed availability ...`)
     are intermittent and pre-existing: with `--repeat-each=3` they failed 4 of 12 both with this
     change and on the unmodified `v2.2` tree.
3. C2, tests first. Replace the `ConnectCalendar section` case in `tests/e2e/auth/account.spec.js`
   with one asserting that the Integrations section shows the MCP connectors card and no calendar
   connect control; add a case that opens `/businessconfiguration?...&section=__SEND_DATA__` with a
   mocked variable in that collection and asserts the variable is shown and no calendar connect
   control is. Both run on desktop, tablet and mobile, and are recorded failing under this step
   before the deletion.
   - Done. Both cases with `--repeat-each=3` on the tree with `src/` restored to `v2.2`: 18 of 18
     failed on desktop, tablet and mobile, at the `toHaveCount(0)` checks (received 2 on the account
     page, 1 in the section); the variable and MCP card assertions before them passed. The section
     case waits for the network to settle before its negative check, so a calendar control that
     appears only after its own request answers cannot slip past it. On the changed tree: 9 of 9.
4. C2, deletion:
   - `src/components/ConnectCalendar.vue`, `src/components/CalendarSelector.vue`,
     `src/store/modules/calendar.js` and its registration in `src/store/index.js`.
   - `OAuthHelper.getGoogleCalendarCredentials` / `updateGoogleCalendarCredentials` and the comments
     that point at them in `src/utils/OAuth.js`.
   - `GoogleCallback.vue`: the calendar branch, `isCalendarFlow`, the picker, the stale sign-in
     comment, and every remaining `oauthFlow` removal (the skill branches clear it too);
     `GoogleSignIn.vue`: the `oauthFlow` cleanup.
   - `Account.vue` card and import; `BusinessConfiguration.vue` `__SEND_DATA__` block and import.
   - `components.connectCalendar` in the 12 locale files, removed by a script that parses and
     rewrites JSON, then a check that every locale still parses and no other key changed.
   - Tests: the legacy calendar callback case and the `calendarList` fixture route named in the
     brief. The step 3 cases now pass.
   - Done. Locales: 12 files, 14 lines each removed, none added; each parsed and compared equal to
     the original minus `components.connectCalendar`. `OAuthHelper` held only the two helpers and
     went whole.
5. C3, documentation: the five files named in the brief's Scope, rewritten where they describe the
   removed flow rather than patched, including every calendar-connect passage of
   `docs/ARCHITECTURE.md`, not only its store line.
   - Done.
6. Gates on the branch: grep of acceptance 1; lint; full vitest; full Playwright (desktop, tablet,
   mobile).
   - Done. Grep: no hit. Lint clean; vitest 405 of 405. Playwright full run: 1208 passed, 5 skipped,
     3 failed (`analytics-insights.spec.js:388` desktop, `admin.spec.js:7,15` mobile); those three
     run alone: 24 of 24 passed, so load-dependent and unrelated to this change.
7. Milestone review by a fresh reviewer over the diff against the brief.
   - Done: REVISE (stale comments in `GoogleSignIn.vue` and `OAuth.js`, one doc line, the send-data
     case not proven failing), repaired; then APPROVED by the same reviewer.
8. `doc-end`: reconciliation, mechanical gate, `doc-critic` over the five docs and active-context.

## Verification

| Brief acceptance | Evidence |
|---|---|
| 1 grep | step 6 |
| 2 `/account`, `__SEND_DATA__` | step 3 cases, failing before step 4 and passing after, three viewports |
| 3 skill OAuth and sign-in unchanged | step 6 full suites; only the step 4 test deletions |
| 4 empty-business guard | step 2 case, failing output recorded |
| 5 gates | step 6 |
| 6 doc-critic | step 8 |

## Rollback

Revert the branch's commits. Nothing persistent changes: the account-level rows remain on the
server whatever the dashboard shows, so restoring the UI restores the feature as it was.
