/**
 * What a refusal or a warning about the room says to the owner: what happens, with the numbers, and what they
 * can do, in their language. Never the server's English `detail`.
 *
 * StarChat gives each restaurant problem a code and `values`, the numbers and names the sentence needs, only when
 * there are some (9.34, after 9.34.65; StarChat ApiDomainRestaurantResource, LayoutValidation, LayoutDraft). A code
 * with its values present is said with them (`layoutValues.<code>`); without them (an older server, a code that
 * carries none) it is said without numbers (`layoutCode.<code>`), so a sentence never shows a bare "{seats}".
 * The values each sentence needs are listed here, as the server names them: the contract with it.
 */
export const VALUES_NEEDED = {
    party_larger_than_room: ["maxPartySize", "largestSeating"],
    size_never_bookable: ["sizes"],
    table_has_holds: ["table"],
    out_of_range: ["value", "min", "max"],
    above_tables: ["value", "seats"],
    duplicate_name: ["table"],
    join_across_zones: ["tables"],
    unknown_table: ["tables"],
    bad_zone_id: ["zone"],
    duplicate_zone: ["zone"],
    ends_before_start: ["from", "to"],
    no_zone: ["table"],
    unknown_zone: ["table", "zone"],
    duplicate_join: ["tables"],
    bad_value: ["value"],
};

const present = v => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0) && String(v) !== "";

/**
 * A list of tables as the server names them: ids (`unknown_table`, `duplicate_join`), names, or `{table, zone}`
 * pairs (`join_across_zones`), written with the room's names.
 */
function tablesText(tables, tableName) {
    return (Array.isArray(tables) ? tables : [tables]).map(x => {
        if (x && typeof x === "object") return `${tableName(x.table)} (${x.zone})`;
        return tableName(x);
    }).join(", ");
}

/**
 * @param p          the problem as the server answered it: {path, code, detail, values?}
 * @param t, te      the page's translation functions
 * @param whoOn      for a table's name or id, the bookings on it the page has read ("Rossi (13 Oct 20:00, 4)"), or ""
 * @param tableName  a table's name for its id (the server names tables by id in some values)
 */
export function layoutMessage(p, { t, te, whoOn = () => "", tableName = x => String(x) }) {
    const code = p && p.code;
    const values = (p && p.values) || {};
    // LayoutDraft's unknown_table names one table, by the name the draft gave it
    const v = code === "unknown_table" && present(values.table) && !present(values.tables) ? Object.assign({}, values, { tables: [values.table] }) : values;
    const needed = VALUES_NEEDED[code];
    if (needed && needed.every(k => present(v[k])) && te(`components.restaurant.layoutValues.${code}`)) {
        const args = {};
        Object.keys(v).forEach(k => { args[k] = Array.isArray(v[k]) ? v[k].join(", ") : v[k]; });
        if (v.tables !== undefined) args.tables = tablesText(v.tables, tableName);
        if (v.table !== undefined && typeof v.table === "number") args.table = tableName(v.table);
        if (code === "party_larger_than_room") args.from = Number(v.largestSeating) + 1;
        if (code === "table_has_holds") {
            const who = whoOn(v.table);
            args.who = who ? ` (${who})` : "";
        }
        return t(`components.restaurant.layoutValues.${code}`, args);
    }
    return t(`components.restaurant.layoutCode.${te(`components.restaurant.layoutCode.${code}`) ? code : "other"}`);
}
