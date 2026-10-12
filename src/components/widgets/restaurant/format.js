import parsePhoneNumber from "libphonenumber-js";
import { dateOf } from "@/utils/RestaurantModel";

/** How the restaurant page writes days and phones, in the owner's language. */

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/** "Sabato 12 ottobre". */
export function longDate(key, locale) {
    return cap(dateOf(key).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }));
}

/** "sab 12 ott". */
export function shortDate(key, locale) {
    return dateOf(key).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

/** "ottobre 2026". */
export function monthTitle(key, locale) {
    return cap(dateOf(key).toLocaleDateString(locale, { month: "long", year: "numeric" }));
}

/** A phone as the book keeps it (digits, no "+") in international form, with the URIs to call it and to
 *  write to it on WhatsApp. */
export function phoneOf(raw) {
    const digits = String(raw || "").replace(/[^\d+]/g, "");
    if (!digits) return null;
    const e164 = digits.startsWith("+") ? digits : `+${digits}`;
    const parsed = parsePhoneNumber(e164);
    const text = parsed ? parsed.formatInternational() : e164;
    return { text, uri: parsed ? parsed.getURI() : `tel:${e164}`, whatsapp: `https://wa.me/${e164.replace(/\D/g, "")}` };
}

/** The refusals the page says in its own words; anything else is a generic failure. */
export const KNOWN_CODES = ["full", "closed", "not_offered", "too_late", "beyond_horizon", "large_party", "bad_covers", "stale",
    "busy_retry", "idempotency_key_reused", "not_found", "not_configured", "unknown_zone", "unknown_table", "join_across_zones",
    "person_required", "scope_missing", "not_reversible", "table_taken"];

/** Refusals a person may override by booking anyway (the server's `overbook`). */
export const OVERRIDABLE = ["full", "not_offered", "too_late", "large_party", "closed"];

export function refusalKey(code) {
    return `components.restaurant.answer.${KNOWN_CODES.includes(code) ? code : "error"}`;
}
