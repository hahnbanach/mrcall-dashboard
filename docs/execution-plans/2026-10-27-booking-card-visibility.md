---
status: completed
---

# Booking setup card visibility

Approved [brief](../briefs/2026-10-27-booking-card-visibility.md). Lead owns both
repositories and release; no worker decomposition is needed for this narrow fix.

## M1 — Saved configuration fact and presentation

Compute configured in BookingActivation.status from the existing five-member group:
no pending booking operation, one accessible calendar, all enabled. Return it as an
additive boolean. Keep active/prepared state, prompt integrity, token and activation
behavior unchanged. Do not interpret the business's custom prompt semantically.

BookingCalendarConnection hides its setup card when configured=true or state=active,
unless an explicit local failure needs recovery controls. The parent keeps the
available signal for provider-card coordination; successful activation still shows
its normal parent success notice. Incomplete/disabled groups and pending edits keep
their setup controls. No skill, prompt, calendar or conversation writes are added.

Check real status/service/API cases with isolated PostgreSQL, preserving failed
alignment and stale/token guards. Browser tests cover active markerless configuration,
active success, disabled saved groups, pending edits and partial failure controls.
Run focused lint/build and integration review, then source documentation closure,
explicit doc-critic and separate final source review.

## TEST release

The user explicitly authorizes both TEST deployments. Publish reviewed backend
main→dev with fast-forward ancestry and dashboard numbered branch with a new TEST
tag; verify successful workflows, exact ready backend hashes/health and actual served
assets. Read existing authorized TEST status to verify configured=true/state=prepared
for the known markerless saved group, without opening/modifying a chat or invoking
activation. Fresh operational closure/final review precedes readiness. No production,
customer configuration/history or provider action. Roll back by normal reviewed
revert/redeployment, never force-push or retag.

## Verified source and TEST delivery

Fresh brief, plan, M1, explicit source doc-critic and separate final source review
approve the implementation. Actual focused service/API checks pass 41 cases;
22 booking browser cases pass, including the reported markerless saved group,
disabled/pending controls, successful hiding and failed-activation recovery through
refresh. Exact lint/format and TEST build pass. Source effects are scripted.

The explicitly authorized backend main→dev publication succeeds at 7b9cec51be46ed4257bec16d88f86e3d13f3564d
in pipeline2995970926; ready digest sha256:9fe946759ea956acc13eb2bff0b728a3e50effc985c7e1c7879535e1b9b236d7, nineteen exact
source hashes and HTTP200 health are verified. Dashboard v2.2.38-test at
ab4ca78fcabd47371e4cac3b4e9ea932d6381fa3 succeeds in workflow40563308648; all 104 served
JS/CSS assets return HTTP200 and match CI names, retaining Sheets and prior booking paths.

The actual reported TEST assistant returns configured=true/state=prepared with
an unchanged saved booking configuration across the read. No activation, customer
prompt/calendar/skill write, history reset, model call or provider event occurs.
Production/beta receive no promotion. Operational receipts are retained externally
in the task cache's release directory; fresh release doc-critic and final review
precede checker completion. Actual caller behavior is outside this visibility fix.
