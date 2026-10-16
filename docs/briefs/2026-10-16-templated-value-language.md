# A held templated value is judged by its engine, not by its language

## Intent and authority

The dashboard refuses Save on the configuration page when the voice a business holds is in
another language than the business, although StarChat accepts it. Found on 2026-10-16 during the
live check of the restaurant page on test (business ba90c042: it-IT, GPT-Live, voice55 willow).
Angelo approved the fix on `v2.2` and as a tag on `v2.2.21` for beta and production; each
deployment beyond test is authorized separately.

## Evidence

- `BusinessVariables.unavailableTemplatedValue` reports a held value when it is not in
  `templatedOptions`. That list filters by each value's `dependsOn` and by its `language`.
- `verifyVariables` turns a reported value into a refused Save, for owners and admins alike,
  before any request is sent.
- StarChat's `VoiceEngines.problem`, which runs on every business write, judges only the engine:
  `VoiceOptions.scala` says that a value's language decides which businesses are shown it, not
  whether it is valid.
- In TTS_SELECTION every GPT-Live voice (voice52 to voice63) is `language: "en"`, deliberately
  (StarChat 4df733509: a voice is offered where its accent belongs). TTS_SELECTION is the only
  templated variable whose values carry a language other than `*`.
- The rule entered with 3e323c9 and has been in production since `v2.2.2`.

## Scope

- `unavailableTemplatedValue` reports a held value only when it is unknown to the definition, or
  when its own `dependsOn` does not hold for the business as it is now. Language is not read.
- The field lists the held value while it is valid (`templatedChoices`), so a voice in another
  language still shows as chosen. `templatedOptions` keeps filtering by language, so what a
  business is offered to choose does not change.
- A unit test, seen failing first on `d2b96fc`.

## Constraints

No change to StarChat data, to the default rule, or to the save path. No new user-facing string.

## Acceptance

- The new unit cases fail on `d2b96fc` and pass after the fix.
- The existing voice cases still pass: a voice that the engine lacks is reported, and the offered
  list is unchanged.
- Full vitest, lint and full Playwright pass.
- The same commit applies to `v2.2.21` and passes vitest and Playwright there.
