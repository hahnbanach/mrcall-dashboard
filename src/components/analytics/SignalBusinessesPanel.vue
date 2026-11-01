<template>
  <Drawer :visible="visible" position="right" class="signal-panel" :header="label"
          @update:visible="v => $emit('update:visible', v)" @show="start" @after-hide="$emit('after-hide')">
    <template v-if="!chosen">
      <p v-if="count !== null" class="signal-panel-count">{{ $t("components.callInsights.signalPanel.count", { n: count }, count) }}</p>
      <p class="signal-panel-help">{{ $t("components.callInsights.signalPanel.help") }}</p>
      <PagedTable
        :state="table"
        :columns="columns"
        :row-key="(b) => b.businessId"
        :caption="$t('components.callInsights.signalPanel.caption', { label })"
        :empty-text="$t('components.callInsights.signalPanel.empty')"
      >
        <template #cell-name="{ row }">{{ nameOf(row) }}</template>
        <template #cell-share="{ row }">{{ shareText(row) }}</template>
        <template #cell-open="{ row }">
          <Button type="button" size="small" outlined
                  :data-business="row.businessId"
                  :label="$t('components.callInsights.signalPanel.open')"
                  :aria-label="$t('components.callInsights.signalPanel.openOf', { name: nameOf(row), label })"
                  @click="choose(row)" />
        </template>
      </PagedTable>
    </template>
    <template v-else>
      <Button ref="back" type="button" text size="small" icon="pi pi-arrow-left" class="signal-panel-back"
              :label="$t('components.callInsights.signalPanel.back')" @click="back" />
      <h3 class="signal-panel-business">{{ nameOf(chosen) }}</h3>
      <p class="signal-panel-count">{{ shareText(chosen) }}</p>
      <CountedCallsList :link="chosenLink" :label="label + ' · ' + nameOf(chosen)" :user="user"
                        @open-call="(...a) => $emit('open-call', ...a)" />
    </template>
  </Drawer>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import Classifications from "@/utils/Classifications";
import CountedCallsList from "@/components/analytics/CountedCallsList.vue";
import PagedTable from "@/components/analytics/PagedTable.vue";

/**
 * Where a quality count happened, on a page over several businesses (brief docs/briefs/2026-10-31-analytics-ux.md, O5):
 * the businesses with that signal at least once, highest share first (StarChat's analytics guide §9, `sort` the
 * signal's key and `present=true`), each with its count over its base; choosing one shows that business's calls of the
 * signal in the same panel (`CountedCallsList` over `Classifications.countLink`, the page's window), and "Back" returns
 * to the businesses with the focus on the one left. One drawer, so Escape always closes what is on top.
 */
export default {
  components: { CountedCallsList, PagedTable },
  props: {
    visible: { type: Boolean, default: false },
    // `CallInsights.qualitySignal(kind, key)`
    signal: { type: Object, default: null },
    label: { type: String, default: "" },
    count: { type: Number, default: null },
    // the page's analytics body: its period and scope
    body: { type: Object, default: null },
    user: { type: Object, required: true },
  },
  emits: ["update:visible", "open-call", "after-hide"],
  data() {
    return {
      chosen: null,
      table: CallInsights.serverPage(
        ({ offset, size }) => this.signal
          ? CallInsights.assistants(this.user, this.body || {}, { sort: this.signal.sort, direction: "desc", present: true, from: offset, size })
          : Promise.resolve(null),
        { read: (answer) => CallInsights.pageOf(answer, "businesses") },
      ),
    };
  },
  computed: {
    columns() {
      const t = (k) => this.$t("components.callInsights.signalPanel.columns." + k);
      return [
        { key: "name", label: t("business") },
        { key: "share", label: t("share") },
        { key: "open", label: t("open") },
      ];
    },
    chosenLink() {
      if (!this.chosen || !this.signal) return null;
      const b = this.body || {};
      return Classifications.countLink(this.chosen.businessId, { from: b.timestampGte, to: b.timestampLte }, this.signal.kind, this.signal.key);
    },
  },
  methods: {
    start() {
      this.chosen = null;
      this.table.refresh();
    },
    nameOf(row) {
      return CallInsights.businessLabel(row.businessName, row.businessId);
    },
    shareText(row) {
      const s = CallInsights.signalShare(row, this.signal);
      return this.$t("components.callInsights.signalPanel.share", { pct: s.percent, count: s.count, base: s.base });
    },
    choose(row) {
      this.chosen = row;
      this.$nextTick(() => {
        const back = this.$refs.back;
        const el = back && (back.$el || back);
        if (el && el.focus) el.focus();
      });
    },
    back() {
      const id = this.chosen && this.chosen.businessId;
      this.chosen = null;
      this.$nextTick(() => {
        const el = id && document.querySelector('.signal-panel [data-business="' + CSS.escape(id) + '"]');
        if (el) el.focus();
      });
    },
  },
};
</script>

<style lang="less">
@import "../../assets/style/colors";

// not scoped: PrimeVue teleports the drawer to the body, outside this component's root
.signal-panel.p-drawer {
  width: min(720px, 100vw);

  .signal-panel-count {
    margin: 0 0 8px 0;
    font-weight: 600;
    color: @mrcall_dark_grey_text;
  }

  .signal-panel-help {
    margin: 0 0 12px 0;
    color: @mrcall_grey_text;
    font-size: 14px;
  }

  .signal-panel-back {
    margin: 0 0 8px -8px;
  }

  .signal-panel-business {
    margin: 0 0 4px 0;
    font-size: 18px;
    color: @mrcall_dark_grey_text;
  }
}
</style>
