import { describe, it, expect, beforeEach } from 'vitest'
import i18n, { loadLocaleMessages, loadLanguageAsync, initialLocale, LOCALES } from '@/i18n'

// The locale loader (src/i18n/index.js, plan docs/execution-plans/2026-10-23-dashboard-load.md, M3).
describe('loadLocaleMessages', () => {
  it('knows the twelve locales and refuses any other', async () => {
    expect(LOCALES).toHaveLength(12)
    await expect(loadLocaleMessages('xx-XX')).rejects.toThrow('Unknown locale: xx-XX')
  })

  it('registers a locale under its tag and its short alias', async () => {
    await loadLocaleMessages('fr-FR')
    const tag = i18n.global.getLocaleMessage('fr-FR')
    expect(Object.keys(tag).length).toBeGreaterThan(0)
    expect(i18n.global.getLocaleMessage('fr')).toEqual(tag)
  })

  it('loads a locale once: the same promise for every call', () => {
    expect(loadLocaleMessages('de-DE')).toBe(loadLocaleMessages('de-DE'))
  })

  it('makes a loaded locale the interface language', async () => {
    await loadLanguageAsync('it-IT')
    expect(i18n.global.locale.value).toBe('it-IT')
    expect(document.documentElement.getAttribute('lang')).toBe('it-IT')
    await loadLanguageAsync('en-US')
  })
})

describe('initialLocale', () => {
  const at = (url) => new URL(url, 'https://dashboard.test')
  beforeEach(() => {
    localStorage.clear()
    // the build defines it from .env; vitest does not read .env
    process.env.VUE_APP_I18N_SUPPORTED_LOCALES = 'en-US,it-IT,fr-FR,es-ES,de-DE,da-DK,el-GR,es-ES,et-EE,fi-FI,nb-NO,nl-NL,sv-SE'
  })

  it('takes lang on the sign-in and sign-up pages only', () => {
    expect(initialLocale(at('/signin?lang=it-IT'))).toBe('it-IT')
    expect(initialLocale(at('/login?lang=de-DE'))).toBe('de-DE')
    expect(initialLocale(at('/signup/?lang=fr-FR'))).toBe('fr-FR')
    // Conversations reads lang as a date format: not the interface language
    expect(initialLocale(at('/conversations?lang=it-IT'))).not.toBe('it-IT')
  })

  it('ignores an unsupported lang', () => {
    expect(initialLocale(at('/signin?lang=xx-XX'))).toBe(initialLocale(at('/signin')))
  })

  it('maps the custom-token page\'s language as the page does', () => {
    expect(initialLocale(at('/customtokenlogin?language=it'))).toBe('it-IT')
    expect(initialLocale(at('/customtokenlogin?language=it-CH'))).toBe('it-IT')
    expect(initialLocale(at('/customtokenlogin?language=de'))).toBe('en-US')
  })

  it('then the language chosen before', () => {
    localStorage.setItem('mrcall-user-locale', 'nl-NL')
    expect(initialLocale(at('/businesses'))).toBe('nl-NL')
  })
})
