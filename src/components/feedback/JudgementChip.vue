<template>
  <span ref="root" class="judgement">
    <button
      ref="button"
      type="button"
      class="judgement-chip"
      :class="'judgement-' + (kind || 'model')"
      aria-haspopup="listbox"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-label="accessibleName"
      :title="detail || null"
      :aria-busy="busy ? 'true' : 'false'"
      @click="toggle"
      @keydown.down.prevent="show"
    >
      <span class="judgement-value">{{ valueLabel }}</span>
      <span v-if="stateLabel" class="judgement-state">{{ stateLabel }}</span>
      <i :class="busy ? 'pi pi-spin pi-spinner' : 'pi pi-chevron-down'" aria-hidden="true"></i>
    </button>
    <!-- Under 600 px a bottom sheet over the page; otherwise a popover under the chip. Either way a listbox. -->
    <Teleport to="body" :disabled="!sheet">
      <template v-if="open">
        <div v-if="sheet" class="judgement-backdrop" @click="close(true)"></div>
        <div :class="sheet ? 'judgement-sheet insights-ui' : ['judgement-popover', { 'judgement-popover-up': upward }]">
          <p v-if="sheet" class="judgement-sheet-title">{{ fieldLabel }}</p>
          <ul
            :id="listId"
            ref="list"
            role="listbox"
            tabindex="-1"
            class="judgement-list"
            :aria-label="$t('components.callInsights.feedback.menu.label', { field: fieldLabel })"
            :aria-activedescendant="entries.length ? optionId(active) : null"
            @keydown="onKey"
          >
            <li
              v-for="(entry, i) in entries"
              :id="optionId(i)"
              :key="entry.key"
              role="option"
              :aria-selected="entry.current ? 'true' : 'false'"
              class="judgement-option"
              :class="{ 'judgement-option-active': i === active, 'judgement-option-current': entry.current, 'judgement-option-action': entry.action, 'judgement-option-first-action': entry.firstAction }"
              @mousedown.prevent
              @click="pick(entry)"
            >
              <i v-if="entry.current" class="pi pi-check" aria-hidden="true"></i>
              <span>{{ entry.label }}</span>
            </li>
          </ul>
        </div>
      </template>
    </Teleport>
  </span>
</template>

<script>
let seq = 0;

/**
 * A judgement of a call as a chip (brief docs/briefs/2026-10-27-classification-feedback.md, scope 1; StarChat's brief,
 * decision 9, "Accessibility" and "Narrow screens"): a button naming the field, the value and its state ("Corretta" and
 * from, to, who, when, in its accessible name and its tooltip); one tap opens a listbox of `entries` (`{key, label,
 * current, action}`), the current value marked. Under 600 px the listbox is a bottom sheet; nothing depends on hover.
 * Keyboard: Enter, Space or ArrowDown open; arrows, Home and End move; Enter or Space choose; Escape and Tab close,
 * Escape returning to the chip. The chip decides nothing: it emits `choose(entry)`, and `opening` before it opens when
 * `deferred` (its parent reads the entries first, then calls `show()`).
 */
