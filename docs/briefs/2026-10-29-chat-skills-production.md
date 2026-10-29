# Promote the tested chat skill release to production

## Intent and authority

The operator confirms the Sheets configuration looks correct on TEST and explicitly
requests production publication. Promote the exact tested backend and dashboard;
no application source, customer configuration, history, grant or provider changes.

## Release scope

Backend c40fef81ee67d2cf62e232cfc5badc2d455b6870 is origin/dev, successful TEST
pipeline3003424870. It includes the reviewed resource-probe/language changes,
five-skill booking connection/routing, Sheets OAuth setup and runtime-value repair.
Dashboard ab4ca78fcabd47371e4cac3b4e9ea932d6381fa3 is v2.2.38-test, successful
workflow40563308648. It includes the tested booking/Sheets UI and its already-merged
v2.2 baseline (insights reports, phase defaults and removal of account-level Calendar).
Do not cherry-pick a new untested combination or deploy later unrelated commits.

## Acceptance and constraints

- Backend production is an ancestor of tested dev; fast-forward production to that
  exact dev commit only. Main-only documentation commits need no deployment.
- Wait for backend pipeline, ready image/source hash verification and HTTP200 health
  before tagging the tested frontend commit v2.2.38-production.
- Verify the successful frontend workflow, every served JS/CSS asset against its
  production CI names, new flow markers and production API targets.
- Read-only production compatibility confirms installed Sheets manifest and resource
  probe route; empty-config probe refuses not_configured without invoking a skill.
- Preserve beta, TEST, StarChat, all customer configuration/history/grants and the
  dirty dashboard checkout. No consent, model call, calendar event or row append.
- Document actual deployed identities and retained real-provider acceptance limits.
