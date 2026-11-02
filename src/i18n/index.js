import { createI18n } from 'vue-i18n'

/**
 * The interface language, with each locale in its own chunk (plan docs/execution-plans/2026-10-23-dashboard-load.md,
 * M3). The twelve JSON files used to be imported here eagerly, about 1.3 MB of the main bundle for one language in
 * use. Now the app starts with no messages; `startLocale` loads the starting locale and the fallback, and main.js
 * mounts once it settles, so that no text is ever drawn in a language it is about to leave.
 */
const DEFAULT_LOCALE = process.env.VUE_APP_I18N_LOCALE || 'en-US'
const FALLBACK_LOCALE = process.env.VUE_APP_I18N_FALLBACK_LOCALE || 'en-US'

const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  globalInjection: true,
  compositionOnly: false,
  fallbackWarn: false,
  missingWarn: false,
  messages: {},
})

// One chunk per locale. The chunk names are spelled out, not built from a variable, so that webpack emits exactly
// these twelve and nothing else under src/i18n/locales.
const LOADERS = {
  'en-US': () => import(/* webpackChunkName: "locale-en-US" */ './locales/en-US.json'),
  'it-IT': () => import(/* webpackChunkName: "locale-it-IT" */ './locales/it-IT.json'),
  'es-ES': () => import(/* webpackChunkName: "locale-es-ES" */ './locales/es-ES.json'),
  'fr-FR': () => import(/* webpackChunkName: "locale-fr-FR" */ './locales/fr-FR.json'),
  'de-DE': () => import(/* webpackChunkName: "locale-de-DE" */ './locales/de-DE.json'),
  'nl-NL': () => import(/* webpackChunkName: "locale-nl-NL" */ './locales/nl-NL.json'),
  'sv-SE': () => import(/* webpackChunkName: "locale-sv-SE" */ './locales/sv-SE.json'),
  'da-DK': () => import(/* webpackChunkName: "locale-da-DK" */ './locales/da-DK.json'),
  'nb-NO': () => import(/* webpackChunkName: "locale-nb-NO" */ './locales/nb-NO.json'),
  'fi-FI': () => import(/* webpackChunkName: "locale-fi-FI" */ './locales/fi-FI.json'),
  'et-EE': () => import(/* webpackChunkName: "locale-et-EE" */ './locales/et-EE.json'),
  'el-GR': () => import(/* webpackChunkName: "locale-el-GR" */ './locales/el-GR.json'),
}

export const LOCALES = Object.keys(LOADERS)

const loads = new Map()

/**
 * Loads a locale's messages once and registers them under the full tag and its short alias (`it-IT` and `it`), as the
 * eager version did. The promise is cached; a failed load is forgotten, so that a later call tries again.
 */
export function loadLocaleMessages (locale) {
  const load = LOADERS[locale]
  if (!load) return Promise.reject(new Error(`Unknown locale: ${locale}`))
  if (!loads.has(locale)) {
    const pending = load().then((module) => {
      const messages = module.default || module
      i18n.global.setLocaleMessage(locale, messages)
      i18n.global.setLocaleMessage(locale.split('-')[0], messages)
      return locale
    })
    pending.catch(() => loads.delete(locale))
    loads.set(locale, pending)
  }
  return loads.get(locale)
}

/** Loads a locale and makes it the interface language. */
export async function loadLanguageAsync (locale) {
  await loadLocaleMessages(locale)
  i18n.global.locale.value = locale
  document.documentElement.setAttribute('lang', locale)
  return locale
}

const supported = () => (process.env.VUE_APP_I18N_SUPPORTED_LOCALES || '').split(',').filter((l) => LOADERS[l])

/**
 * The language the app starts in, decided before it mounts, in this order:
 * - a link that names one: `lang` on the sign-in and sign-up pages (Signin.vue and Signup.vue switch to it in
 *   `mounted()`, too late for a first render), or `language` on the custom-token page, mapped as
 *   CustomTokenSignin.vue maps it (`it*` to Italian, anything else to English). Elsewhere `lang` means something else
 *   (Conversations reads it as a date format) and is not read;
 * - the language chosen before (localStorage), then the browser's, then the default, as before.
 */
export function initialLocale (location = window.location) {
  const ok = (locale) => supported().includes(locale)
  const query = new URLSearchParams(location.search)
  const path = location.pathname.replace(/\/+$/, '')
  if (['/signin', '/login', '/signup'].includes(path) && ok(query.get('lang'))) return query.get('lang')
  if (path === '/customtokenlogin' && query.get('language')) return query.get('language').startsWith('it') ? 'it-IT' : 'en-US'
  const chosen = localStorage.getItem('mrcall-user-locale')
  if (ok(chosen)) return chosen
  if (ok(window.navigator.language)) return window.navigator.language
  return DEFAULT_LOCALE
}

/**
 * Loads the starting locale and the fallback, in parallel, and puts the starting one in force. main.js calls it
 * first thing, ahead of the rest of its set-up, so that the request overlaps it. Rejects if either failed to load.
 */
export function startLocale () {
  const locale = initialLocale()
  const wanted = [...new Set([locale, FALLBACK_LOCALE])]
  return Promise.all(wanted.map(loadLocaleMessages)).then(() => {
    i18n.global.locale.value = locale
    document.documentElement.setAttribute('lang', locale)
    return locale
  })
}

export default i18n
