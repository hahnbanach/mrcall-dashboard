<template>
  <span class="column-help">
    <button
      ref="button"
      type="button"
      class="column-help-button"
      :aria-label="$t('components.callInsights.help.label', { column })"
      :aria-describedby="id"
      @mouseenter="show"
      @mouseleave="hide"
      @focus="show"
      @blur="hide"
      @click.stop="shown ? hide() : show()"
      @keydown.esc="hide"
      @keydown.enter.stop
      @keydown.space.stop
    ><i class="pi pi-info-circle" aria-hidden="true"></i></button>
    <!-- On the body, not in the header cell: the description is always in the document, so a screen reader reads it
         with the button, without becoming part of the header's own text; and the bubble, drawn when shown, is never
         clipped by the table's sideways-scroll wrapper -->
    <Teleport to="body">
      <span :id="id" class="column-help-text">{{ text }}</span>
      <span v-if="shown && placed" class="column-help-bubble" role="tooltip" aria-hidden="true" :style="position">{{ text }}</span>
    </Teleport>
  </span>
</template>

<script>
let seq = 0;
// The help shown now: one at a time. On WebKit a click does not focus a button, so a help opened by a click was never
// blurred when another got focus, and two tooltips stayed on screen (measured at 768 px).
let open = null;

/**
 * How a column is counted, on its header (brief docs/briefs/2026-10-31-analytics-ux.md, O4): a button named "How
 * this column is counted: {column}", whose description is the text, shown as a tooltip on hover and on focus (the
 * WAI-ARIA tooltip pattern: Escape hides it). PrimeVue's tooltip directive listens to hover or to focus, not both, and
 * a tooltip drawn inside the header cell would be clipped by the table's `overflow-x: auto` wrapper; this one is
 * drawn on the body at the button's position.
 */
export default {
  props: {
    column: { type: String, required: true },
    text: { type: String, required: true },
  },
  data() {
    seq += 1;
    return { id: "column-help-" + seq, shown: false, placed: false, position: {} };
  },
  beforeUnmount() {
    this.hide();
  },
  methods: {
    show() {
      if (open && open !== this) open.hide();
      open = this;
      if (!this.shown) document.addEventListener("scroll", this.follow, { capture: true, passive: true });
      this.shown = true;
      this.follow();
    },
    hide() {
      if (open === this) open = null;
      document.removeEventListener("scroll", this.follow, { capture: true });
      this.shown = false;
    },
    // Under its button, kept on screen, and drawn only while the button is on screen. The bubble follows the button
    // when something scrolls rather than closing: focusing a button scrolls it into view after the focus event (WebKit),
    // and on a tablet focusing a header can scroll the table sideways; a bubble placed once, or closed on scroll, was
    // missing the moment a keyboard reached it (measured on WebKit at 768 px).
    follow() {
      const b = this.$refs.button && this.$refs.button.getBoundingClientRect();
      this.placed = !!b && b.bottom >= 0 && b.top <= window.innerHeight && b.right >= 0 && b.left <= window.innerWidth;
      if (!this.placed) return;
      const width = Math.min(320, window.innerWidth - 16);
      const left = Math.max(8, Math.min(b.left + b.width / 2 - width / 2, window.innerWidth - width - 8));
      this.position = { top: b.bottom + 6 + "px", left: left + "px", maxWidth: width + "px" };
    },
  },
};
</script>

<style lang="less">
@import "../../assets/style/colors";

// In a header cell that sorts (PagedTable's sort button, a PrimeVue sortable column) the button's click and keys stop
// here, so asking how a column is counted never reorders the table.
.column-help {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  vertical-align: middle;
}

// PrimeVue draws a column's header slot before its title: after it, where the other tables put it
.p-datatable-column-header-content .column-help {
  order: 2;
}

.column-help-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
  padding: 0;
  border: 0;
  background: none;
  color: @mrcall_grey_text;
  cursor: help;
  border-radius: @mrcall_radius_pill;

  &:focus-visible {
    outline: 2px solid @mrcall_blue;
    outline-offset: 1px;
  }
}

// the description for assistive technology, never drawn in place
.column-help-text {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.column-help-bubble {
  position: fixed;
  z-index: 2000;
  padding: 8px 10px;
  background: @mrcall_dark_grey_text;
  color: @mrcall_white;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  text-transform: none;
  letter-spacing: normal;
  white-space: normal;
  border-radius: 6px;
  pointer-events: none;
}
</style>
