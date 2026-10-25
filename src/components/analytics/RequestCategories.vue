<template>
  <section v-if="status !== 'absent'" class="analytics-section call-insights-section requests-section" aria-labelledby="requests-title">
    <h3 id="requests-title" class="section-title">{{ $t("components.callInsights.requests.title") }}</h3>
    <p class="requests-purpose">{{ $t("components.callInsights.requests.purpose") }}</p>
    <div class="requests-controls">
      <label class="requests-control">
        <span>{{ $t("components.callInsights.requests.sortLabel") }}</span>
        <Dropdown
          v-model="sort"
          :options="sortOptions"
          optionLabel="label"
          optionValue="value"
          :ariaLabel="$t('components.callInsights.requests.sortLabel')"
        />
      </label>
      <label v-if="isAdmin" class="requests-control requests-toggle">
        <input v-model="includeDismissed" type="checkbox" />
        <span>{{ $t("components.callInsights.requests.showDismissed") }}</span>
      </label>
      <p class="requests-score-help">{{ $t("components.callInsights.requests.scoreHelp") }}</p>
    </div>

    <InsightsState
      :status="status"
      :empty="status === 'ok' && rows.length === 0"
      :empty-text="$t('components.callInsights.requests.none')"
      :keep-content="status === 'loading' && rows.length > 0"
      @retry="load"
    >
      <p class="requests-window">{{ windowText }}</p>
      <div class="requests-scroll">
        <table class="requests-table">
          <caption class="visually-hidden">{{ $t("components.callInsights.requests.title") }}</caption>
          <thead>
            <tr>
              <th scope="col">{{ $t("components.callInsights.requests.columns.category") }}</th>
              <th scope="col" :aria-sort="sort === 'businesses' ? 'descending' : 'none'">{{ $t("components.callInsights.requests.columns.businesses") }}</th>
              <th scope="col">{{ $t("components.callInsights.requests.columns.trend") }}</th>
              <th scope="col">{{ $t("components.callInsights.requests.columns.freshness") }}</th>
              <th scope="col">{{ $t("components.callInsights.requests.nextAction") }}</th>
              <th scope="col">{{ $t("components.callInsights.requests.examples") }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in rows" :key="row.category">
              <tr :class="{ 'requests-dismissed': row.dismissal && !row.dismissal.reopened }">
                <td :data-label="$t('components.callInsights.requests.columns.category')">
                  <span class="requests-category">{{ row.label }}</span>
                  <span class="requests-status" :class="'requests-status-' + row.status">{{ $t("components.callInsights.requests.status." + row.status) }}</span>
                  <span v-if="row.dismissal && row.dismissal.reopened" class="requests-reopened">
                    {{ $t("components.callInsights.requests.reopened", { n: row.dismissal.reopened.newBusinesses, date: day(row.dismissal.reopened.since) }) }}
                  </span>
                  <span v-else-if="row.dismissal" class="requests-reopened">
                    {{ $t("components.callInsights.requests.dismissedAs", { reason: $t("components.callInsights.requests.reason." + row.dismissal.reason), date: day(row.dismissal.at) }) }}
                  </span>
                  <span class="requests-row-actions">
                    <Button
                      type="button" text size="small"
                      :icon="expanded === row.category ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
                      :label="$t('components.callInsights.requests.whoAsked')"
                      :aria-expanded="expanded === row.category ? 'true' : 'false'"
                      :aria-controls="'requests-businesses-' + row.category"
                      @click="toggle(row)"
                    />
                    <template v-if="isAdmin">
                      <Button
                        v-if="!row.dismissal"
                        type="button" text size="small" severity="secondary"
                        :label="$t('components.callInsights.requests.dismiss')"
                        :aria-label="$t('components.callInsights.requests.dismissOf', { category: row.label })"
                        @click="askDismiss(row)"
                      />
                      <Button
                        v-else
                        type="button" text size="small" severity="secondary"
                        :label="$t('components.callInsights.requests.restore')"
                        :aria-label="$t('components.callInsights.requests.restoreOf', { category: row.label })"
                        :disabled="busy"
                        @click="restore(row)"
                      />
                    </template>
                  </span>
                </td>
                <td :data-label="$t('components.callInsights.requests.columns.businesses')">
                  <span class="requests-count">{{ $t("components.callInsights.requests.businesses", { n: row.businesses }) }}</span>
                  <span class="requests-sub">{{ trendText(row) }}</span>
                  <span class="requests-sub">{{ $t("components.callInsights.requests.share", { pct: percent(row.share) }) }}</span>
                </td>
                <td :data-label="$t('components.callInsights.requests.columns.trend')">
                  <svg
                    class="requests-histogram"
                    role="img"
                    :aria-label="histogramLabel(row)"
                    :viewBox="'0 0 ' + histogramWidth(row) + ' 32'"
                    :width="histogramWidth(row)"
                    height="32"
                  >
                    <rect
                      v-for="(b, i) in row.histogram"
                      :key="b.start"
                      :x="i * 10"
                      :y="32 - barHeight(row, b)"
                      width="8"
                      :height="barHeight(row, b)"
                      rx="1"
                      class="requests-bar"
                    />
                  </svg>
                </td>
                <td :data-label="$t('components.callInsights.requests.columns.freshness')">
                  <span v-if="row.lastSeen">{{ $t("components.callInsights.requests.freshness", { date: isoDay(row.lastSeen), pct: percent(row.recentShare), bucket: $t("components.callInsights.requests.bucket." + bucketUnit(row)) }) }}</span>
                  <span v-if="row.reportDated > 0" class="requests-sub">{{ $t("components.callInsights.requests.reportDated", { n: row.reportDated }) }}</span>
                </td>
                <td :data-label="$t('components.callInsights.requests.nextAction')">{{ row.nextAction }}</td>
                <td :data-label="$t('components.callInsights.requests.examples')">
                  <ul class="requests-examples">
                    <li v-for="e in row.examples" :key="e.text + e.businessId">
                      <q>{{ e.text }}</q>
                      <router-link :to="reportLink(e.businessId, e.reportPeriodStart)" class="requests-sub">{{ businessName(e) }}</router-link>
                      <Button
                        v-if="isAdmin"
                        type="button" text size="small" severity="secondary"
                        :label="$t('components.callInsights.requests.hideExample')"
                        :aria-label="$t('components.callInsights.requests.hideExampleOf', { text: e.text })"
                        @click="hideExample(row, e)"
                      />
                    </li>
                  </ul>
                  <!-- With "Mostra archiviate", an admin finds the examples hidden from the row, and restores them -->
                  <ul v-if="isAdmin && includeDismissed && hiddenOf(row).length" class="requests-examples requests-hidden"
                      :aria-label="$t('components.callInsights.requests.hiddenExamples')">
                    <li v-for="h in hiddenOf(row)" :key="h.text">
                      <q>{{ h.text }}</q>
                      <span class="requests-sub">
                        {{ $t("components.callInsights.requests.hiddenAs", { date: day(h.at), reason: $t("components.callInsights.requests.reason." + h.reason) }) }}<template v-if="h.note"> · {{ h.note }}</template>
                      </span>
                      <Button
                        type="button" text size="small" severity="secondary"
                        :label="$t('components.callInsights.requests.restore')"
                        :aria-label="$t('components.callInsights.requests.restoreExampleOf', { text: h.text })"
                        :disabled="restoring.has(row.category + '\u0000' + h.text)"
                        @click="restoreExample(row, h)"
                      />
                    </li>
                  </ul>
                </td>
              </tr>
              <tr v-if="expanded === row.category" class="requests-expansion">
                <td colspan="6" :id="'requests-businesses-' + row.category">
                  <PagedTable
                    :state="businesses"
                    :columns="businessColumns"
                    :row-key="(b) => b.businessId"
                    :caption="$t('components.callInsights.requests.businessesOf', { category: row.label })"
                    :empty-text="$t('components.callInsights.requests.noBusinesses')"
                  >
                    <template #cell-name="{ row: b }">
                      <router-link :to="reportLink(b.businessId, b.reportPeriodStart)">{{ businessName(b) }}</router-link>
                    </template>
                    <template #cell-lastSeen="{ row: b }">{{ isoDay(b.lastSeen) }}</template>
                    <template #cell-said="{ row: b }">
                      <ul class="requests-examples"><li v-for="t in b.examples" :key="t"><q>{{ t }}</q></li></ul>
                    </template>
                  </PagedTable>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </InsightsState>

    <Dialog
      v-model:visible="dismissVisible"
      modal
      :header="dismissing && dismissing.example ? $t('components.callInsights.requests.hideExample') : $t('components.callInsights.requests.dismiss')"
      :style="{ width: '28rem' }"
      class="insights-ui"
      :breakpoints="{ '640px': '96vw' }"
    >
      <form v-if="dismissing" class="requests-dismiss-form" @submit.prevent="confirmDismiss">
        <p>{{ dismissing.example ? dismissing.example.text : dismissing.row.label }}</p>
        <fieldset class="requests-reasons">
          <legend>{{ $t("components.callInsights.requests.reasonLabel") }}</legend>
          <label v-for="r in reasons" :key="r">
            <input v-model="dismissReason" type="radio" name="dismiss-reason" :value="r" />
            <span>{{ $t("components.callInsights.requests.reason." + r) }}</span>
          </label>
        </fieldset>
        <label for="dismiss-note">{{ $t("components.callInsights.requests.note") }}</label>
        <Textarea id="dismiss-note" v-model="dismissNote" rows="2" autoResize />
        <p v-if="actionFailed" class="requests-error" role="alert">{{ $t("components.callInsights.state.actionFailed") }}</p>
        <div class="requests-dialog-actions">
          <Button type="button" text :label="$t('components.callInsights.request.cancel')" @click="dismissVisible = false" />
          <Button type="submit" :label="$t('components.callInsights.requests.confirmDismiss')" :disabled="!dismissReason || busy" :loading="busy" />
        </div>
      </form>
    </Dialog>
  </section>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import InsightsReports from "@/utils/InsightsReports";
import InsightsState from "@/components/analytics/InsightsState.vue";
import PagedTable from "@/components/analytics/PagedTable.vue";
import { isSessionEnded } from "@/firebase/session";

const REASONS = ["done", "not_relevant", "already_integrated"];

/**
 * "Richieste dei chiamanti" (docs/briefs/2026-10-24-insights-reports-ux.md in StarChat, "Caller requests across
 * businesses"): what callers ask that the assistants cannot do, one row per category, never per call or per sentence,
 * for the window of the page's filters (`POST insights/integrations?view=categories`). A row says what to do next, for
 * how many businesses (with the change against the window before and the share of businesses with a report), and how
 * urgently: its status in words, a histogram of businesses per week or month whose numbers are in its accessible name,
 * and its freshness. It opens to the businesses that asked, paged, each linked to the report that said it. An admin
 * archives a category (with a reason) or hides an example, and finds them again under "Mostra archiviate"; a category
 * comes back when new businesses ask, and says so. A reseller sees its owners' rows and no archive control. The rows
 * are at most the active categories, so the answer is not paged; the businesses of a row are.
 */
export default {
  components: { InsightsState, PagedTable },
  props: {
    // the page's window and plan: {timestampGte, timestampLte, plan?}
    body: { type: Object, default: null },
    role: { type: String, default: null },
  },
  emits: ["names", "error"],
  data() {
    const user = () => this.$store.state.user;
    return {
      status: "loading",
      answer: null,
      sort: "score",
      includeDismissed: false,
      expanded: null,
      businesses: CallInsights.serverPage(({ offset, size, asOf }) =>
        CallInsights.requestBusinesses(user(), this.expanded, this.body || {}, { from: offset, size, asOf: asOf || (this.answer && this.answer.asOf) })),
      dismissVisible: false,
      dismissing: null,
      dismissReason: null,
      dismissNote: "",
      busy: false,
      // the hidden examples being restored, `category NUL text`: a second click on one waits for the first
      restoring: new Set(),
      actionFailed: false,
      gate: CallInsights.latestOnly(),
    };
  },
  computed: {
    isAdmin() {
      return this.role === "admin";
    },
    rows() {
      return this.answer && Array.isArray(this.answer.items) ? this.answer.items : [];
    },
    reasons() {
      return REASONS;
    },
    sortOptions() {
      return [
        { value: "score", label: this.$t("components.callInsights.requests.sortScore") },
        { value: "businesses", label: this.$t("components.callInsights.requests.sortBusinesses") },
      ];
    },
    windowText() {
      const a = this.answer;
      if (!a || typeof a.from !== "number" || typeof a.to !== "number") return "";
      return this.$t("components.callInsights.requests.window", {
        period: InsightsReports.periodLabel(a.from, a.to, InsightsReports.FALLBACK_ZONE, this.$i18n.locale),
      });
    },
    businessColumns() {
      const t = (k) => this.$t("components.callInsights.requests.businessColumns." + k);
      return [
        { key: "name", label: t("name") },
        { key: "lastSeen", label: t("lastSeen") },
        { key: "said", label: t("said") },
      ];
    },
  },
  watch: {
    body: { deep: true, handler(value) { if (value) this.load(); } },
    sort() { this.load(); },
    includeDismissed() { this.load(); },
  },
  mounted() {
    if (this.body) this.load();
  },
  methods: {
    user() {
      return this.$store.state.user;
    },
    load() {
      const isCurrent = this.gate.begin();
      this.status = "loading";
      CallInsights.requestCategories(this.user(), this.body || {}, {
        includeDismissed: this.isAdmin && this.includeDismissed, sort: this.sort, language: this.$i18n.locale,
      })
        .then((answer) => {
          if (!isCurrent()) return;
          if (answer === null) { this.status = "absent"; this.answer = null; return; }
          if (answer.unavailable) { this.status = "unavailable"; this.answer = null; return; }
          this.answer = answer;
          this.status = "ok";
          const names = {};
          this.rows.forEach((r) => (r.examples || []).forEach((e) => { if (e.name) names[e.businessId] = e.name; }));
          this.$emit("names", names);
          if (this.expanded && !this.rows.some((r) => r.category === this.expanded)) this.expanded = null;
          else if (this.expanded) this.businesses.refresh();
        })
        .catch((error) => {
          if (!isCurrent() || isSessionEnded(error)) return;
          this.status = "error";
          this.$emit("error", error, "requests");
        });
    },
    toggle(row) {
      this.expanded = this.expanded === row.category ? null : row.category;
      if (this.expanded) this.businesses.refresh();
    },
    percent(fraction) {
      return Math.round((fraction || 0) * 100);
    },
    trendText(row) {
      const n = row.trend || 0;
      const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
      return this.$t("components.callInsights.requests.trend", { sign, n: Math.abs(n) });
    },
    bucketUnit(row) {
      return row.bucket === "month" ? "month" : "week";
    },
    histogramLabel(row) {
      const values = (row.histogram || []).map((b) => b.businesses).join(", ");
      return this.$t("components.callInsights.requests.histogramLabel", { bucket: this.$t("components.callInsights.requests.bucket." + this.bucketUnit(row)), values });
    },
    histogramWidth(row) {
      return Math.max(10, (row.histogram || []).length * 10);
    },
    barHeight(row, bucket) {
      const max = Math.max(1, ...(row.histogram || []).map((b) => b.businesses));
      return bucket.businesses === 0 ? 1 : Math.max(3, Math.round((bucket.businesses / max) * 30));
    },
    isoDay(iso) {
      return InsightsReports.isoDayLabel(iso, this.$i18n.locale) || iso;
    },
    day(ms) {
      return InsightsReports.dayLabel(ms, InsightsReports.FALLBACK_ZONE, this.$i18n.locale);
    },
    businessName(b) {
      return CallInsights.businessLabel(b.name, b.businessId);
    },
    reportLink(businessId, periodStart) {
      return { path: "/analytics/report", query: { id: businessId, start: String(periodStart) } };
    },
    askDismiss(row) {
      this.dismissing = { row, example: null };
      this.dismissReason = null;
      this.dismissNote = "";
      this.actionFailed = false;
      this.dismissVisible = true;
    },
    hideExample(row, example) {
      this.dismissing = { row, example };
      this.dismissReason = null;
      this.dismissNote = "";
      this.actionFailed = false;
      this.dismissVisible = true;
    },
    confirmDismiss() {
      const d = this.dismissing;
      if (!d || !this.dismissReason || this.busy) return;
      this.busy = true;
      this.actionFailed = false;
      const note = this.dismissNote.trim() || undefined;
      const action = d.example
        ? CallInsights.dismissExample(this.user(), d.row.category, { text: d.example.text, reason: this.dismissReason, note })
        : CallInsights.dismissCategory(this.user(), d.row.category, { reason: this.dismissReason, note });
      action
        .then(() => { this.dismissVisible = false; this.load(); })
        .catch((error) => { if (!isSessionEnded(error)) this.actionFailed = true; })
        .finally(() => { this.busy = false; });
    },
    hiddenOf(row) {
      return Array.isArray(row.dismissedExamples) ? row.dismissedExamples.filter((h) => h && typeof h.text === "string") : [];
    },
    restoreExample(row, hidden) {
      const key = row.category + "\u0000" + hidden.text;
      if (this.restoring.has(key)) return;
      this.restoring = new Set([...this.restoring, key]);
      CallInsights.restoreExample(this.user(), row.category, hidden.text)
        .then(() => this.load())
        .catch((error) => { if (!isSessionEnded(error)) this.$emit("error", error, "requests"); })
        .finally(() => {
          const next = new Set(this.restoring);
          next.delete(key);
          this.restoring = next;
        });
    },
    restore(row) {
      if (this.busy) return;
      this.busy = true;
      CallInsights.restoreCategory(this.user(), row.category)
        .then(() => this.load())
        .catch((error) => { if (!isSessionEnded(error)) this.$emit("error", error, "requests"); })
        .finally(() => { this.busy = false; });
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.requests-purpose, .requests-window, .requests-score-help {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: @mrcall_grey_text;
}

.requests-score-help {
  font-size: 13px;
  flex-basis: 100%;
}

.requests-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.requests-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.requests-scroll {
  overflow-x: auto;
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
}

.requests-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  color: @mrcall_dark_grey_text;

  th, td {
    text-align: left;
    vertical-align: top;
    padding: 10px 12px;
    border-bottom: 1px solid @mrcall_borders;
  }

  th {
    font-size: 12px;
    color: @mrcall_grey_text2;
    white-space: nowrap;
  }
}

.requests-dismissed td {
  background: @mrcall_light_grey_2;
}

.requests-category {
  display: block;
  font-weight: 700;
}

.requests-status {
  display: block;
  font-size: 13px;
}

.requests-status-stale, .requests-status-falling {
  color: @mrcall_grey_text2;
}

.requests-status-rising {
  font-weight: 600;
}

.requests-reopened, .requests-sub {
  display: block;
  font-size: 12px;
  color: @mrcall_grey_text2;
}

.requests-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 4px;
}

.requests-count {
  display: block;
  font-weight: 600;
}

.requests-histogram {
  display: block;
}

.requests-bar {
  fill: @mrcall_blue;
}

.requests-examples {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.requests-hidden {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed @mrcall_borders;
  color: @mrcall_grey_text;
}

.requests-expansion td {
  background: @mrcall_light_grey_2;
}

.requests-dismiss-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 14px;

  p {
    margin: 0;
  }
}

.requests-reasons {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  legend {
    font-weight: 600;
    margin-bottom: 6px;
  }

  label {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}

.requests-error {
  color: @mrcall_status_danger;
}

.requests-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media screen and (max-width: 640px) {
  .requests-scroll {
    border: none;
    background: transparent;
  }

  .requests-table {
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }

    tbody tr {
      display: block;
      background: @mrcall_white;
      border: 1px solid @mrcall_borders;
      border-radius: 12px;
      margin-bottom: 10px;
    }

    td {
      display: block;
      border-bottom: none;
      padding: 6px 12px;

      &[data-label]::before {
        content: attr(data-label);
        display: block;
        font-size: 12px;
        font-weight: 700;
        color: @mrcall_grey_text2;
      }
    }
  }
}
</style>
