<template>
  <p class="signal-explain">
    <span class="signal-meaning">{{ $t("components.callInsights.signals." + signal + ".meaning") }}</span>{{ " " }}<span class="signal-action">{{ $t("components.callInsights.signals." + signal + ".action") }}</span>
  </p>
</template>

<script>
/**
 * What a quality signal means and what to do about it, written under its count wherever it is shown (brief
 * docs/briefs/2026-10-31-analytics-ux.md, O5): the Quality section of every analytics page and the report page's
 * quality table and gaps. One text per signal (`components.callInsights.signals`), StarChat's own definitions in the
 * reader's words: a gap reason, a check, `skillErrors` or `extraction`.
 */
export default {
  props: {
    signal: { type: String, required: true },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.signal-explain {
  margin: 2px 0 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: @mrcall_grey_text;
}

.signal-action {
  color: @mrcall_dark_grey_text;
}
</style>
