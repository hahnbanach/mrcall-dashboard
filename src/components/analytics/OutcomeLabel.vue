<template>
  <span class="outcome-label">
    {{ label }}
    <Tag
      v-if="assessed"
      severity="secondary"
      :value="$t('components.callInsights.assessedMarking')"
      class="outcome-assessed-tag"
    />
  </span>
</template>

<script>
import CallInsights from "@/utils/CallInsights";

/**
 * One outcome, under the dashboard's one outcome rule (`CallInsights.outcomeKind`): `booked` and
 * `transferred` show with no marking (the server recorded them); every other outcome carries the
 * "assessed by the assistant" tag, wherever an outcome is shown (the panel, the list's filter, a
 * chart's legend, a report's per-topic outcomes, the assistants table).
 */
export default {
  props: {
    outcomeKey: { type: String, required: true },
  },
  computed: {
    label() {
      return this.$t("components.callInsights.outcomes." + this.outcomeKey);
    },
    assessed() {
      return CallInsights.outcomeKind(this.outcomeKey) === "assessed";
    },
  },
};
</script>

<style lang="less" scoped>
.outcome-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.outcome-assessed-tag {
  font-size: 10px;
  font-weight: 600;
}
</style>
