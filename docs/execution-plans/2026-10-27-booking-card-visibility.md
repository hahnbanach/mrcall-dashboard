---
status: active
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
