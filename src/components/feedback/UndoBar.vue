<template>
  <!-- Always in the page, so the live region exists before it speaks; its content appears with the gesture -->
  <div class="undo-bar-region" :class="{ 'undo-bar-raised': raised }" role="status" aria-live="polite">
    <div v-if="state.gestureId || message" class="undo-bar insights-ui">
      <span class="undo-bar-text">{{ message || $t("components.callInsights.feedback.undo.changed") }}</span>
      <template v-if="state.gestureId">
        <span aria-hidden="true">·</span>
        <button type="button" class="undo-bar-action" :disabled="busy" @click="undo">
          {{ $t("components.callInsights.feedback.undo.undo") }}
        </button>
      </template>
      <button
        type="button"
        class="undo-bar-close"
        :aria-label="$t('components.callInsights.feedback.undo.close')"
        :title="$t('components.callInsights.feedback.undo.close')"
        @click="close"
      >
        <i class="pi pi-times" aria-hidden="true"></i>
      </button>
    </div>
  </div>
</template>

<script>
import Classifications from "@/utils/Classifications";
import UndoGesture from "@/utils/UndoGesture";
import { isSessionEnded } from "@/firebase/session";

/**
 * The one undo of a page's judgements (brief docs/briefs/2026-10-27-classification-feedback.md, scope 2): after every
 * gesture, "Modificato · Annulla", announced to screen readers, with no time limit, until the next gesture replaces it
 * or the person closes it. "Annulla" reverts the whole gesture (one gesture, one undo), then says so or says it failed.
 * Built new: the conversations page's toast group "undo" never rendered, and a toast has a time limit.
 * `raised`: a bottom bar of bulk actions is shown under it.
 */
export default {
  props: {
    raised: { type: Boolean, default: false },
  },
  data() {
    return { state: UndoGesture.state, busy: false, message: null };
  },
  watch: {
    "state.gestureId"(value) {
      if (value) this.message = null;
    },
  },
  // The undo belongs to the page it was offered on: leaving it drops the gesture, whose list is gone with it.
  beforeUnmount() {
    UndoGesture.clear();
  },
  methods: {
    async undo() {
      const user = this.$store.state.user;
      const gestureId = this.state.gestureId;
      if (!user || !gestureId) return;
      this.busy = true;
      try {
        const answer = await Classifications.revertGesture(user, gestureId);
        UndoGesture.undone(answer && answer.calls, answer && answer.reverted);
        this.message = this.$t("components.callInsights.feedback.undo.undone");
      } catch (error) {
        if (isSessionEnded(error)) return;
        this.message = this.$t("components.callInsights.feedback.undo.failed");
      } finally {
        this.busy = false;
      }
    },
    close() {
      UndoGesture.clear();
      this.message = null;
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.undo-bar-region {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 1100;
  max-width: calc(100vw - 24px);

  &.undo-bar-raised {
    bottom: 84px;
  }
}

.undo-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: @mrcall_dark_grey_text;
  color: @mrcall_white;
  font-size: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.undo-bar-action,
.undo-bar-close {
  background: none;
  border: none;
  color: @mrcall_white;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;

  &:focus-visible {
    outline: 2px solid @mrcall_white;
  }
}

.undo-bar-action {
  text-decoration: underline;
}
</style>
