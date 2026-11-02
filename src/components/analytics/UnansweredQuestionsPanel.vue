<template>
  <Drawer :visible="visible" position="right" class="questions-panel" :header="label"
          @update:visible="v => $emit('update:visible', v)" @show="table.refresh()" @after-hide="$emit('after-hide')">
    <p v-if="answer" class="questions-panel-count">
      {{ $t("components.callInsights.questionsPanel.count", { n: answer.total, calls: $t("components.callInsights.questionsPanel.calls", { n: answer.calls }, answer.calls) }, answer.total) }}
    </p>
    <p class="questions-panel-help">{{ $t("components.callInsights.questionsPanel.help") }}</p>
    <PagedTable
      :state="table"
      :columns="columns"
      :row-key="(q) => q.conversationId + '\u0000' + q.question"
      :caption="label"
      :empty-text="$t('components.callInsights.questionsPanel.empty')"
    >
      <template #cell-question="{ row }">
        <span class="questions-panel-question">{{ row.question }}</span>
        <span v-if="row.suggestion" class="questions-panel-suggestion">{{ $t("components.callInsights.questionsPanel.suggestion", { text: row.suggestion }) }}</span>
      </template>
      <template #cell-business="{ row }">{{ nameOf(row) }}</template>
      <template #cell-when="{ row }">{{ when(row) }}</template>
      <template #cell-open="{ row }">
        <Button type="button" size="small" outlined
                :label="$t('components.callInsights.questionsPanel.open')"
                :aria-label="$t('components.callInsights.questionsPanel.openOf', { text: row.question })"
                @click="$emit('open-call', row.businessId, row.conversationId, $event.currentTarget)" />
      </template>
    </PagedTable>
  </Drawer>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import PagedTable from "@/components/analytics/PagedTable.vue";

/**
 * The questions callers asked that the assistant could not answer, for one gap reason (brief
 * docs/briefs/2026-10-31-analytics-ux.md, O5; StarChat's analytics guide §14): over the page's period and scope, newest
 * call first, each with what StarChat suggests giving the assistant, its business on a page over several businesses,
 * and the call, opened in the page's dialog. The first page's `asOf` holds the next pages to the same calls.
 */
export default {
  components: { PagedTable },
  props: {
    visible: { type: Boolean, default: false },
    gap: { type: String, default: null },
    label: { type: String, default: "" },
    // the page's analytics body: its period and scope
    body: { type: Object, default: null },
    // a page over several businesses names each question's business
    showBusiness: { type: Boolean, default: false },
    user: { type: Object, required: true },
  },
  emits: ["update:visible", "open-call", "after-hide"],
  data() {
    return {
      table: CallInsights.serverPage(({ offset, size, asOf }) => this.gap
        ? CallInsights.unanswered(this.user, this.body || {}, { gap: this.gap, from: offset, size, asOf })
        : Promise.resolve(null)),
    };
  },
  computed: {
    answer() {
      const a = this.table.answer;
      return a && typeof a.total === "number" && typeof a.calls === "number" ? a : null;
    },
    columns() {
      const t = (k) => this.$t("components.callInsights.questionsPanel.columns." + k);
      return [
        { key: "question", label: t("question") },
        ...(this.showBusiness ? [{ key: "business", label: t("business") }] : []),
        { key: "when", label: t("when") },
        { key: "open", label: t("open") },
      ];
    },
  },
  methods: {
    nameOf(row) {
      return CallInsights.businessLabel(row.businessName, row.businessId);
    },
    when(row) {
      return row.startTimestamp ? new Date(row.startTimestamp).toLocaleString(this.$i18n.locale, { dateStyle: "medium", timeStyle: "short" }) : "";
    },
  },
};
</script>

<style lang="less">
@import "../../assets/style/colors";

// not scoped: PrimeVue teleports the drawer to the body, outside this component's root. Its own `.p-drawer-right .p-drawer`
// (width 20rem) is injected at runtime, after the production stylesheet, so an equally specific rule here loses there
// (measured on test, 2026-11-01, while it won on the dev server): the mask class makes this one more specific.
.p-drawer-right .questions-panel.p-drawer {
  width: min(760px, 100vw);

  .questions-panel-count {
    margin: 0 0 8px 0;
    font-weight: 600;
    color: @mrcall_dark_grey_text;
  }

  .questions-panel-help {
    margin: 0 0 12px 0;
    color: @mrcall_grey_text;
    font-size: 14px;
  }

  .questions-panel-question {
    display: block;
    color: @mrcall_dark_grey_text;
  }

  .questions-panel-suggestion {
    display: block;
    margin-top: 2px;
    color: @mrcall_grey_text;
    font-size: 14px;
  }
}
</style>
