<template>
  <div class="report-detail insights-ui">
    <router-link :to="backLink" class="report-back">
      <i class="pi pi-arrow-left" aria-hidden="true"></i> {{ $t("components.callInsights.reportDetail.back") }}
    </router-link>

    <InsightsState :status="status" :empty="status === 'ok' && !report" :empty-text="$t('components.callInsights.reportDetail.notFound')" @retry="load">
      <template v-if="report">
        <header class="report-head">
          <h2 class="report-title">{{ $t("components.callInsights.reportDetail.title", { period: periodText }) }}</h2>
          <div class="report-tags">
            <Tag severity="secondary" :value="$t('components.callInsights.reports.type.' + (onRequest ? 'requested' : 'automatic'))" />
            <span class="report-version">{{ $t("components.callInsights.reportDetail.version", { n: (report.revision || 0) + 1 }) }}</span>
            <span v-if="onRequest" class="report-help">{{ $t("components.callInsights.reports.type.onRequestHelp") }}</span>
          </div>
          <div class="report-actions">
            <Button
              v-if="!freeOwner"
              type="button" outlined size="small" icon="pi pi-refresh"
              :label="$t('components.callInsights.reportsTab.regenerate')"
              @click="dialogVisible = true"
            />
            <Button
              v-if="isAdmin"
              type="button" outlined size="small" severity="danger" icon="pi pi-trash"
              :label="$t('components.callInsights.reportsTab.delete')"
              @click="deleteVisible = true"
            />
          </div>
        </header>

        <!-- The base: which calls the report read, and which it did not -->
        <section class="report-section report-base" aria-labelledby="base-title">
          <h3 id="base-title" class="report-section-title">{{ $t("components.callInsights.reportDetail.baseTitle") }}</h3>
          <p v-if="base && base.kind === 'managed'">{{ $t("components.callInsights.reports.base", { analysed: base.analysed, managed: base.managed }) }}</p>
          <template v-else-if="base">
            <p>{{ $t("components.callInsights.reports.baseOld", { analysed: base.analysed }) }}</p>
            <p v-if="base.kind === 'old'" class="report-note">{{ $t("components.callInsights.reports.baseOldNote") }}</p>
          </template>
          <p v-if="excluded">{{ $t("components.callInsights.reports.excluded", excluded) }}</p>
          <!-- Requests corrected after the report was written: its counts stay as written; a regeneration reads the corrections -->
          <p v-if="correctedCount > 0" class="report-newer" role="status">
            {{ $t("components.callInsights.feedback.report.corrected", { n: correctedCount }, correctedCount) }}
          </p>
          <p v-if="newerCalls > 0" class="report-newer" role="status">
            {{ $t("components.callInsights.reportDetail.newerCalls", { n: newerCalls }) }}
          </p>
        </section>

        <!-- How the calls went, from the report's own counts: four lines over the calls where the caller asked -->
        <section v-if="outcome || hasFacts" class="report-section" aria-labelledby="outcome-title">
          <h3 id="outcome-title" class="report-section-title">{{ $t("components.callInsights.outcome.title") }}</h3>
          <template v-if="outcome">
            <p class="report-note">{{ $t("components.callInsights.howCallsWent.shareBase", { count: outcome.base }) }}</p>
            <ul class="report-list report-outcome" :aria-label="$t('components.callInsights.outcome.title')">
              <li v-for="line in outcome.lines" :key="line.key" class="report-outcome-line">
                <span class="report-outcome-label">{{ $t("components.callInsights.outcome." + line.key) }}</span>
                <span class="report-outcome-count"><CountLink :to="lineLink(line.key)" :count="line.count" :label="$t('components.callInsights.outcome.' + line.key)" /></span>
                <span class="report-note">{{ $t("components.callInsights.howCallsWent.shareOfBase", { percent: line.percent, base: outcome.base }) }}</span>
              </li>
            </ul>
          </template>
          <i18n-t v-if="typeof content.booked === 'number'" keypath="components.callInsights.reportDetail.booked" :plural="content.booked" tag="p" scope="global">
            <template #n><CountLink :to="link('booked', true)" :count="content.booked" :label="$t('components.callInsights.dimensions.booked')" /></template>
          </i18n-t>
          <i18n-t v-if="typeof content.transferred === 'number'" keypath="components.callInsights.reportDetail.transferred" :plural="content.transferred" tag="p" scope="global">
            <template #n><CountLink :to="link('transferred', true)" :count="content.transferred" :label="$t('components.callInsights.dimensions.transferred')" /></template>
          </i18n-t>
        </section>

        <section v-if="themes.length > 0" class="report-section" aria-labelledby="themes-title">
          <h3 id="themes-title" class="report-section-title">{{ $t("components.callInsights.reports.topicsTitle") }}</h3>
          <ul class="report-list">
            <li v-for="theme in themes" :key="theme.topic" class="report-topic">
              <span class="report-topic-name">{{ theme.topic }}</span>
              <i18n-t v-if="theme.calls !== null" keypath="components.callInsights.reportDetail.calls" :plural="theme.calls" tag="span" class="report-topic-calls" scope="global">
                <template #n><CountLink :to="link('topicLabels', themeLabels(theme))" :count="theme.calls" :label="theme.topic" /></template>
              </i18n-t>
              <Tag v-if="theme.new" severity="info" :value="$t('components.callInsights.reports.newTopic')" />
              <ul
                v-if="theme.outcome.length > 0"
                class="report-topic-outcome"
                :aria-label="$t('components.callInsights.reportDetail.themeOutcome', { topic: theme.topic })"
              >
                <li v-for="part in theme.outcome" :key="part.key">
                  <span>{{ $t("components.callInsights.outcome." + part.key) }}</span>{{ " " }}<span class="report-outcome-count">{{ part.count }}</span>
                </li>
              </ul>
              <p v-if="theme.labels.length > 0" class="report-note">
                {{ $t("components.callInsights.reports.themeIncludes", { labels: theme.labels.join(", ") }) }}
              </p>
            </li>
          </ul>
        </section>

        <!-- The calls to call back: not resolved, or passed on with a message that is not complete -->
        <section v-if="flagged.length > 0" class="report-section" aria-labelledby="callback-title">
          <h3 id="callback-title" class="report-section-title">{{ $t("components.callInsights.reportDetail.callBackTitle") }}</h3>
          <p class="report-note">{{ $t("components.callInsights.reportDetail.callBackNote") }}</p>
          <ul class="report-calls">
            <li v-for="id in flagged" :key="id">
              <router-link :to="conversationLink(id)">{{ exampleName(id) }}</router-link>
            </li>
          </ul>
        </section>

        <section v-if="gapGroups.length > 0" class="report-section" aria-labelledby="gaps-title">
          <h3 id="gaps-title" class="report-section-title">{{ $t("components.callInsights.reports.gapsTitle") }}</h3>
          <div v-for="group in gapGroups" :key="group.key" class="report-gap-group">
            <h4 class="report-gap-reason">
              {{ $t("components.callInsights.gaps." + group.key) }}
              <router-link
                v-if="link('gap', group.key)"
                :to="link('gap', group.key)"
                class="report-gap-calls"
                :aria-label="$t('components.callInsights.feedback.links.openAll', { label: $t('components.callInsights.gaps.' + group.key) })"
              >{{ $t("components.callInsights.feedback.links.calls") }}</router-link>
            </h4>
            <ul class="report-list">
              <li v-for="(gap, i) in group.gaps" :key="i" class="report-gap">
                <p class="report-gap-summary">{{ gap.summary }}</p>
                <Tag v-if="correctedSince(gap)" severity="info" :value="$t('components.callInsights.feedback.report.correctedTag')" class="report-corrected-tag" />
                <p v-if="gap.examples && gap.examples.length > 0" class="report-note">
                  <span>{{ $t("components.callInsights.reports.examples") }}</span>{{ " " }}
                  <template v-for="(id, k) in gap.examples" :key="id">
                    <span v-if="k > 0">, </span>
                    <router-link :to="conversationLink(id)">{{ exampleName(id) }}</router-link>
                  </template>
                </p>
                <router-link v-if="answerable(gap)" :to="answerLink(gap)" class="report-answer">
                  <i class="pi pi-pencil" aria-hidden="true"></i> {{ $t("components.callInsights.reportDetail.addAnswer") }}
                </router-link>
              </li>
            </ul>
          </div>
        </section>

        <section v-if="hasSuggestions" class="report-section" aria-labelledby="suggestions-title">
          <h3 id="suggestions-title" class="report-section-title">{{ $t("components.callInsights.reports.suggestionsTitle") }}</h3>
          <div v-if="suggestions.business_info.length > 0">
            <h4 class="report-gap-reason">{{ $t("components.callInsights.reports.businessInfoTitle") }}</h4>
            <ul class="report-list report-bullets"><li v-for="(s, i) in suggestions.business_info" :key="i">{{ s }}</li></ul>
          </div>
          <div v-if="suggestions.integration.length > 0">
            <h4 class="report-gap-reason">{{ $t("components.callInsights.reports.integrationTitle") }}</h4>
            <ul class="report-list report-bullets"><li v-for="(s, i) in suggestions.integration" :key="i">{{ s }}</li></ul>
          </div>
          <div v-if="isAdmin && suggestions.mrcall_config.length > 0">
            <h4 class="report-gap-reason">{{ $t("components.callInsights.reports.mrcallConfigTitle") }}</h4>
            <ul class="report-list report-bullets"><li v-for="(s, i) in suggestions.mrcall_config" :key="i">{{ s }}</li></ul>
          </div>
        </section>

        <!-- The quality section's gaps of the report's days, beside the period before of the same length -->
        <section v-if="qualityRows.length > 0" class="report-section" aria-labelledby="quality-title">
          <h3 id="quality-title" class="report-section-title">{{ $t("components.callInsights.reportDetail.qualityTitle") }}</h3>
          <table class="report-quality">
            <caption class="visually-hidden">{{ $t("components.callInsights.reportDetail.qualityTitle") }}</caption>
            <thead>
              <tr>
                <th scope="col">{{ $t("components.callInsights.reportDetail.qualityReason") }}</th>
                <th scope="col">{{ $t("components.callInsights.reportDetail.qualityNow") }}</th>
                <th scope="col">{{ $t("components.callInsights.reportDetail.qualityBefore") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in qualityRows" :key="row.key">
                <th scope="row">{{ $t("components.callInsights.gaps." + row.key) }}</th>
                <td>{{ row.now }}</td>
                <td>{{ row.before }}</td>
              </tr>
            </tbody>
          </table>
          <p class="report-note">{{ $t("components.callInsights.reportDetail.qualityBase", { calls: qualityBase }) }}</p>
        </section>
      </template>
    </InsightsState>

    <InsightsRequestDialog
      v-if="report && businessRecord"
      v-model:visible="dialogVisible"
      mode="regenerate"
      :business="businessRecord"
      :role="role"
      :regenerates="[{ periodStart: report.periodStart, periodEnd: report.periodEnd, requestId: report.requestId || undefined }]"
      @ended="load"
    />
    <ReportDeleteDialog
      v-if="report && businessRecord"
      v-model:visible="deleteVisible"
      :business="businessRecord"
      :report="report"
      @deleted="onDeleted"
    />
  </div>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import InsightsReports from "@/utils/InsightsReports";
import { KNOWLEDGE_BASE_SECTION, cleanQuestion } from "@/utils/KnowledgeBase";
import { isSessionEnded } from "@/firebase/session";
import InsightsState from "@/components/analytics/InsightsState.vue";
import InsightsRequestDialog from "@/components/analytics/InsightsRequestDialog.vue";
import ReportDeleteDialog from "@/components/analytics/ReportDeleteDialog.vue";
import CountLink from "@/components/analytics/CountLink.vue";
import Classifications from "@/utils/Classifications";

/**
 * One report, on its own route (`/analytics/report?id=&start=&requestId=`; docs/briefs/2026-10-24-insights-reports-ux.md
 * in StarChat, "The report detail"): its base (the calls it read over the calls the assistant managed, and the calls it
 * did not read, named by why), a note when more calls of its days were analysed after it was written, how its calls went
 * (the four outcome lines, booked and transferred, from its own counts), its themes by calls with their outcome, the
 * calls to call back, the questions left without an answer by reason with example calls and "Aggiungi la risposta"
 * (never on a question about the caller's own medical case), its suggestions, and the quality section's gaps of its
 * days beside the period before. The counts of the exclusions, newer calls and quality are the analytics' own
 * (`outcomes`, `quality` over the report's days); the outcome and themes are the report's own, never recomputed here.
 * Every count opens its calls, and every call is a link, for every role that reads the report (StarChat's brief
 * docs/briefs/2026-10-26-classification-feedback.md, decisions 9 and 14: a reseller or an admin opens a call of its
 * scope read-only, recorded). A count's list is the conversations list over the report's days, filtered as the count
 * was counted (`Classifications.countLink`); the count itself stays as the report wrote it. The requests corrected
 * after the report was written (`correctedAfterReport`) are said, and marked on the gaps resting on them.
 */
export default {
  components: { InsightsState, InsightsRequestDialog, ReportDeleteDialog, CountLink },
  props: {
    businessId: { type: String, required: true },
    periodStart: { type: Number, required: true },
    requestId: { type: String, default: null },
  },
  data() {
    return {
      status: "loading",
      report: null,
      businessRecord: null,
      outcomes: null,
      quality: null,
      dialogVisible: false,
      deleteVisible: false,
    };
  },
  computed: {
    role() {
      return this.$store.state.role || "owner";
    },
    isAdmin() {
      return this.role === "admin";
    },
    // the requests StarChat says were corrected after this report was written
    correctedIds() {
      const ids = this.report && Array.isArray(this.report.correctedAfterReport) ? this.report.correctedAfterReport : [];
      return new Set(ids);
    },
    correctedCount() {
      return this.correctedIds.size;
    },
    freeOwner() {
      return InsightsReports.freeOwner(this.role, this.businessRecord);
    },
    zone() {
      return (this.businessRecord && this.businessRecord.timeZone) || InsightsReports.FALLBACK_ZONE;
    },
    onRequest() {
      return CallInsights.isOnRequest(this.report);
    },
    periodText() {
      return this.report ? InsightsReports.periodLabel(this.report.periodStart, this.report.periodEnd, this.zone, this.$i18n.locale) : "";
    },
    content() {
      return (this.report && this.report.content) || {};
    },
    base() {
      return InsightsReports.reportBase(this.content);
    },
    excluded() {
      const n = this.outcomes && this.outcomes.noConversation;
      if (!n) return null;
      const counts = { silent: n.caller_silent || 0, credit: n.no_credit || 0 };
      // a line of zeros says nothing (U19 m7)
      return counts.silent + counts.credit > 0 ? counts : null;
    },
    // Calls of the report's days analysed since it was written: the analytics count more than the report read.
    newerCalls() {
      const now = this.outcomes && this.outcomes.resolution ? this.outcomes.resolution.callsWithValue : null;
      if (typeof now !== "number" || !this.base) return 0;
      return Math.max(0, now - this.base.analysed);
    },
    outcome() {
      return InsightsReports.reportOutcome(this.content);
    },
    hasFacts() {
      return typeof this.content.booked === "number" || typeof this.content.transferred === "number";
    },
    themes() {
      return InsightsReports.reportThemes(this.content);
    },
    // The report's calls StarChat did not name, numbered in the order the page shows them: the gaps' examples, then the
    // calls to call back.
    unnamedNumbers() {
      const gaps = Array.isArray(this.content.gaps) ? this.content.gaps : [];
      const ids = [...gaps.flatMap((g) => (g && Array.isArray(g.examples) ? g.examples : [])), ...this.flagged];
      const numbers = {};
      let n = 0;
      for (const id of ids) {
        if (numbers[id] || CallInsights.exampleCallName(this.report, id, this.$i18n.locale)) continue;
        numbers[id] = ++n;
      }
      return numbers;
    },
    // StarChat's `flagged_calls`: ids of the report's days, each listed once
    flagged() {
      const list = Array.isArray(this.content.flagged_calls) ? this.content.flagged_calls : [];
      return [...new Set(list.filter((id) => typeof id === "string" && id !== ""))];
    },
    gapGroups() {
      const gaps = Array.isArray(this.content.gaps) ? this.content.gaps : [];
      return CallInsights.GAP_KEYS
        .map((key) => ({ key, gaps: gaps.filter((g) => g && g.group === key && typeof g.summary === "string") }))
        .filter((g) => g.gaps.length > 0);
    },
    suggestions() {
      const s = this.content.suggestions || {};
      const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim() !== "") : []);
      return { business_info: list(s.business_info), integration: list(s.integration), mrcall_config: list(s.mrcall_config) };
    },
    hasSuggestions() {
      const s = this.suggestions;
      return s.business_info.length > 0 || s.integration.length > 0 || (this.isAdmin && s.mrcall_config.length > 0);
    },
    qualityRows() {
      const q = this.quality;
      if (!q || !q.gaps) return [];
      const before = q.previousGaps || {};
      return CallInsights.GAP_KEYS
        .map((key) => ({ key, now: q.gaps[key] || 0, before: before[key] || 0 }))
        .filter((r) => r.now > 0 || r.before > 0);
    },
    qualityBase() {
      return (this.quality && this.quality.callsWithUnansweredRecorded) || 0;
    },
    backLink() {
      return { path: "/analytics", query: { id: this.businessId, tab: "reports" } };
    },
  },
  watch: {
    periodStart() { this.load(); },
    requestId() { this.load(); },
  },
  mounted() {
    this.load();
  },
  methods: {
    user() {
      return this.$store.state.user;
    },
    load() {
      const user = this.user();
      if (!user) return;
      this.status = "loading";
      const businessId = this.businessId;
      const record = this.businessRecord ? Promise.resolve(this.businessRecord) : CallInsights.business(user, businessId).catch(() => null);
      Promise.all([CallInsights.report(user, businessId, this.periodStart, this.requestId || undefined), record])
        .then(([report, business]) => {
          this.businessRecord = business || { businessId, timeZone: null };
          if (report === null) { this.report = null; this.status = "ok"; return; }
          if (report && report.unavailable) { this.status = "unavailable"; return; }
          this.report = report;
          this.status = "ok";
          this.loadAnalytics(user, report);
        })
        .catch((error) => {
          if (isSessionEnded(error)) return;
          this.status = "error";
        });
    },
    // The analytics of the report's days: the base's exclusions and the newer calls, the quality gaps beside before.
    loadAnalytics(user, report) {
      const body = { businessId: this.businessId, timestampGte: report.periodStart, timestampLte: report.periodEnd - 1 };
      CallInsights.outcomes(user, body, "daily", this.zone)
        .then((o) => { this.outcomes = o && !o.unavailable ? o : null; })
        .catch(() => { this.outcomes = null; });
      CallInsights.quality(user, body)
        .then((q) => { this.quality = q && !q.unavailable ? q : null; })
        .catch(() => { this.quality = null; });
    },
    answerable(gap) {
      return InsightsReports.answerable(gap);
    },
    // A call StarChat named, by its caller and start; one it did not, by its number among the report's unnamed calls,
    // the same number wherever it appears, so two different calls never share a name.
    exampleName(id) {
      return CallInsights.exampleCallName(this.report, id, this.$i18n.locale) ||
        this.$t("components.callInsights.reports.exampleCall", { n: this.unnamedNumbers[id] || 1 });
    },
    // The list of a count of the report: its days, from its start to the instant before its exclusive end.
    link(kind, key) {
      if (!this.report) return null;
      try {
        return Classifications.countLink(this.businessId, { from: this.report.periodStart, to: this.report.periodEnd - 1 }, kind, key);
      } catch (error) {
        console.debug("No list for this count:", kind, error.message);
        return null;
      }
    },
    // the passed-on line is resolution `forwarded`, both its messages together
    lineLink(key) {
      return key === "forwarded" ? this.link("resolution", "forwarded") : this.link("outcomeLine", key);
    },
    // A theme's calls carry its raw labels (the topics the calls were given), its name only when it has none.
    themeLabels(theme) {
      const raw = (Array.isArray(this.content.topics) ? this.content.topics : []).find((t) => t && t.topic === theme.topic);
      const labels = raw && Array.isArray(raw.labels) ? raw.labels.filter((l) => typeof l === "string" && l.trim() !== "") : [];
      return labels.length ? labels : [theme.topic];
    },
    correctedSince(gap) {
      return Array.isArray(gap.requests) && gap.requests.some((id) => this.correctedIds.has(id));
    },
    conversationLink(conversationId) {
      return { path: "/conversations", query: { id: this.businessId, conversation: conversationId } };
    },
    answerLink(gap) {
      return { path: "/businessconfiguration", query: { id: this.businessId, section: KNOWLEDGE_BASE_SECTION, draftQuestion: cleanQuestion(gap.summary) } };
    },
    onDeleted() {
      this.$router.push(this.backLink);
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

.report-detail {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px 16px 32px;
  color: @mrcall_dark_grey_text;
}

.report-gap-calls {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 600;
}

.report-corrected-tag {
  margin-top: 4px;
}

.report-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 14px;
}

.report-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.report-title {
  margin: 0;
  font-size: 1.4rem;
}

.report-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.report-help, .report-note {
  font-size: 13px;
  color: @mrcall_grey_text;
}

.report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.report-section {
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  font-size: 14px;

  p {
    margin: 0 0 6px 0;
  }
}

.report-section-title {
  margin: 0 0 10px 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: @mrcall_grey_text2;
}

.report-newer {
  background: @mrcall_light_grey_2;
  border-radius: 6px;
  padding: 8px 10px;
}

.report-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.report-bullets {
  list-style: disc;
  padding-left: 18px;
  gap: 4px;
}

.report-topic-name {
  font-weight: 600;
  margin-right: 8px;
}

.report-topic-calls {
  margin-right: 8px;
  color: @mrcall_grey_text;
}

.report-topic-outcome {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  list-style: none;
  margin: 4px 0;
  padding: 0;
  font-size: 13px;
}

.report-outcome {
  gap: 4px;
  margin-bottom: 8px;
}

.report-outcome-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.report-outcome-label {
  min-width: 14rem;
}

.report-outcome-count {
  font-weight: 600;
}

.report-calls {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.report-gap-group {
  margin-bottom: 12px;
}

.report-gap-reason {
  margin: 8px 0 6px 0;
  font-size: 14px;
  font-weight: 600;
}

.report-gap-summary {
  font-size: 14px;
}

.report-answer {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.report-quality {
  border-collapse: collapse;
  width: 100%;
  max-width: 480px;
  margin-bottom: 8px;

  th, td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid @mrcall_borders;
  }

  thead th {
    font-size: 12px;
    color: @mrcall_grey_text2;
  }
}
</style>
