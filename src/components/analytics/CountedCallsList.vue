<template>
  <div class="counted-calls-list">
    <!-- another owner's calls come as StarChat's reduced list (no caller name, no summary: a privacy decision of the
         classification-feedback brief, decision 14); a call opened is read in full, and that read is recorded -->
    <p v-if="reduced" class="counted-calls-note" role="note">{{ $t("components.callInsights.feedback.readOnly.note") }}</p>
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
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import Classifications from "@/utils/Classifications";
import ConversationApi from "@/utils/Conversation";
import PagedTable from "@/components/analytics/PagedTable.vue";

/**
 * The calls a count counts (brief docs/briefs/2026-10-31-analytics-ux.md, O2), from the count's link
 * (`Classifications.countLink`): the same search the conversations list sends on opening it (`readCountAddress` and
 * `composeSearch`, the one composition both use), archived calls included (`counted`), and for a report's count how many
 * calls it leaves out for the reader (`leftOut`). Each row opens the call (`open-call`); "Open in Conversations" goes to
 * the same list with the page's own tools. Drawn inside the counted-calls panel and inside a signal's businesses panel;
 * it reads the search when drawn and when the link changes.
 */
export default {
  components: { PagedTable },
  props: {
    // the count's link: `{path: "/conversations", query}`
    link: { type: Object, default: null },
    label: { type: String, default: "" },
    user: { type: Object, required: true },
  },
  emits: ["open-call"],
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
    // StarChat's reduced row carries no subject, body, caller name or summary (customer conversation guide,
    // "reduced"); the owner's own row always carries a subject
    reduced() {
      return this.table.items.length > 0 && this.table.items.every((row) => !("subject" in row));
    },
    columns() {
      const t = (k) => this.$t("components.callInsights.countedCalls.columns." + k);
      return [
        { key: "when", label: t("when") },
        { key: "caller", label: t("caller") },
        { key: "summary", label: this.reduced ? this.$t("components.callInsights.dimensions.resolution") : t("summary") },
        { key: "open", label: t("open") },
      ];
    },
  },
  watch: {
    link() {
      this.load();
    },
  },
  mounted() {
    this.load();
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
      // a reduced row names no caller: its masked number is what there is
      return caller.name || row.contactNumber || this.$t("components.conversations.unknownContact");
    },
    // the call's summary; on a reduced row, which has none, the call's own judgements
    summary(row) {
      const d = row.details || {};
      if (d.summary) return d.summary;
      const parts = [];
      if (CallInsights.RESOLUTION_KEYS.includes(d.resolution)) parts.push(this.$t("components.callInsights.resolution." + d.resolution));
      if (CallInsights.MESSAGE_KEYS.includes(d.message)) parts.push(this.$t("components.callInsights.message." + d.message));
      return parts.join(" · ");
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

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
</style>
