import { reactive } from "vue";

/**
 * The last gesture a person made on a call's judgements, for the one undo bar of the page (brief
 * docs/briefs/2026-10-27-classification-feedback.md, scope 2): "Modificato · Annulla" stays until dismissed or replaced
 * by the next gesture, never on a timer. One gesture, one undo: StarChat reverts every signal written under its
 * `gestureId` (`POST insights/feedback/gestures/{gestureId}/revert`).
 *
 * `affected` names the calls the gesture touched, so that each call shown re-reads its judgements once the gesture is
 * made and once it is undone (`recorded` and `undone` count them; a component watches both, skipping the gesture it made
 * itself, which it reads again on its own). `reload` is what a list runs after an undo of a gesture
 * it made (a bulk gesture changes rows, not one panel).
 */
const state = reactive({
    gestureId: null,
    affected: [],
    reload: null,
    undone: 0,
    lastUndone: { gestureId: null, affected: [] },
    // every gesture made, with its calls and the panel that made it: the other panels of those calls read again
    recorded: 0,
    lastRecorded: { gestureId: null, affected: [], origin: null },
});

export default {
    state,
    record(gestureId, affected, reload = null, origin = null) {
        state.gestureId = gestureId;
        state.affected = Array.isArray(affected) ? [...affected] : [];
        state.reload = reload;
        state.lastRecorded = { gestureId, affected: state.affected, origin };
        state.recorded += 1;
    },
    clear() {
        state.gestureId = null;
        state.affected = [];
        state.reload = null;
    },
    // After StarChat reverted the gesture: every panel of an affected call re-reads, the list that made it reloads.
    undone() {
        state.lastUndone = { gestureId: state.gestureId, affected: state.affected };
        const reload = state.reload;
        state.gestureId = null;
        state.affected = [];
        state.reload = null;
        state.undone += 1;
        if (reload) reload();
    },
};
