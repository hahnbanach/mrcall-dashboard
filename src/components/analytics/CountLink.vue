<template>
  <button v-if="opens && analyticsOverlay" type="button" class="count-link" :aria-label="name" @click="analyticsOverlay.openCount(to, label, count, $event.currentTarget)">{{ text }}</button>
  <router-link v-else-if="opens" :to="to" class="count-link" :aria-label="name">{{ text }}</router-link>
  <span v-else>{{ text }}</span>
</template>

<script>
/**
 * A count that opens its calls (brief docs/briefs/2026-10-27-classification-feedback.md, scope 6; StarChat's brief,
 * decision 9), named "Apri le {n} chiamate: {label}". On an analytics page (under `AnalyticsOverlayHost`) it opens the
 * counted-calls panel over the page (brief docs/briefs/2026-10-31-analytics-ux.md, O2); elsewhere it links to the
 * conversations list of exactly the counted calls (`to`, from `Classifications.countLink`). A plain number where no
 * list can show them (a page over several businesses). `count` null is a count not known (a report's group whose
 * analytics are not read): the list still opens, named for all its calls.
 */
export default {
  inject: { analyticsOverlay: { default: null } },
  props: {
    to: { type: Object, default: null },
    count: { type: Number, default: null },
    // the count as shown (formatted); the number itself when absent
    display: { type: String, default: null },
    label: { type: String, required: true },
  },
  computed: {
    opens() {
      return !!this.to && (this.count === null || this.count > 0);
    },
    text() {
      return this.display != null ? this.display : String(this.count);
    },
    name() {
      return this.count === null
        ? this.$t("components.callInsights.feedback.links.openAll", { label: this.label })
        : this.$t("components.callInsights.feedback.links.open", { n: this.count, label: this.label }, this.count);
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.count-link {
  color: @mrcall_blue;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  // drawn as the link it was: a button that opens the list over the page
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  cursor: pointer;
}
</style>
