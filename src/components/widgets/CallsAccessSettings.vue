<template>
  <section class="calls-access insights-ui" aria-labelledby="calls-access-title">
    <h2 id="calls-access-title" class="calls-access-title">{{ $t("components.callInsights.feedback.access.menu") }}</h2>

    <!-- The numbers whose calls are judged spam by a rule (StarChat's brief, decision 6): each deletable, which reverts
         what the rule marked -->
    <h3 :id="uid + '-rules'" class="calls-access-subtitle">{{ $t("components.callInsights.feedback.access.rulesTitle") }}</h3>
    <p class="calls-access-note">{{ $t("components.callInsights.feedback.access.rulesNote") }}</p>
    <InsightsState
      :status="rulesStatus"
      :empty="rulesStatus === 'ok' && rules.length === 0"
      :empty-text="$t('components.callInsights.feedback.access.rulesEmpty')"
      @retry="loadRules"
    >
      <ul class="calls-access-rules" :aria-labelledby="uid + '-rules'">
        <li v-for="r in rules" :key="r.caller">
          <span class="calls-access-number">{{ r.caller }}</span>
          <span class="calls-access-when">{{ $t("components.callInsights.feedback.access.since", { date: when(r.createdAt) }) }}</span>
          <Button
            type="button" size="small" text severity="danger"
            :label="$t('components.callInsights.feedback.access.delete')"
            :aria-label="$t('components.callInsights.feedback.access.deleteOf', { number: r.caller })"
            :disabled="deleting === r.caller"
            @click="deleteRule(r)"
          />
        </li>
      </ul>
    </InsightsState>
    <p v-if="rulesNote" class="calls-access-note" role="status">{{ rulesNote }}</p>

    <!-- Who opened the business's calls (StarChat's brief, decision 14): a reseller by its company, MrCall for an admin,
         never an e-mail or an id -->
    <h3 class="calls-access-subtitle">{{ $t("components.callInsights.feedback.access.logTitle") }}</h3>
    <p class="calls-access-note">{{ $t("components.callInsights.feedback.access.logNote") }}</p>
    <PagedTable
      :state="log"
      :columns="logColumns"
      :row-key="(e) => e.at + ':' + e.conversationId + ':' + e.event"
      :caption="$t('components.callInsights.feedback.access.logTitle')"
      :empty-text="$t('components.callInsights.feedback.access.logEmpty')"
    >
      <template #cell-at="{ row: e }">{{ when(e.at) }}</template>
      <template #cell-who="{ row: e }">
        {{ e.name || $t("components.callInsights.feedback.access.roles.unknown") }}
        <span class="calls-access-role">{{ $t("components.callInsights.feedback.access.roles." + roleKey(e.role)) }}</span>
      </template>
      <template #cell-event="{ row: e }">{{ $t("components.callInsights.feedback.access.events." + (e.event === "audio" ? "audio" : "opened")) }}</template>
      <template #cell-call="{ row: e }">
        <router-link :to="{ path: '/conversations', query: { id: e.businessId || businessId, conversation: e.conversationId } }">
          {{ e.callStart ? when(e.callStart) : $t("components.callInsights.feedback.categories.call") }}
        </router-link>
      </template>
    </PagedTable>
  </section>
</template>

<script>
import CallInsights from "@/utils/CallInsights";
import Classifications from "@/utils/Classifications";
import InsightsState from "@/components/analytics/InsightsState.vue";
import PagedTable from "@/components/analytics/PagedTable.vue";
import { isSessionEnded } from "@/firebase/session";

const ROLES = ["admin", "reseller", "service"];
let seq = 0;

/**
 * The business's calls, for its owner (brief docs/briefs/2026-10-27-classification-feedback.md, scope 10): the numbers
 * treated as spam (`GET`/`DELETE insights/caller-rules`), and who opened the business's calls
 * (`GET customer/conversation/access-log`), paged on the server, each opening with when, what (the call or its
 * recording), by whom (role and name) and the call it opened. The configuration page draws it for the business's owner
 * only.
 */
export default {
  components: { InsightsState, PagedTable },
  props: {
    businessId: { type: String, required: true },
    user: { type: Object, required: true },
  },
  data() {
    seq += 1;
    return {
      uid: "calls-access-" + seq,
      rulesStatus: "loading",
      rules: [],
      rulesNote: null,
      deleting: null,
      log: CallInsights.serverPage(({ offset, size, asOf }) => Classifications.accessLog(this.user, { businessId: this.businessId, from: offset, size, asOf })),
    };
  },
  computed: {
    logColumns() {
      const t = (k) => this.$t("components.callInsights.feedback.access.columns." + k);
      return [{ key: "at", label: t("at") }, { key: "who", label: t("who") }, { key: "event", label: t("event") }, { key: "call", label: t("call") }];
    },
  },
  mounted() {
    this.loadRules();
    this.log.refresh();
  },
  methods: {
    when(ms) {
      return ms ? new Date(ms).toLocaleString(this.$i18n.locale, { dateStyle: "medium", timeStyle: "short" }) : "";
    },
    roleKey(role) {
      return ROLES.includes(role) ? role : "unknown";
    },
    loadRules() {
      this.rulesStatus = "loading";
      return Classifications.callerRules(this.user, this.businessId)
        .then((answer) => {
          if (answer === null) { this.rulesStatus = "absent"; this.rules = []; return; }
          if (answer.unavailable) { this.rulesStatus = "unavailable"; this.rules = []; return; }
          this.rules = Array.isArray(answer.rules) ? answer.rules : [];
          this.rulesStatus = "ok";
        })
        .catch((error) => {
          if (isSessionEnded(error)) return;
          this.rulesStatus = "error";
        });
    },
    async deleteRule(rule) {
      this.deleting = rule.caller;
      this.rulesNote = null;
      try {
        const answer = await Classifications.deleteRule(this.user, this.businessId, rule.caller);
        const n = answer && typeof answer.reverted === "number" ? answer.reverted : 0;
        this.rulesNote = this.$t("components.callInsights.feedback.access.deleted", { n }, n);
      } catch (error) {
        if (isSessionEnded(error)) return;
        this.rulesNote = this.$t("components.callInsights.feedback.failed");
      } finally {
        this.deleting = null;
      }
      this.loadRules();
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.calls-access {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calls-access-title {
  margin: 0 0 8px;
  font-size: 1.3rem;
}

.calls-access-subtitle {
  margin: 16px 0 0;
  font-size: 1rem;
}

.calls-access-note {
  margin: 0;
  font-size: 14px;
  color: @mrcall_grey_text;
}

.calls-access-rules {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: 1px solid @mrcall_borders;
    border-radius: 8px;
  }
}

.calls-access-number {
  font-weight: 700;
}

.calls-access-when,
.calls-access-role {
  font-size: 13px;
  color: @mrcall_grey_text2;
}

.calls-access-role {
  margin-left: 6px;
}
</style>
