<template>
  <span class="insight-label">
    {{ label }}
    <Tag
      v-if="assessed"
      severity="secondary"
      :value="$t('components.callInsights.assessedMarking')"
      class="insight-assessed-tag"
    />
  </span>
</template>

<script>
import CallInsights from "@/utils/CallInsights";

/**
 * One value of one dimension (`resolution`, `message`, `booked`, `transferred`), under the
 * dashboard's value table (`CallInsights.insightRows`): `resolution` and `message` carry the
 * "assessed by the assistant" tag, wherever they are shown (a chart's legend, a report's
 * dimensions); `booked` and `transferred` show with no marking (the server recorded them).
 */
export default {
  props: {
    dimension: { type: String, required: true },
    value: { type: String, required: true },
  },
  computed: {
    label() {
      return this.$t("components.callInsights." + this.dimension + "." + this.value);
    },
    assessed() {
      return CallInsights.isAssessed(this.dimension);
    },
  },
};
</script>

<style lang="less" scoped>
.insight-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.insight-assessed-tag {
  font-size: 10px;
  font-weight: 600;
}
</style>
