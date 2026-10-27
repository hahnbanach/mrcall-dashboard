/**
 * The words of a judgement, one place for every screen that shows one (the call's chips, a category's requests, the
 * queues): a field's name, a value's label in the reader's language, who gave a signal and when. `t` is the component's
 * `$t`; `categories` StarChat's configured categories with their labels (`Classifications.categories`), null while it
 * answers none, and then a category is never shown by its key.
 */
const DIMENSIONS = ["resolution", "message", "booked", "transferred"];

export function judgementLabels(t, categories, locale) {
    const p = "components.callInsights.";
    const labels = {
        field(f) {
            if (DIMENSIONS.includes(f)) return t(p + "dimensions." + f);
            if (f === "outcome" || f === "category") return t(p + "feedback.fields." + f);
            return t(p + "feedback.facts." + f);
        },
        value(f, v) {
            if (v === null || v === undefined) return t(p + "feedback.unset");
            if (f === "resolution") return t(p + "resolution." + v);
            if (f === "message") return t(p + "message." + v);
            if (f === "outcome") return t(p + "feedback.outcome." + v);
            if (f === "booked" && (v === "true" || v === "false")) return t(p + "booked." + v);
            if (f === "transferred" && v === "true") return t(p + "transferred.true");
            if (f === "category") {
                const c = (categories || []).find((x) => x.key === v);
                return c ? c.label : t(p + "feedback.otherCategory");
            }
            return String(v);
        },
        who(entry) {
            const name = entry && (entry.actorName || entry.who);
            const role = entry && (entry.actorRole || entry.role);
            return name || t(p + "feedback.who." + (role || "unknown"));
        },
        when(ms) {
            return ms ? new Date(ms).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "";
        },
        // A signal said in words: a correction from and to, a value marked wrong, a confirmation, a fact reported.
        signal(s) {
            const field = labels.field(s.field);
            const from = labels.value(s.field, s.valueFrom);
            if (s.signal === "fact_wrong") return t(p + "feedback.queue.fact", { field });
            if (s.signal === "wrong") return t(p + "feedback.queue.wrong", { field, from });
            if (s.signal === "right") return t(p + "feedback.queue.right", { field, from });
            return t(p + "feedback.queue.change", { field, from, to: labels.value(s.field, s.valueTo) });
        },
    };
    return labels;
}

export default { judgementLabels };
