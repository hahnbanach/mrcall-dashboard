import { reactive } from "vue";

/**
 * The last gesture a person made on a call's judgements, for the one undo bar of the page (brief
 * docs/briefs/2026-10-27-classification-feedback.md, scope 2): "Modificato · Annulla" stays until dismissed or replaced
 * by the next gesture, never on a timer. One gesture, one undo: StarChat reverts every signal written under its
 * `gestureId` (`POST insights/feedback/gestures/{gestureId}/revert`).
 *
 * `affected` names the calls the gesture touched, so that each call shown re-reads its judgements once the gesture is
 * undone (`undone` counts the undos; a component watches it). `reload` is what a list runs after an undo of a gesture
 * it made (a bulk gesture changes rows, not one panel).
 */
const state = reactive({
    gestureId: null,
    affected: [],
    reload: null,
    undone: 0,
    lastUndone: { gestureId: null, affected: [] },
});

export default {
    state,
    record(gestureId, affected, reload = null) {
        state.gestureId = gestureId;
        state.affected = Array.isArray(affected) ? [...affected] : [];
        state.reload = reload;
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
