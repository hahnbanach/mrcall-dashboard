import { createI18n } from 'vue-i18n'

// Import language files directly
import enUS from './locales/en-US.json'
import itIT from './locales/it-IT.json'
import esES from './locales/es-ES.json'
import frFR from './locales/fr-FR.json'
import deDE from './locales/de-DE.json'
import nlNL from './locales/nl-NL.json'
import svSE from './locales/sv-SE.json'
import daDK from './locales/da-DK.json'
import nbNO from './locales/nb-NO.json'
import fiFI from './locales/fi-FI.json'
import etEE from './locales/et-EE.json'
import elGR from './locales/el-GR.json'

const i18n = createI18n({
  legacy: false,
  locale: process.env.VUE_APP_I18N_LOCALE || 'en-US',
  fallbackLocale: process.env.VUE_APP_I18N_FALLBACK_LOCALE || 'en-US',
  globalInjection: true,
  compositionOnly: false,
  fallbackWarn: false,
  missingWarn: false,
  messages: {
    'en-US': enUS,
    'en': enUS,
    'it-IT': itIT,
    'it': itIT,
    'es-ES': esES,
    'es': esES,
    'fr-FR': frFR,
    'fr': frFR,
    'de-DE': deDE,
    'de': deDE,
    'nl-NL': nlNL,
    'nl': nlNL,
    'sv-SE': svSE,
    'sv': svSE,
    'da-DK': daDK,
    'da': daDK,
    'nb-NO': nbNO,
    'nb': nbNO,
    'fi-FI': fiFI,
    'fi': fiFI,
    'et-EE': etEE,
    'et': etEE,
    'el-GR': elGR,
    'el': elGR
  }
})

export async function loadLanguageAsync(locale) {
  // Change locale
  i18n.global.locale = locale
  return Promise.resolve(locale)
}

export default i18n
