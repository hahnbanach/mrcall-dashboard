<template>
  <Drawer :visible="visible" position="right" class="counted-calls-panel" :header="label"
          @update:visible="v => $emit('update:visible', v)" @show="load" @after-hide="$emit('after-hide')">
    <!-- a count not known (a report's group whose analytics were not read): no number is printed, the list says its own -->
    <p v-if="count !== null" class="counted-calls-count">{{ $t("components.callInsights.countedCalls.count", { n: count }, count) }}</p>
    <p v-if="leftOut > 0" class="counted-calls-note" role="status">{{ $t("components.callInsights.feedback.filters.leftOut", { n: leftOut }, leftOut) }}</p>
    <PagedTable
      :state="table"
      :columns="columns"
      :row-key="(row) => row.id"
      :caption="$t('components.callInsights.countedCalls.caption', { label })"
      :empty-text="$t('components.callInsights.countedCalls.empty')"
    >
      <template #cell-when="{ row }">{{ when(row) }}</template>
      <template #cell-caller="{ row }">{{ callerName(row) }}</template>
      <template #cell-summary="{ row }"><span class="counted-calls-summary">{{ summary(row) }}</span></template>
      <template #cell-open="{ row }">
        <Button type="button" size="small" outlined
                :label="$t('components.callInsights.countedCalls.open')"
                :aria-label="$t('components.callInsights.countedCalls.openOf', { name: callerName(row), when: when(row) })"
                @click="$emit('open-call', businessId, row.id, $event.currentTarget)" />
      </template>
    </PagedTable>
    <router-link v-if="link" :to="link" class="counted-calls-conversations">
      {{ $t("components.callInsights.countedCalls.openInConversations") }}
    </router-link>
  </Drawer>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import Classifications from "@/utils/Classifications";
import ConversationApi from "@/utils/Conversation";
import PagedTable from "@/components/analytics/PagedTable.vue";

/**
 * The calls a count counts, over the page that shows the count (brief docs/briefs/2026-10-31-analytics-ux.md, O2):
 * from the count's link (`Classifications.countLink`), the same search the conversations list sends on opening it
 * (`readCountAddress` and `composeSearch`, the one composition both use), archived calls included (`counted`), and for
 * a report's count how many calls it leaves out for the reader (`leftOut`, a query parameter). It states the count it
 * was opened from; each row opens the call in the page's dialog; "Open in Conversations" goes to the same list with the
 * page's own tools. Opening the panel reads the search only; a call is read when the person opens it.
 */
export default {
  components: { PagedTable },
  props: {
    visible: { type: Boolean, default: false },
    // the count's link: `{path: "/conversations", query}`
    link: { type: Object, default: null },
    label: { type: String, default: "" },
    // null when the count is not known: the panel then states none (the pager still says how many it found)
    count: { type: Number, default: null },
    user: { type: Object, required: true },
  },
  emits: ["update:visible", "open-call", "after-hide"],
  data() {
    return {
      leftOut: 0,
      table: CallInsights.serverPage(({ offset, size }) => this.fetchPage(offset, size)),
    };
  },
  computed: {
    businessId() {
      return this.link && this.link.query ? this.link.query.id : null;
    },
    columns() {
      const t = (k) => this.$t("components.callInsights.countedCalls.columns." + k);
      return [
        { key: "when", label: t("when") },
        { key: "caller", label: t("caller") },
        { key: "summary", label: t("summary") },
        { key: "open", label: t("open") },
      ];
    },
  },
  methods: {
    load() {
      this.leftOut = 0;
      this.table.refresh();
    },
    fetchPage(offset, size) {
      if (!this.link || !this.businessId) return Promise.resolve({ items: [], total: 0 });
      const read = Classifications.readCountAddress(this.link.query);
      const body = Classifications.composeSearch({ businessId: this.businessId, ...read });
      return ConversationApi.page(this.user, body, { from: offset, size, querySuffix: Classifications.searchQuery(this.link.query) })
        .then((page) => {
          this.leftOut = page.leftOut;
          return page;
        });
    },
    when(row) {
      return row.startTimestamp ? new Date(row.startTimestamp).toLocaleString(this.$i18n.locale, { dateStyle: "medium", timeStyle: "short" }) : "";
    },
    callerName(row) {
      const caller = CallInsights.callerOf(row);
      if (caller.web) return this.$t("components.callInsights.callers.web");
      return caller.name || this.$t("components.conversations.unknownContact");
    },
    summary(row) {
      return (row.details && row.details.summary) || "";
    },
  },
};
</script>

<style lang="less">
@import "../../assets/style/colors";

// not scoped: PrimeVue teleports the drawer to the body, outside this component's root
.counted-calls-panel.p-drawer {
  width: min(720px, 100vw);

  .counted-calls-count {
    margin: 0 0 8px 0;
    font-weight: 600;
    color: @mrcall_dark_grey_text;
  }

  .counted-calls-note {
    margin: 0 0 8px 0;
    color: @mrcall_grey_text;
    font-size: 14px;
  }

  .counted-calls-summary {
    color: @mrcall_grey_text;
    font-size: 14px;
  }

  .counted-calls-conversations {
    display: inline-block;
    margin-top: 12px;
    color: @mrcall_blue;
    font-weight: 600;
  }
}
</style>
