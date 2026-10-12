/**
 * What a refusal or a warning about the room says to the owner: what happens, with the numbers, and what they
 * can do, in their language. Never the server's English `detail`.
 *
 * StarChat gives each restaurant problem a code and, as it is being extended, `values` (the numbers and names
 * the sentence needs) only when there are some. A code with its values present is said with them
 * (`layoutValues.<code>`); without them, or with some missing, it is said without numbers
 * (`layoutCode.<code>`), so a sentence never shows a bare "{maxPartySize}". The values each sentence needs are
 * listed here, which is the contract with the server; a value it does not send is never invented.
 */
export const VALUES_NEEDED = {
    party_larger_than_room: ["maxPartySize", "largestSeating"],
    size_never_bookable: ["sizes"],
    table_has_holds: ["table"],
    out_of_range: ["value", "min", "max"],
    above_tables: ["value", "max"],
    duplicate_name: ["name"],
    join_across_zones: ["tables"],
    unknown_table: ["tables"],
};

const present = v => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0) && String(v) !== "";

/**
 * @param p      the problem as the server answered it: {path, code, detail, values?}
 * @param t, te  the page's translation functions
 * @param whoOn  for a table's name or id, the bookings on it the page has read ("Rossi (13 Oct 20:00, 4)"), or ""
 */
export function layoutMessage(p, { t, te, whoOn = () => "" }) {
    const code = p && p.code;
    const values = (p && p.values) || {};
    const needed = VALUES_NEEDED[code];
    if (needed && needed.every(k => present(values[k])) && te(`components.restaurant.layoutValues.${code}`)) {
        const args = {};
        Object.keys(values).forEach(k => { args[k] = Array.isArray(values[k]) ? values[k].join(", ") : values[k]; });
        if (code === "party_larger_than_room") args.from = Number(values.largestSeating) + 1;
        if (code === "table_has_holds") {
            const who = whoOn(values.table);
            args.who = who ? ` (${who})` : "";
        }
        return t(`components.restaurant.layoutValues.${code}`, args);
    }
    return t(`components.restaurant.layoutCode.${te(`components.restaurant.layoutCode.${code}`) ? code : "other"}`);
}
