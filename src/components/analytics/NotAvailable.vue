<template>
  <!-- "n.d.", with why, said once to assistive technology: as the description of "n.d." (`aria-describedby`), from text
       kept out of the reading order (`aria-hidden`; a description is computed from it all the same), so a screen reader
       never reads it again in place (U19r6b m-e, n3). For a pointer the same text shows on hover. A `title` would not
       do: on the abbr, and on any wrapper, Chromium made it an accessible name, one more reading of the reason. -->
  <span class="not-available">
    <abbr :aria-describedby="id">{{ $t("components.callInsights.change.notAvailable") }}</abbr>
    <span :id="id" class="not-available-reason" aria-hidden="true">{{ help }}</span>
  </span>
</template>

<script>
import InsightsReports from "@/utils/InsightsReports";

let seq = 0;

/**
 * A change that says nothing (`InsightsReports.change` answering `{available: false, reason}`): a previous base under 20
 * calls, or a previous window with calls for part of its days. The one way every screen says it, with its reason.
 */
export default {
  props: {
    change: { type: Object, required: true },
  },
  data() {
    seq += 1;
    return { id: "not-available-" + seq };
  },
  computed: {
    help() {
      return this.$t(InsightsReports.changeHelpKey(this.change));
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.not-available {
  position: relative;
  cursor: help;

  abbr {
    text-decoration: underline dotted;
  }
}

// hidden to the eye until the pointer is over "n.d.", then a tooltip under it
.not-available-reason {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.not-available:hover .not-available-reason {
  clip: auto;
  width: max-content;
  max-width: 280px;
  height: auto;
  white-space: normal;
  top: 100%;
  left: 0;
  z-index: 10;
  margin-top: 4px;
  padding: 6px 8px;
  border-radius: 6px;
  background: @mrcall_dark_grey_text;
  color: @mrcall_white;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.3;
}
</style>
