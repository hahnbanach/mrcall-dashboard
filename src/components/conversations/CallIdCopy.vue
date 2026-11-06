<template>
  <span class="call-id-copy">
    <span class="call-id-label">{{ $t("components.conversations.details.callId.label") }}</span>
    <!-- the whole id, clipped to its shown length: selecting it, reading it aloud or copying it by hand gives the
         whole id, never the shortened text -->
    <code
      ref="code"
      class="call-id"
      :class="{ 'call-id-clipped': clipped, 'call-id-revealed': revealed }"
      :style="clipped ? { maxWidth: (length + 1) + 'ch' } : null"
      :title="id"
      @click.stop
    >{{ id }}</code>
    <button
      type="button"
      class="call-id-button"
      :aria-label="$t('components.conversations.details.callId.copy', { id: shown })"
      :title="$t('components.conversations.details.callId.copy', { id: shown })"
      @click.stop="copy"
    >
      <i class="pi pi-copy" aria-hidden="true"></i>
    </button>
    <!-- present and empty from the first render, so that what is written into it is announced -->
    <span class="call-id-status" :class="{ 'call-id-status-failed': status === 'failed' }" aria-live="polite">{{ statusText }}</span>
  </span>
</template>

<script>
import { CALL_ID_MIN, truncated } from "@/utils/CallId";

const COPIED_MS = 2000;

/**
 * A call's id, shown shortened (its first `length` characters, `src/utils/CallId.js` says how many), the whole id on
 * hover, and a button that copies the whole id (brief docs/briefs/2026-11-06-call-id-copy.md). The copy is for
 * passing a call to StarChat's tools when a problem is reported, so it is offered to every reader, owner or not.
 * When the clipboard cannot be written, the whole id is shown and selected, so it can be copied by hand on a phone
 * or from the keyboard as well.
 */
export default {
  props: {
    id: { type: String, required: true },
    length: { type: Number, default: CALL_ID_MIN },
  },
  data() {
    return { status: "", revealed: false, timer: null, attempt: 0 };
  },
  computed: {
    cut() {
      return truncated(this.id, this.length);
    },
    clipped() {
      return this.cut && !this.revealed;
    },
    shown() {
      return this.cut ? this.id.slice(0, this.length) + "…" : this.id;
    },
    statusText() {
      if (this.status === "copied") return this.$t("components.conversations.details.callId.copied");
      if (this.status === "failed") return this.$t("components.conversations.details.callId.copyFailed");
      return "";
    },
  },
  beforeUnmount() {
    clearTimeout(this.timer);
  },
  methods: {
    async copy() {
      clearTimeout(this.timer);
      // only the latest of overlapping copies (a fast double click) writes the status and starts its timer
      const attempt = ++this.attempt;
      const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
      // a missing API goes straight to the failure: an awaited optional call would resolve and read as a copy
      if (!clipboard || typeof clipboard.writeText !== "function") return this.failed();
      try {
        await clipboard.writeText(this.id);
      } catch {
        // refused: no permission, or the page not focused
        return attempt === this.attempt ? this.failed() : undefined;
      }
      if (attempt !== this.attempt) return;
      // emptied first, so that a repeated copy is announced again
      this.status = "";
      await this.$nextTick();
      if (attempt !== this.attempt) return;
      clearTimeout(this.timer);
      this.status = "copied";
      this.timer = setTimeout(() => { this.status = ""; }, COPIED_MS);
    },
    async failed() {
      this.revealed = true;
      // emptied first, so that a repeated failure is announced again
      this.status = "";
      await this.$nextTick();
      this.status = "failed";
      this.$nextTick(() => {
        const code = this.$refs.code;
        const selection = typeof window !== "undefined" && window.getSelection ? window.getSelection() : null;
        if (!code || !selection) return;
        // addRange does nothing while a range exists
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.addRange(range);
      });
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.call-id-copy {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  font-size: 0.8rem;
  color: @mrcall_grey_text2;
}

// visually hidden, read by a screen reader before the id
.call-id-label {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.call-id {
  display: inline-block;
  max-width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  color: @mrcall_grey_text;
}

// shown whole after a refused copy: it wraps, so a 40 to 49 character id stays inside a phone's card
.call-id-revealed {
  white-space: normal;
  overflow-wrap: anywhere;
}

.call-id-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  border: 1px solid @mrcall_borders;
  border-radius: 6px;
  background: @mrcall_white;
  color: @mrcall_grey_text;
  cursor: pointer;

  &:hover {
    background: @mrcall_light_grey_2;
  }

  &:focus-visible {
    outline: 2px solid @mrcall_blue;
    outline-offset: 2px;
  }

  i {
    font-size: 0.8rem;
  }
}

.call-id-status {
  color: #2e7d32;

  &.call-id-status-failed {
    color: #c62828;
  }
}
</style>
