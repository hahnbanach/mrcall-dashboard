import i18n, { loadLanguageAsync } from "@/i18n"

/**
 * The language switch the components use (Navbar, Signin, Signup, CustomTokenSignin, and `getLocale` inside computed
 * properties). Locales load on demand (src/i18n/index.js): switching waits for the new locale's messages before it
 * takes effect, so a page never shows keys or a mix of two languages.
 */
const Trans = {
    get supportedLocales() {
        return process.env.VUE_APP_I18N_SUPPORTED_LOCALES.split(",")
    },

    // Kept for callers that assign; the change takes effect once the locale has loaded.
    set currentLocale(newLocale) {
        loadLanguageAsync(newLocale).catch((error) => console.error("Locale could not be loaded: ", newLocale, error))
    },

    async switchLanguage(newLocale) {
        if(!this.isLocaleSupported(newLocale)) {
            console.error("Locale not supported: ", newLocale);
            return
        }
        try {
            await loadLanguageAsync(newLocale)
            localStorage.setItem("mrcall-user-locale", newLocale);
        } catch (error) {
            // the interface stays in the language it was in
            console.error("Locale could not be loaded: ", newLocale, error);
        }
    },

    isLocaleSupported(locale) {
        return Trans.supportedLocales.includes(locale)
    },

    // The interface language now. It used to resolve the language again (localStorage, then the browser's) and set
    // it, a side effect inside the computed properties that call it; main.js now resolves it once, before mounting
    // (src/i18n/index.js, `initialLocale`), and switches go through `switchLanguage`.
    getLocale() {
        return i18n.global.locale.value
    },
}
export default Trans
