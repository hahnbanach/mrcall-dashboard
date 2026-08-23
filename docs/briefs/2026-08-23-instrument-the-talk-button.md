---
title: "Instrument the talk-to-the-assistant button — we currently cannot see it fail"
created: 2026-08-23
repo: mrcall-dashboard (one change also in mrcall-website)
origin: conversion investigation, 2026-08-23 — full findings in the hb meta-repo,
  docs/briefs/2026-08-23-browser-test-call-and-the-signup-funnel.md
decision: approved by the platform owner
---

# Instrument the talk button

## Why

The in-browser voice button is now **the entire free trial**. The test phone
number was retired on purpose (nobody called it), so this button is the only
way a new signup can experience the product before paying — a phone number is
only issued after a completed Stripe checkout.

Measured on production 2026-08-23, over 215 signups in 180 days: **111 sit in
`TEST` having never made a single browser call**, and among those who did end up
paying, 71% had tried it against 42% of those still in `TEST`.

And we cannot see it fail. `getUserMedia` runs **before** the WebSocket opens,
and the StarChat session row is created inside the WS route — so a microphone
prompt that is denied or simply dismissed leaves **no trace anywhere**: no
session row, no access-log line, nothing. There is no `gtag`, no Sentry and no
`window.onerror` on this path; the dashboard fires `$gtag.event` for
`payment_success`, `payment_failed`, `onboarding_pre_payment` and `conversations`,
and nothing for the one button that carries the trial.

The public website is the only instrumented twin and it says what the number
probably is: 145 consents → **20 errors, every one of them audio acquisition**
(11 "Permission dismissed" — the user just closed the bubble — 7 denials, 2
"device not found"). **13.8% of consented attempts.** A server-side upper bound
on the same population is 21.9%.

So: of the 111 who never made a call, how many clicked and failed versus never
clicked? **Unanswerable today.** That is the question this brief closes.

## Change 1 — two events on the button (this repo)

`src/components/webcall/DirectVoiceButton.vue`. `vue-gtag` is already installed
(`src/main.js:73`) and `$gtag.event` is used in eight other views, so this adds
no dependency and no config.

```js
// first line of startCall(), after the existing guard
this.$gtag?.event('webcall_attempt', {
  business_id: props.businessId,
  encoding: props.encoding,
})

// in the catch of startCall(), and in the SDK's onError handler
this.$gtag?.event('webcall_failed', {
  business_id: props.businessId,
  encoding: props.encoding,
  error_name: e?.name,          // NotAllowedError, NotFoundError, …
  error_message: msg,
})
```

**`webcall_attempt` is the load-bearing half.** Every other signal we have —
the StarChat session row, the WebSocket access log — begins only *after* the
microphone has been granted. Without an attempt event there is no denominator
and the failure rate cannot be computed at all.

Worth adding while in the file: `navigator.permissions.query({name:'microphone'})`
state on the failure event, which separates "denied once and remembered" from
"dismissed just now" — two failures that need different copy.

**Consider sending the same two events to `POST /mrcall/v1/tracking/events`
instead of, or as well as, GA.** That table accepts an arbitrary `event_type`
plus `metadata` and the ingest route validates nothing, which is exactly how the
website surface produced the only hard evidence quoted above. It also puts the
numbers next to the business rows, so the funnel query is a join rather than an
export.

## Change 2 — the public demo drops its own callbacks (`mrcall-website`)

`components/TalkToMrCallBlock.tsx:114-137` passes `onCallStarted`, `onCallEnded`,
`onError` and `onStatusChange` as **constructor options**. The SDK constructor
destructures a fixed list that does not include them and then nulls all four, so
they are discarded. The dashboard is unaffected because it assigns them *after*
construction.

Two consequences, both live since March:

- the demo card shows **"Connecting…" for the entire call**, even when the call
  is working perfectly;
- every failure after microphone acquisition is invisible — `demo_end` is a
  declared event type and the `/api/track` route filters nothing, yet
  `tracking_events` contains **zero `demo_end` rows, ever**, against 145
  `demo_consent`.

Fix: assign them on the instance instead.

```js
const dv = new MrCallDirectVoice({ /* … options … */ })
dv.onCallStarted  = …
dv.onCallEnded    = …
dv.onError        = …
dv.onStatusChange = …
```

## What this does not fix

Named so nobody assumes instrumentation is the whole job. Each is documented in
the meta-repo brief:

- **The error message is a hardcoded English string** — `"Error starting direct
  voice"`, `"Direct voice error"`, `"WebSocket connection failed"` each appear
  once as literals, not i18n keys, on a dashboard localised into twelve
  languages — and it never tells the user to click the padlock and re-grant the
  microphone.
- **Customers and admins are on different codecs.** `encoding="opus"` is
  rendered under `isAdmin`; everyone else gets uncompressed `pcm16` at 24 kHz,
  ~16× the bandwidth. The browser call was chosen over the phone test *because
  the audio is better*, and customers are the ones not getting the better audio.
- **A WebSocket close after a successful open is completely mute** — the SDK's
  `onclose` resets to idle and never calls `onError`.
- **The mobile-app WebView is unverified** — see the companion brief on the
  wizard.