export default {
  props: {
    fieldLabel: { type: String, required: true },
    valueLabel: { type: String, required: true },
    stateLabel: { type: String, default: null },
    detail: { type: String, default: null },
    kind: { type: String, default: "model" },
    entries: { type: Array, default: () => [] },
    busy: { type: Boolean, default: false },
    deferred: { type: Boolean, default: false },
    // an accessible name of its own, for a chip that is an action rather than a value ("Cambia esito")
    name: { type: String, default: null },
    // the popover opens above the chip (a chip in a bar at the bottom of the screen)
    upward: { type: Boolean, default: false },
  },
  emits: ["choose", "opening"],
  data() {
    seq += 1;
    return { open: false, active: 0, sheet: false, uid: "judgement-" + seq };
  },
  computed: {
    listId() {
      return this.uid + "-list";
    },
    accessibleName() {
      if (this.name) return this.name;
      let name = this.$t("components.callInsights.feedback.chip.name", { field: this.fieldLabel, value: this.valueLabel });
      if (this.stateLabel) name += ", " + this.stateLabel;
      if (this.detail) name += " (" + this.detail + ")";
      return name;
    },
  },
  beforeUnmount() {
    document.removeEventListener("mousedown", this.outside, true);
  },
  methods: {
    optionId(i) {
      return this.uid + "-option-" + i;
    },
    // busy, the chip keeps its focus and ignores taps: a disabled button would drop the focus to the page
    toggle() {
      if (this.busy) return;
      if (this.open) this.close(false);
      else this.show();
    },
    show() {
      if (this.busy) return;
      if (this.deferred) {
        this.$emit("opening");
        return;
      }
      if (this.entries.length === 0) return;
      this.sheet = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 599px)").matches;
      const current = this.entries.findIndex((e) => e.current);
      this.active = current >= 0 ? current : 0;
      this.open = true;
      document.addEventListener("mousedown", this.outside, true);
      this.$nextTick(() => this.$refs.list && this.$refs.list.focus());
    },
    close(refocus) {
      this.open = false;
      document.removeEventListener("mousedown", this.outside, true);
      if (refocus) this.$nextTick(() => this.$refs.button && this.$refs.button.focus());
    },
    outside(event) {
      const list = this.$refs.list;
      if (this.$refs.root && this.$refs.root.contains(event.target)) return;
      if (list && list.parentElement && list.parentElement.contains(event.target)) return;
      this.close(false);
    },
    pick(entry) {
      this.close(true);
      this.$emit("choose", entry);
    },
    onKey(event) {
      const last = this.entries.length - 1;
      switch (event.key) {
        case "ArrowDown": this.active = Math.min(last, this.active + 1); break;
        case "ArrowUp": this.active = Math.max(0, this.active - 1); break;
        case "Home": this.active = 0; break;
        case "End": this.active = last; break;
        case "Enter":
        case " ":
          this.pick(this.entries[this.active]);
          break;
        case "Escape": this.close(true); break;
        case "Tab": this.close(false); return;
        default: return;
      }
      event.preventDefault();
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.judgement {
  position: relative;
  display: inline-block;
}

.judgement-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid @mrcall_borders;
  border-radius: 16px;
  background: @mrcall_white;
  color: @mrcall_dark_grey_text;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid @mrcall_blue;
    outline-offset: 2px;
  }

  &[aria-busy="true"] {
    cursor: progress;
  }

  .pi {
    font-size: 11px;
    color: @mrcall_grey_text2;
  }
}

.judgement-state {
  font-size: 12px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 10px;
  background: @mrcall_light_grey_2;
  color: @mrcall_grey_text;
}

.judgement-corrected .judgement-state,
.judgement-applied .judgement-state,
.judgement-confirmed .judgement-state {
  background: @mrcall_bluette;
  color: @mrcall_blue;
}

.judgement-popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1000;
  min-width: 240px;
  max-width: 320px;
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.judgement-popover-up {
  top: auto;
  bottom: calc(100% + 4px);
}

.judgement-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.35);
}

.judgement-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1201;
  max-height: 70vh;
  overflow-y: auto;
  background: @mrcall_white;
  border-radius: 14px 14px 0 0;
  padding: 8px 0 16px;
}

.judgement-sheet-title {
  margin: 4px 16px 8px;
  font-size: 13px;
  font-weight: 700;
  color: @mrcall_grey_text2;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.judgement-list {
  list-style: none;
  margin: 0;
  padding: 6px 0;
  outline: none;
}

.judgement-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 14px 8px 32px;
  font-size: 14px;
  color: @mrcall_dark_grey_text;
  cursor: pointer;

  .pi {
    margin-left: -20px;
    font-size: 12px;
    color: @mrcall_blue;
  }
}

.judgement-option-active {
  background: @mrcall_bluette;
}

.judgement-option-current {
  font-weight: 700;
}

.judgement-option-first-action {
  border-top: 1px solid @mrcall_borders;
  margin-top: 4px;
}

.judgement-option-action {
  color: @mrcall_grey_text;
}
</style>
