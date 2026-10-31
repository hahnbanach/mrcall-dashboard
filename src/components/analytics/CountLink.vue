<template>
  <router-link v-if="to && count > 0" :to="to" class="count-link" :aria-label="$t('components.callInsights.feedback.links.open', { n: count, label }, count)">{{ text }}</router-link>
  <span v-else>{{ text }}</span>
</template>

<script>
/**
 * A count that opens its calls (brief docs/briefs/2026-10-27-classification-feedback.md, scope 6; StarChat's brief,
 * decision 9): a link to the conversations list of exactly the counted calls (`to`, from `Classifications.countLink`),
 * named "Apri le {n} chiamate: {label}"; a plain number where no list can show them (a page over several businesses).
 */
export default {
  props: {
    to: { type: Object, default: null },
    count: { type: Number, required: true },
    // the count as shown (formatted); the number itself when absent
    display: { type: String, default: null },
    label: { type: String, required: true },
  },
  computed: {
    text() {
      return this.display != null ? this.display : String(this.count);
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
}
</style>
