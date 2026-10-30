<template>
  <section v-if="page.status !== 'absent'" class="analytics-section call-insights-section my-proposals" aria-labelledby="my-proposals-title">
    <h3 id="my-proposals-title" class="section-title">{{ $t("components.callInsights.feedback.mine.title") }}</h3>
    <InsightsState
      :status="page.status"
      :empty="page.status === 'ok' && signals.length === 0"
      :empty-text="$t('components.callInsights.feedback.mine.empty')"
      :keep-content="page.status === 'loading' && signals.length > 0"
      @retry="page.retry()"
    >
      <ul class="my-proposals-list">
        <li v-for="s in signals" :key="s.feedbackId" class="my-proposal">
          <p class="my-proposal-what">{{ labels.signal(s) }}</p>
          <p v-if="s.requestText" class="my-proposal-text">{{ s.requestText }}</p>
          <p class="my-proposal-meta">
            <span class="my-proposal-state">{{ stateLabel(s) }}</span> · {{ labels.when(s.createdAt) }} ·
            <router-link :to="{ path: '/conversations', query: { id: s.businessId, conversation: s.conversationId } }">{{ $t("components.callInsights.feedback.categories.call") }}</router-link>
          </p>
          <!-- the author withdraws a proposal still waiting (the amendment of 2026-10-30, rule 5) -->
          <Button
            v-if="s.status === 'proposed' && s.source !== 'agent'"
            type="button" text size="small"
            :label="$t('components.callInsights.feedback.mine.withdraw')"
            :aria-label="$t('components.callInsights.feedback.mine.withdrawOf', { what: s.requestText || labels.signal(s) })"
            :loading="withdrawing === s.feedbackId"
            :disabled="withdrawing !== null"
            @click="withdraw(s)"
          />
          <p v-if="failed && failed.id === s.feedbackId" class="my-proposal-failed" role="alert">{{ $t(failed.key) }}</p>
        </li>
      </ul>
      <nav v-if="page.total > page.size" class="my-proposals-pager" :aria-label="$t('components.callInsights.pager.label', { name: $t('components.callInsights.feedback.mine.title') })">
        <span>{{ $t("components.callInsights.pager.range", { from: page.offset + 1, to: page.offset + page.items.length, total: page.total }) }}</span>
        <Button type="button" size="small" text icon="pi pi-angle-left" :disabled="page.offset === 0" :aria-label="$t('components.callInsights.pager.previous')" @click="page.goTo(page.offset - page.size)" />
        <Button type="button" size="small" text icon="pi pi-angle-right" :disabled="page.offset + page.size >= page.total" :aria-label="$t('components.callInsights.pager.next')" @click="page.goTo(page.offset + page.size)" />
      </nav>
    </InsightsState>
  </section>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import Classifications from "@/utils/Classifications";
import InsightsState from "@/components/analytics/InsightsState.vue";
import { judgementLabels } from "@/components/feedback/labels";
import { isSessionEnded } from "@/firebase/session";

// the states of the reader's own signals: waiting, applied, rejected, a fact report handled, withdrawn by its author
const STATUSES = "proposed,applied,rejected,closed,withdrawn";

/**
 * "Le mie proposte" (brief docs/briefs/2026-10-27-classification-feedback.md, scope 9; StarChat's brief, decision 9):
 * the reader's own proposals and where they stand ("Proposta inviata", "Applicata", "Respinta", a fact report handled,
 * "Ritirata"), a proposal still waiting withdrawn by its author,
 * of one business (`businessId`, an owner's page) or of every business the reader reaches (a reseller's scope page, the
 * admin page), as StarChat's queue answers them grouped, paged over groups (`GET insights/feedback?mine=true`).
 */
export default {
  components: { InsightsState },
  props: {
    businessId: { type: String, default: null },
  },
  data() {
    const user = () => this.$store.state.user;
    return {
      page: CallInsights.serverPage(({ offset, size, asOf }) =>
        Classifications.queue(user(), { mine: true, businessId: this.businessId || undefined, status: STATUSES, from: offset, size, asOf }), {
        read: (a) => ({ items: a && Array.isArray(a.groups) ? a.groups : [], total: a && typeof a.total === "number" ? a.total : 0, asOf: a && a.asOf }),
      }),
      categories: null,
      withdrawing: null,
      failed: null,
    };
  },
  computed: {
    labels() {
      return judgementLabels(this.$t, this.categories, this.$i18n.locale);
    },
    // the reader's proposals only: StarChat's `mine` also lists the corrections the reader applied at once (an owner's
    // outcome, an admin's category), which are not proposals (`Classifications.statusFor`)
    signals() {
      return this.page.items.flatMap((g) => (Array.isArray(g.signals) ? g.signals : []))
        // an agent's signal (a delegated token, an MCP tool) is always a proposal, whatever its role
        .filter((s) => s.source === "agent" || Classifications.statusFor(s.field, s.signal, s.actorRole) === "proposed");
    },
  },
  watch: {
    businessId() { this.page.refresh(); },
  },
  mounted() {
    this.page.refresh();
    Classifications.categories(this.$store.state.user, this.$i18n.locale)
      .then((a) => { this.categories = a && Array.isArray(a.items) ? a.items : null; })
      .catch(() => { this.categories = null; });
  },
  methods: {
    stateLabel(s) {
      const known = ["proposed", "applied", "rejected", "withdrawn"];
      return known.includes(s.status) ? this.$t("components.callInsights.feedback.state." + s.status) : this.$t("components.callInsights.feedback.history.status.closed");
    },
    withdraw(s) {
      this.withdrawing = s.feedbackId;
      this.failed = null;
      Classifications.withdraw(this.$store.state.user, s.feedbackId)
        .then(() => this.page.retry())
        .catch((error) => { if (!isSessionEnded(error)) this.failed = { id: s.feedbackId, key: Classifications.withdrawRefusalKey(CallInsights.refusalOf(error)) }; })
        .finally(() => { this.withdrawing = null; });
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.my-proposals-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.my-proposal {
  padding: 8px 10px;
  border: 1px solid @mrcall_borders;
  border-radius: 10px;

  p {
    margin: 0;
  }
}

.my-proposal-what {
  font-weight: 600;
}

.my-proposal-text {
  font-style: italic;
}

.my-proposal-meta {
  font-size: 13px;
  color: @mrcall_grey_text2;
}

.my-proposal-state {
  font-weight: 700;
  color: @mrcall_grey_text;
}

.my-proposals-pager {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
</style>
