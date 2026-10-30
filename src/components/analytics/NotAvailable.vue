<template>
  <!-- "n.d.", with why: in its `title` for a pointer, and as text it is described by, which a screen reader reads with
       it and which keyboard and touch reach without a `title` (U19r6b m-e) -->
  <span class="not-available">
    <abbr :title="help" :aria-describedby="id">{{ $t("components.callInsights.change.notAvailable") }}</abbr>
    <span :id="id" class="visually-hidden">{{ help }}</span>
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
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
