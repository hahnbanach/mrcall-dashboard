---
title: "Rebuild the onboarding wizard — one question, then get out of the way"
created: 2026-08-23
repo: mrcall-dashboard
origin: conversion investigation 2026-08-23 + the owner's own observation of
  people using it
decision: rebuild agreed by the platform owner; the shape below is the proposal
---

# Rebuild the onboarding wizard

## What is wrong with it

**It is too long and too slow.** The owner has watched people go through it. It
asks for a great deal before giving anything back, and the waiting is visible.

**It burns nearly the whole credit balance.** A new business is granted 500
`400-TEST` credits at creation. The wizard's own AI configuration steps consume
most of them **before the customer has had a single conversation with the
assistant** — and credits are one shared wallet across calls, the configuration
chat and MrCall Desktop. So the wizard spends the trial on configuring the
product rather than on experiencing it.

**It never shows a price.** The last step is `OnboardingMakeATestCall`
(`:current-step="3" :total-steps="3"`) and both footer buttons call
`goToDashboard()`. `OnboardingNotificationPreview` — the only view that routes to
`OnboardingChoosePlan` from inside the wizard — is **orphaned**; nothing
navigates to it. A signup therefore finishes onboarding having never seen a
plan, and the only remaining call to action is a banner in the business list
they have to notice on their own.

**The numbers it produces.** 215 signups in the 180 days to 2026-08-23: 192 are
still `TEST`, 17 `ACTIVE`. **70% never consumed a single call credit** — never
heard the assistant say a word. And **zero of the 215 have a trial clock**
(`trial_expiration_datetime`), despite a 31-day template default, so nothing
expires and nothing prompts. The 134 with no number are a median 113 days old.
They are not mid-trial; nothing is scheduled to happen to them, ever.

## The shape it should have

**Ask one question: may we look your business up on the web?** Then do it, and
fill in what we can — name, sector, address, hours, what they sell. That is the
whole configuration step. Everything else we currently ask for is either
derivable or can wait until they care.

**Then get them talking to the assistant.** That is the only thing that
correlates with paying: 71% of customers who ended up `ACTIVE` had made a
browser call, against 42% of those still in `TEST`. Trying it in the first week
raises the eventual subscribe rate from 6.7% to 9.8%.

**Then remind them that "Configura via chat" exists.** Not as a step in the
wizard — as the thing they come back to when they want to change something. Half
the support burden in the archive is non-technical owners who never found it:
dental practices, small shops, admin offices emailing support for a holiday
message. One of them tried to reconfigure the assistant *by talking to it on the
phone*.

**And show a price.** Wherever it lands, it must be inside a flow the user is
already in, not on a banner they must discover.

Three sentences as the acceptance test: **one question, one conversation, one
reminder.** If a step is not one of those, it needs to justify itself against
the credits it spends and the minutes it costs.

## Two things to settle while rebuilding

**Instrument the talk button.** See
[`2026-08-23-instrument-the-talk-button.md`](2026-08-23-instrument-the-talk-button.md).
Whether someone clicked it is the single most useful fact about a signup and it
is currently unrecorded. **Ideally write the click date into `tested`** — see
below, that column is free.

**`tested` is dead and can be repurposed or revived.** It is the phone-ownership
stamp, written by the decision-table atom `businessOwnerCallingFlow.sc:86` when
the owner rings the assistant from their registered number. That atom **is not
deployed**: zero of 276 production decision-table rows reference it. The last
real value written anywhere is from 2026-01-21; every signup since sits at the
`1970-01-01` epoch sentinel, which correctly means *not tested*.

So the sentinel is not the bug — the dashboard reads it correctly
(`BusinessPhoneNumberVerification.vue:252` shows `seemsYouDidntCall` on a
match). The bug is that the flag can no longer ever be *set*, so that prompt
now fires for everybody, for ever, including people who did talk to the
assistant. And the downstream Mailchimp `JOURNEY_ST = "TESTED"` stage never
fires either.

Two ways out, and they are not exclusive: redeploy the atom so a phone test sets
it again, and/or have the browser button stamp it, which would make `tested`
mean "has spoken to the assistant by any route" — which is the fact we actually
want.

## Mobile: the population we may be losing silently

**Accounts cannot be created inside the mobile app**, so the app is not a signup
surface — but the **mobile browser is**, and it is a large share of traffic.
Two things follow that nobody has checked:

- On mobile browsers the microphone prompt behaves differently from desktop and
  is easier to dismiss by accident. In the one instrumented surface we have,
  Android accounts for 6 of the errors in 38 consents; iOS only 1 in 37 — but
  those counts exclude every failure that happens after acquisition, which is
  the majority of what we cannot see.
- `CustomTokenSignin.vue:35` sets webview mode, and neither the onboarding page
  nor `Businesses.vue` hides the voice button in a WebView. A Flutter
  `InAppWebView` grants `getUserMedia` only when the host app implements
  `onPermissionRequest` on Android and ships the microphone usage description on
  iOS. If a signed-in user opens the test-call page from inside the app, and
  that is not handled, it fails **100% of the time, not stochastically**.

Ten minutes with the shipped app on both platforms settles the second. The first
needs the instrumentation above, split by user agent.
