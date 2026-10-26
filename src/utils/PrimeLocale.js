/**
 * PrimeVue's own words and calendar in the reader's language: the date picker said "Choose Date" and wrote
 * "09/26/2026" on Italian screens (U19 m16 of StarChat's plan docs/execution-plans/2026-10-24-insights-reports-ux.md).
 * The day and month names and the order of a date's parts come from the browser's Intl for the locale, so they are
 * never translated by hand; the few labels PrimeVue says aloud come from the dashboard's messages
 * (`components.datePicker`). Pure: `primeLocale(tag, t)` answers the keys to merge into `$primevue.config.locale`.
 */

const LABELS = ["chooseDate", "chooseMonth", "chooseYear", "prevMonth", "nextMonth", "prevYear", "nextYear", "prevDecade", "nextDecade", "today", "clear"];

// Sunday 4 January 2026, and the six days after it: a known week to read the names of the days from.
const SUNDAY = Date.UTC(2026, 0, 4);
const DAY_MS = 24 * 3600 * 1000;

function names(tag, options, count, at) {
    const format = new Intl.DateTimeFormat(tag, { ...options, timeZone: "UTC" });
    return Array.from({ length: count }, (_, i) => format.format(new Date(at(i))));
}

// The order of day, month and year in a short date of the locale, and its separator, as PrimeVue writes a format:
// "dd/mm/yy" for it-IT, "mm/dd/yy" for en-US, "dd.mm.yy" for de-DE.
export function dateFormat(tag) {
    const parts = new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
        .formatToParts(new Date(Date.UTC(2026, 11, 31)));
    const code = { day: "dd", month: "mm", year: "yy" };
    const separator = (parts.find((p) => p.type === "literal") || { value: "/" }).value.trim() || "/";
    return parts.filter((p) => code[p.type]).map((p) => code[p.type]).join(separator);
}

// Monday first everywhere these locales are used, but in the United States.
function firstDayOfWeek(tag) {
    return /^en-US$/i.test(tag) ? 0 : 1;
}

function capitalised(text) {
    return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

export function primeLocale(tag, t) {
    const locale = {
        dayNames: names(tag, { weekday: "long" }, 7, (i) => SUNDAY + i * DAY_MS).map(capitalised),
        dayNamesShort: names(tag, { weekday: "short" }, 7, (i) => SUNDAY + i * DAY_MS).map(capitalised),
        dayNamesMin: names(tag, { weekday: "narrow" }, 7, (i) => SUNDAY + i * DAY_MS),
        monthNames: names(tag, { month: "long" }, 12, (i) => Date.UTC(2026, i, 15)).map(capitalised),
        monthNamesShort: names(tag, { month: "short" }, 12, (i) => Date.UTC(2026, i, 15)).map(capitalised),
        dateFormat: dateFormat(tag),
        firstDayOfWeek: firstDayOfWeek(tag),
    };
    for (const key of LABELS) locale[key] = t("components.datePicker." + key);
    return locale;
}

export default { primeLocale, dateFormat };
