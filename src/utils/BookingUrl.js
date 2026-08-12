import i18n from '@/i18n';

// Locales supported by the public website (mrcall-website/i18n/routing.ts).
// Keep in sync if the website adds/removes languages.
const WEBSITE_LOCALES = ['en', 'it', 'de', 'da', 'fr', 'es', 'pt', 'ar'];
const DEFAULT_LOCALE = 'en';

// next-intl on the website uses localePrefix: 'as-needed', so the default
// locale ('en') is served at /contacts (no prefix); others at /<lang>/contacts.
export function bookingUrl() {
  const raw = i18n.global.locale?.value ?? i18n.global.locale ?? DEFAULT_LOCALE;
  const lang = String(raw).split('-')[0].toLowerCase();
  const supported = WEBSITE_LOCALES.includes(lang) ? lang : DEFAULT_LOCALE;
  const path = supported === DEFAULT_LOCALE ? '/contacts' : `/${supported}/contacts`;
  return `https://www.mrcall.ai${path}`;
}
