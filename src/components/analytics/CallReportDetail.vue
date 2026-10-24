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
            <p class="report-note">{{ $t("components.callInsights.reports.baseOldNote") }}</p>
          </template>
          <p v-if="excluded">{{ $t("components.callInsights.reports.excluded", excluded) }}</p>
          <p v-if="newerCalls > 0" class="report-newer" role="status">
            {{ $t("components.callInsights.reportDetail.newerCalls", { n: newerCalls }) }}
          </p>
        </section>

        <section v-if="topics.length > 0" class="report-section" aria-labelledby="themes-title">
          <h3 id="themes-title" class="report-section-title">{{ $t("components.callInsights.reports.topicsTitle") }}</h3>
          <ul class="report-list">
            <li v-for="topic in topics" :key="topic.topic" class="report-topic">
              <span class="report-topic-name">{{ topic.topic }}</span>
              <Tag v-if="topic.new" severity="info" :value="$t('components.callInsights.reports.newTopic')" />
              <p v-if="labelsOf(topic).length > 0" class="report-note">
                {{ $t("components.callInsights.reports.themeIncludes", { labels: labelsOf(topic).join(", ") }) }}
              </p>
            </li>
          </ul>
        </section>

        <section v-if="gapGroups.length > 0" class="report-section" aria-labelledby="gaps-title">
          <h3 id="gaps-title" class="report-section-title">{{ $t("components.callInsights.reports.gapsTitle") }}</h3>
          <div v-for="group in gapGroups" :key="group.key" class="report-gap-group">
            <h4 class="report-gap-reason">{{ $t("components.callInsights.gaps." + group.key) }}</h4>
            <ul class="report-list">
              <li v-for="(gap, i) in group.gaps" :key="i" class="report-gap">
                <p class="report-gap-summary">{{ gap.summary }}</p>
                <p v-if="gap.examples && gap.examples.length > 0" class="report-note">
                  <span>{{ $t("components.callInsights.reports.examples") }}</span>{{ " " }}
                  <template v-for="(id, k) in gap.examples" :key="id">
                    <span v-if="k > 0">, </span>
                    <router-link v-if="isOwner" :to="conversationLink(id)">{{ exampleName(id, k) }}</router-link>
                    <span v-else>{{ exampleName(id, k) }}</span>
                  </template>
                </p>
                <router-link :to="answerLink(gap)" class="report-answer">
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

/**
 * One report, on its own route (`/analytics/report?id=&start=&requestId=`; docs/briefs/2026-10-24-insights-reports-ux.md
 * in StarChat, "The report detail"): its base (the calls it read over the calls the assistant managed, and the calls it
 * did not read, named by why), a note when more calls of its days were analysed after it was written, its themes, the
 * questions left without an answer by reason with example calls and "Aggiungi la risposta", its suggestions, and the
 * quality section's gaps of its days beside the period before. The counts of the base and of quality are the
 * analytics' own (`outcomes`, `quality` over the report's days), never recomputed here.
 */
export default {
  components: { InsightsState, InsightsRequestDialog, ReportDeleteDialog },
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
    isOwner() {
      return this.role === "owner";
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
      return { silent: n.caller_silent || 0, credit: n.no_credit || 0 };
    },
    // Calls of the report's days analysed since it was written: the analytics count more than the report read.
    newerCalls() {
      const now = this.outcomes && this.outcomes.resolution ? this.outcomes.resolution.callsWithValue : null;
      if (typeof now !== "number" || !this.base) return 0;
      return Math.max(0, now - this.base.analysed);
    },
    topics() {
      return Array.isArray(this.content.topics) ? this.content.topics : [];
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
    labelsOf(topic) {
      return Array.isArray(topic.labels) ? topic.labels.filter((l) => typeof l === "string" && l.trim() !== "") : [];
    },
    exampleName(id, index) {
      return CallInsights.exampleCallName(this.report, id, this.$i18n.locale) ||
        this.$t("components.callInsights.reports.exampleCall", { n: index + 1 });
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
