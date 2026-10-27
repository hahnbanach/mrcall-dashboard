<template>
  <div class="category-requests">
    <PagedTable
      :state="page"
      :columns="columns"
      :row-key="(r) => r.requestId"
      :row-class="(r) => (selection.has(r.requestId) ? 'category-request-selected' : null)"
      :row-attrs="rowAttrs"
      :caption="$t('components.callInsights.feedback.categories.requestsOf', { category: label })"
      :empty-text="$t('components.callInsights.feedback.categories.noRequests')"
    >
      <template #cell-select="{ row: r }">
        <input
          v-if="selection.showChecks"
          type="checkbox"
          class="select-check"
          :checked="selection.has(r.requestId)"
          :aria-label="$t('components.callInsights.feedback.bulk.selectRequest', { text: r.text })"
          @change="selection.toggle(r.requestId, $event.target.checked)"
        />
      </template>
      <template #cell-text="{ row: r }"><span class="category-request-text">{{ r.text }}</span></template>
      <template #cell-business="{ row: r }">{{ businessName(r) }}</template>
      <template #cell-outcome="{ row: r }">
        <JudgementChip
          :field-label="$t('components.callInsights.feedback.fields.outcome')"
          :value-label="outcomeLabel(r.outcome)"
          :state-label="r.outcome !== r.outcomeModel ? $t('components.callInsights.feedback.state.corrected') : null"
          :kind="r.outcome !== r.outcomeModel ? 'corrected' : 'model'"
          :entries="entries('outcome', r.outcome)"
          :busy="busyRow === r.requestId"
          @choose="one(r, 'outcome', r.outcome, $event)"
        />
      </template>
      <template #cell-category="{ row: r }">
        <JudgementChip
          v-if="categories"
          :field-label="$t('components.callInsights.feedback.fields.category')"
          :value-label="categoryLabel(r.category)"
          :state-label="r.category !== r.categoryModel ? $t('components.callInsights.feedback.state.corrected') : null"
          :kind="r.category !== r.categoryModel ? 'corrected' : 'model'"
          :entries="entries('category', r.category)"
          :busy="busyRow === r.requestId"
          @choose="one(r, 'category', r.category, $event)"
        />
      </template>
      <template #cell-call="{ row: r }">
        <router-link :to="callLink(r)" :aria-label="$t('components.callInsights.feedback.categories.openCall', { text: r.text })">{{ $t("components.callInsights.feedback.categories.call") }}</router-link>
      </template>
    </PagedTable>
    <p v-if="note" class="category-requests-note" role="status">{{ note }}</p>

    <!-- The selected requests corrected in one gesture, one undo (StarChat's brief, decision 9, "In lists") -->
    <BulkBar
      v-if="selection.size > 0"
      :label="$t('components.callInsights.feedback.bulk.labelRequests')"
      :count="selection.size"
      :narrow="selection.narrow"
    >
      <JudgementChip
        :field-label="$t('components.callInsights.feedback.bulk.changeOutcome')"
        :value-label="$t('components.callInsights.feedback.bulk.changeOutcome')"
        :name="$t('components.callInsights.feedback.bulk.changeOutcome')"
        :entries="valueEntries('outcome')"
        :busy="bulkBusy"
        :upward="true"
        @choose="bulk('outcome', 'wrong_value', $event.value)"
      />
      <JudgementChip
        v-if="categories"
        :field-label="$t('components.callInsights.feedback.bulk.move')"
        :value-label="$t('components.callInsights.feedback.bulk.move')"
        :name="$t('components.callInsights.feedback.bulk.move')"
        :entries="valueEntries('category')"
        :busy="bulkBusy"
        :upward="true"
        @choose="bulk('category', 'wrong_value', $event.value)"
      />
      <Button v-if="categories" type="button" size="small" outlined :label="$t('components.callInsights.feedback.bulk.confirm')" :disabled="bulkBusy" @click="bulk('category', 'right')" />
      <Button type="button" size="small" outlined :label="$t('components.callInsights.feedback.bulk.spam')" :disabled="bulkBusy" @click="spam" />
      <Button type="button" size="small" text :label="$t('components.callInsights.feedback.bulk.clear')" @click="selection.clear()" />
    </BulkBar>
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import Classifications from "@/utils/Classifications";
import UndoGesture from "@/utils/UndoGesture";
import { createSelection } from "@/utils/Selection";
import PagedTable from "@/components/analytics/PagedTable.vue";
import JudgementChip from "@/components/feedback/JudgementChip.vue";
import BulkBar from "@/components/feedback/BulkBar.vue";
import { judgementLabels } from "@/components/feedback/labels";
import { isSessionEnded } from "@/firebase/session";

/**
 * A category's requests (brief docs/briefs/2026-10-27-classification-feedback.md, scope 5; StarChat's brief, decisions
 * 9 and 13; `POST insights/categories/{category}/requests`): over the window of "Richieste dei chiamanti", the requests
 * the assistant did not fulfil by itself (or all, or one outcome), newest first, paged, each with its words, its
 * business, a link to its call and its outcome and category as chips. Selected requests change outcome, move to another
 * category or are confirmed in one gesture, with one undo. A reader who is not an admin proposes categories (decision
 * 6): its gesture says how many were applied and how many proposed. Without StarChat's category list (the brief's gap
 * table) no category chip and no move are drawn. Each row carries its call's resolution (StarChat a012b6926), which the
 * spam gesture sends as the value read.
 * Nor do they carry a history: a chip says "Corretta" when the effective value differs from the model's, which is all
 * a row knows; the call's own chips (its link) carry the history, the proposals and the restore.
 */
export default {
  components: { PagedTable, JudgementChip, BulkBar },
  props: {
    category: { type: String, default: null },
    label: { type: String, required: true },
    // the window of the view: {timestampGte, timestampLte, plan?}
    body: { type: Object, default: null },
    outcome: { type: String, default: null },
    all: { type: Boolean, default: false },
    categories: { type: Array, default: null },
  },
  data() {
    const user = () => this.$store.state.user;
    return {
      page: CallInsights.serverPage(({ offset, size, asOf }) =>
        Classifications.categoryRequests(user(), this.category, this.body || {}, {
          outcome: this.outcome || undefined, all: this.all && !this.outcome, from: offset, size, asOf,
        })),
      selection: createSelection(),
      busyRow: null,
      bulkBusy: false,
      note: null,
    };
  },
  computed: {
    columns() {
      const t = (k) => this.$t("components.callInsights.feedback.categories.columns." + k);
      return [
        { key: "select", label: t("select"), class: "category-request-select" },
        { key: "text", label: t("text") },
        { key: "business", label: t("business") },
        { key: "outcome", label: t("outcome") },
        ...(this.categories ? [{ key: "category", label: t("category") }] : []),
        { key: "call", label: t("call") },
      ];
    },
  },
  watch: {
    // a selected request no longer on the page shown is no longer selected (another page, a reload)
    "page.items"(items) {
      const shown = new Set((items || []).map((r) => r.requestId));
      for (const key of this.selection.selected) if (!shown.has(key)) this.selection.toggle(key, false);
    },
    category() { this.reload(); },
    outcome() { this.reload(); },
    all() { this.reload(); },
    body: { deep: true, handler() { this.reload(); } },
  },
  mounted() {
    this.page.refresh();
  },
  beforeUnmount() {
    this.selection.dispose();
  },
  methods: {
    reload() {
      this.selection.clear();
      this.page.refresh();
    },
    rowAttrs(r) {
      return {
        onPointerdown: (e) => this.selection.pressStart(r.requestId, e),
        onPointerup: () => this.selection.pressEnd(),
        onPointerleave: () => this.selection.pressEnd(),
        onPointercancel: () => this.selection.pressEnd(),
      };
    },
    businessName(r) {
      return CallInsights.businessLabel(r.name, r.businessId);
    },
    outcomeLabel(v) {
      return judgementLabels(this.$t, this.categories, this.$i18n.locale).value("outcome", v);
    },
    categoryLabel(v) {
      return judgementLabels(this.$t, this.categories, this.$i18n.locale).value("category", v);
    },
    valueEntries(field) {
      return Classifications.valuesOf(field, this.categories).map((value) => ({
        key: value, value, kind: "value", label: field === "outcome" ? this.outcomeLabel(value) : this.categoryLabel(value),
      }));
    },
    entries(field, current) {
      const raw = Classifications.menuEntries(field, { value: current, kind: "model", canRestore: false }, this.categories)
        .filter((e) => e.kind !== "history");
      let first = true;
      return raw.map((e) => {
        const action = e.kind !== "value";
        const out = {
          ...e, key: e.kind + ":" + (e.value || ""), action, firstAction: action && first,
          label: action ? this.$t("components.callInsights.feedback.menu." + e.kind)
            : (field === "outcome" ? this.outcomeLabel(e.value) : this.categoryLabel(e.value)),
        };
        if (action) first = false;
        return out;
      });
    },
    callLink(r) {
      return { path: "/conversations", query: { id: r.businessId, conversation: r.conversationId } };
    },
    ask(r, field, signal, valueTo) {
      return Classifications.ask({
        conversationId: r.conversationId, requestId: r.requestId, field, signal,
        valueFrom: r[field] == null ? null : r[field], valueTo: signal === "wrong_value" ? valueTo : undefined,
      });
    },
    // A chip of one row: one signal, one gesture.
    async one(r, field, current, entry) {
      if (entry.kind === "value" && entry.value === current) return;
      const signal = entry.kind === "value" ? "wrong_value" : entry.kind;
      this.busyRow = r.requestId;
      await this.send([this.ask(r, field, signal, entry.value)], false);
      this.busyRow = null;
    },
    // The selected rows: one gesture over all of them. A row already at the value asked, or with no value to confirm,
    // is left out.
    async bulk(field, signal, valueTo) {
      const rows = this.page.items.filter((r) => this.selection.has(r.requestId));
      const asks = rows
        .filter((r) => !(signal === "wrong_value" && r[field] === valueTo) && !(signal === "right" && r[field] == null))
        .map((r) => this.ask(r, field, signal, valueTo));
      if (asks.length === 0) return;
      this.bulkBusy = true;
      await this.send(asks, true);
      this.bulkBusy = false;
    },
    // The selected requests' calls marked spam: one signal per call, on its resolution as the row reads it
    // (`resolution`, StarChat a012b6926); a call already spam or without a judged resolution is left out.
    async spam() {
      const seen = new Set();
      const asks = [];
      for (const r of this.page.items) {
        if (!this.selection.has(r.requestId) || seen.has(r.conversationId)) continue;
        seen.add(r.conversationId);
        if (!r.resolution || r.resolution === "spam_wrong_number") continue;
        asks.push(Classifications.ask({ conversationId: r.conversationId, field: "resolution", signal: "wrong_value", valueFrom: r.resolution, valueTo: "spam_wrong_number" }));
      }
      if (asks.length === 0) return;
      this.bulkBusy = true;
      await this.send(asks, true);
      this.bulkBusy = false;
    },
    async send(asks, many) {
      const user = this.$store.state.user;
      const gestureId = Classifications.newGestureId();
      this.note = null;
      try {
        const answer = many
          ? await Classifications.bulk(user, asks, gestureId)
          : await Classifications.signal(user, asks[0], gestureId);
        UndoGesture.record(gestureId, asks.map((a) => a.conversationId), () => this.page.retry(), null,
          many ? answer && answer.calls : (answer && answer.call ? [answer.call] : []));
        const proposed = many ? answer.proposed || 0 : (answer.status === "proposed" ? 1 : 0);
        if (proposed > 0) this.note = this.$t("components.callInsights.feedback.bulk.proposed", { n: proposed }, proposed);
        if (many) this.selection.clear();
      } catch (error) {
        if (isSessionEnded(error)) return;
        const refusal = CallInsights.refusalOf(error);
        this.note = this.$t(refusal && refusal.code === "stale_value" ? "components.callInsights.feedback.stale" : "components.callInsights.feedback.failed");
      }
      this.page.retry();
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.category-requests {
  margin: 8px 0;
}

.category-request-text {
  font-size: 14px;
}

.select-check {
  width: 20px;
  height: 20px;
  accent-color: @mrcall_blue;
}

.category-requests-note {
  font-size: 13px;
  color: @mrcall_grey_text;
}

</style>
