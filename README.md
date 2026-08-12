# MrCall Dashboard

The web dashboard for [MrCall](https://www.mrcall.ai), the AI receptionist that
answers calls for a business. This is the interface its customers use to configure
the assistant and to see what it did.

Vue 3 single-page application. It holds no data of its own: everything comes from
the MrCall backend over REST and WebSocket.

## What it does

- **Business configuration** — opening hours, services, the assistant's behaviour
  and the information it is allowed to give out
- **Contacts and conversations** — who called, what was said, transcripts and
  recordings
- **Voice calls in the browser** — talk to the assistant directly from the
  dashboard over WebSocket, the same engine that answers the phone
- **Calendars** — connect Google Calendar so the assistant can read availability
  and book appointments
- **Analytics and billing** — call volume, outcomes, plan and payments

## Running it locally

```bash
npm install
cp .env.example .env.development   # then fill in the blanks
npm run serve
```

`.env.example` lists every variable the application reads. They are all compiled
into the bundle and served to the browser, so none of them is a secret: anything
that must stay private belongs on the backend.

The dashboard needs a MrCall backend to talk to; set `VUE_APP_STARCHAT_URL` to
one you are entitled to use.

```bash
npm run build       # production bundle in dist/
npm run test:e2e    # Playwright, needs E2E_EMAIL and E2E_PASSWORD in the environment
```

`npm run lint` is declared but does not run: the eslint plugin it calls is not
among the installed dependencies.

## Layout

```
src/components/     views and widgets, one folder per area of the product
src/utils/          API clients and helpers
src/i18n/locales/   translations, 13 languages
public/             static assets served as-is
tests/e2e/          Playwright scripts
docs/               architecture notes
```

## Hosting your own

The instance at [dashboard.mrcall.ai](https://dashboard.mrcall.ai) is operated by
Hahnbanach srl, and its deployment is ours: the pipeline, the buckets and the
credentials are not part of this repository and are of no use outside our
infrastructure.

The licence lets you run your own copy on your own infrastructure. A dashboard on
its own does nothing, though: it is a client of the MrCall backend, and a
white-label deployment has to be connected to that backend and agreed with us
first. Get in touch through [mrcall.ai](https://www.mrcall.ai).

## Licence

MIT, see [LICENSE](LICENSE). Copyright Hahnbanach srl.
