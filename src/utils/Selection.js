import { reactive } from "vue";

const NARROW = "(max-width: 599px)";
const LONG_PRESS_MS = 600;

/**
 * The selection of a list's rows for a gesture (brief docs/briefs/2026-10-27-classification-feedback.md, scope 4 and 5;
 * StarChat's brief, decision 9, "Narrow screens"): on a wide screen a checkbox per row, always shown; under 600 px a mode
 * a long press on a row enters (selecting that row), the checkboxes shown while it lasts. One implementation for every
 * list that corrects in bulk (the conversations list, a category's requests).
 *
 * `selected` is a Set of row keys, replaced on every change so that a view re-renders. `pressStart(key, event)` and
 * `pressEnd()` are the row's pointer handlers; a press that starts on a control (a button, a link, a checkbox, a menu)
 * is the control's. `dispose()` drops the screen-width listener and a pending press.
 */
export function createSelection() {
    const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(NARROW) : null;
    let timer = null;
    const state = reactive({
        selected: new Set(),
        mode: false,
        narrow: !!(media && media.matches),
        get size() {
            return state.selected.size;
        },
        // whether the rows show their checkbox
        get showChecks() {
            return !state.narrow || state.mode;
        },
        has(key) {
            return state.selected.has(key);
        },
        toggle(key, on) {
            const next = new Set(state.selected);
            if (on) next.add(key); else next.delete(key);
            state.selected = next;
        },
        clear() {
            state.selected = new Set();
            state.mode = false;
        },
        pressStart(key, event) {
            if (!state.narrow || state.mode) return;
            const target = event && event.target;
            if (target && target.closest && target.closest("button, a, input, select, textarea, audio, [role=listbox], [role=option]")) return;
            state.pressEnd();
            timer = setTimeout(() => {
                timer = null;
                state.mode = true;
                state.toggle(key, true);
            }, LONG_PRESS_MS);
        },
        pressEnd() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        },
        dispose() {
            state.pressEnd();
            if (media) media.removeEventListener("change", onChange);
        },
    });
    function onChange(e) {
        state.narrow = e.matches;
        if (!e.matches) state.mode = false;
    }
    if (media) media.addEventListener("change", onChange);
    return state;
}

export default { createSelection };
