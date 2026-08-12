import i18n from "@/i18n" // <--- 1

const Trans = {
    get supportedLocales() {
        return process.env.VUE_APP_I18N_SUPPORTED_LOCALES.split(",")
    },

    set currentLocale(newLocale) { // <--- 2
        i18n.global.locale.value = newLocale
    },

    async switchLanguage(newLocale) { // <--- 3
        if(this.isLocaleSupported(newLocale)) {
            Trans.currentLocale = newLocale
            document.querySelector("html").setAttribute("lang", newLocale)
            localStorage.setItem("mrcall-user-locale", newLocale);
        } else {
            console.error("Locale not supported: ", newLocale);
        }
    },

    isLocaleSupported(locale) { // <--- 1
        return Trans.supportedLocales.includes(locale)
    },

    getLocale() { // <--- 3
        const persistedLocale = localStorage.getItem("mrcall-user-locale")
        const navLocale = window.navigator.language ;
        console.log("Configuring Locale: ", persistedLocale, navLocale);
        if(Trans.isLocaleSupported(persistedLocale)) {
            Trans.currentLocale = persistedLocale;
            return persistedLocale
        } else if(Trans.isLocaleSupported(navLocale)) {
            Trans.currentLocale = navLocale;
            return navLocale;
        } else {
            const dl = process.env.VUE_APP_I18N_LOCALE ;
            Trans.currentLocale = dl;
            return dl ;
        }
    },
}
export default Trans