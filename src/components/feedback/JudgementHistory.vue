<template>
  <div class="judgement-history">
    <ul v-if="entries.length" class="judgement-history-list" :aria-label="$t('components.callInsights.feedback.history.title', { field: fieldLabel })">
      <li v-for="h in entries" :key="h.feedbackId">
        <span>{{ line(h) }}</span>
        <span class="judgement-history-status"> · {{ $t("components.callInsights.feedback.history.status." + h.status) }}</span>
      </li>
    </ul>
    <p v-else class="judgement-history-empty">{{ $t("components.callInsights.feedback.history.empty") }}</p>
  </div>
</template>

<script>
/**
 * "Cronologia" under a chip (StarChat's brief, decision 9): each change of one judgement, newest first, from, to, who
 * (a name and a role as StarChat answers them, never a uid or an e-mail), when, and where it stands.
 */
export default {
  props: {
    fieldLabel: { type: String, required: true },
    entries: { type: Array, default: () => [] },
    labelOf: { type: Function, required: true },
  },
  methods: {
    line(h) {
      const who = h.actorName || this.$t("components.callInsights.feedback.who." + (h.actorRole || "unknown"));
      const when = h.createdAt ? new Date(h.createdAt).toLocaleString(this.$i18n.locale, { dateStyle: "medium", timeStyle: "short" }) : "";
      const from = this.labelOf(h.valueFrom);
      if (h.signal === "right") return this.$t("components.callInsights.feedback.history.right", { from, who, when });
      if (h.signal === "wrong") return this.$t("components.callInsights.feedback.history.wrong", { from, who, when });
      return this.$t("components.callInsights.feedback.history.entry", { from, to: this.labelOf(h.valueTo), who, when });
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.judgement-history-list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
  color: @mrcall_dark_grey_text;
}

.judgement-history-status,
.judgement-history-empty {
  color: @mrcall_grey_text2;
}

.judgement-history-empty {
  margin: 8px 0 0;
  font-size: 13px;
}
</style>
