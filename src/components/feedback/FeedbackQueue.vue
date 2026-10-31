<template>
  <section v-if="page.status !== 'absent'" class="analytics-section call-insights-section feedback-queue" aria-labelledby="feedback-queue-title">
    <h3 id="feedback-queue-title" class="section-title">{{ $t("components.callInsights.feedback.queue.title") }}</h3>
    <p class="feedback-queue-purpose">{{ $t("components.callInsights.feedback.queue.purpose") }}</p>

    <div v-if="selected.size > 0" class="feedback-queue-bulk" role="group" :aria-label="$t('components.callInsights.feedback.queue.selectedLabel')">
      <Button type="button" size="small" :label="$t('components.callInsights.feedback.queue.applySelected', { n: selected.size })" :disabled="busy" @click="decideSelected('apply')" />
      <Button type="button" size="small" outlined :label="$t('components.callInsights.feedback.queue.rejectSelected', { n: selected.size })" :disabled="busy" @click="decideSelected('reject')" />
    </div>
    <p v-if="result" class="feedback-queue-result" role="status">{{ result }}</p>

    <InsightsState
      :status="page.status"
      :empty="page.status === 'ok' && page.items.length === 0"
      :empty-text="$t('components.callInsights.feedback.queue.empty')"
      :keep-content="page.status === 'loading' && page.items.length > 0"
      @retry="page.retry()"
    >
      <div v-for="g in page.items" :key="(g.category || '') + ':' + g.businessId" class="feedback-group">
        <h4 class="feedback-group-title">{{ groupTitle(g) }}</h4>
        <ul class="feedback-signals">
          <li v-for="s in g.signals || []" :key="s.feedbackId" class="feedback-signal">
            <input
              type="checkbox"
              class="feedback-check"
              :checked="selected.has(s.feedbackId)"
              :disabled="!decidable(s)"
              :aria-label="$t('components.callInsights.feedback.queue.select', { text: subjectText(s) })"
              @change="toggle(s.feedbackId, $event.target.checked)"
            />
            <div class="feedback-signal-body">
              <p class="feedback-signal-what">{{ labels.signal(s) }}</p>
              <p v-if="s.status === 'orphaned'" class="feedback-signal-note">{{ $t("components.callInsights.feedback.history.status.orphaned") }}</p>
              <p v-if="s.requestText" class="feedback-signal-text">{{ s.requestText }}</p>
              <p class="feedback-signal-who">
                {{ labels.who(s) }} · {{ labels.when(s.createdAt) }} ·
                <router-link :to="{ path: '/conversations', query: { id: s.businessId, conversation: s.conversationId } }">{{ $t("components.callInsights.feedback.categories.call") }}</router-link>
              </p>
              <div class="feedback-signal-actions">
                <template v-if="s.status === 'proposed'">
                  <Button type="button" size="small" :label="s.signal === 'fact_wrong' ? $t('components.callInsights.feedback.queue.handled') : $t('components.callInsights.feedback.queue.apply')" :disabled="busy" @click="decide(s, 'apply')" />
                  <Button type="button" size="small" outlined :label="$t('components.callInsights.feedback.queue.reject')" :disabled="busy" @click="decide(s, 'reject')" />
                </template>
                <template v-else-if="s.status === 'orphaned'">
                  <Button v-if="!reattaching || reattaching.id !== s.feedbackId" type="button" size="small" :label="$t('components.callInsights.feedback.queue.reattach')" :disabled="busy" @click="startReattach(s)" />
                  <span v-else class="feedback-reattach">
                    <label :for="'reattach-' + s.feedbackId">{{ $t("components.callInsights.feedback.queue.requestOfCall") }}</label>
                    <select :id="'reattach-' + s.feedbackId" v-model="reattaching.requestId">
                      <option v-for="r in reattaching.requests" :key="r.requestId" :value="r.requestId">{{ r.text }}</option>
                    </select>
                    <Button type="button" size="small" :label="$t('components.callInsights.feedback.queue.reattachHere')" :disabled="busy || !reattaching.requestId" @click="reattach(s)" />
                  </span>
                  <Button type="button" size="small" outlined :label="$t('components.callInsights.feedback.queue.close')" :disabled="busy" @click="decide(s, 'reject')" />
                </template>
              </div>
            </div>
          </li>
        </ul>
      </div>
      <nav v-if="page.total > page.size" class="feedback-pager" :aria-label="$t('components.callInsights.pager.label', { name: $t('components.callInsights.feedback.queue.title') })">
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

const GROUPS_PER_PAGE = 10;

/**
 * "Correzioni da rivedere", an admin's (brief docs/briefs/2026-10-27-classification-feedback.md, scope 9 and amendment
 * item 3; StarChat's brief, decision 9 "Queues"): the proposals, the orphans, the judgements marked wrong "to review" and
 * the facts reported, as StarChat groups them by category and business and orders them by the calls each group moves,
 * paged over groups (`GET insights/feedback`). Each signal says what it asks, on which request, who and when, and links
 * its call; an admin applies or rejects it, closes a fact report as handled, or re-attaches an orphan to a request of
 * its call (read on request). The selected ones are decided one call each (StarChat has no bulk decision), and what
 * happened is said.
 */
export default {
  components: { InsightsState },
  data() {
    const user = () => this.$store.state.user;
    return {
      page: CallInsights.serverPage(({ offset, size, asOf }) => Classifications.queue(user(), { from: offset, size, asOf }), {
        size: GROUPS_PER_PAGE,
        read: (a) => ({ items: a && Array.isArray(a.groups) ? a.groups : [], total: a && typeof a.total === "number" ? a.total : 0, asOf: a && a.asOf }),
      }),
      categories: null,
      selected: new Set(),
      busy: false,
      result: null,
      reattaching: null,
    };
  },
  computed: {
    labels() {
      return judgementLabels(this.$t, this.categories, this.$i18n.locale);
    },
  },
  watch: {
    // a selected signal no longer on the page shown is no longer selected
    "page.items"(groups) {
      const shown = new Set((groups || []).flatMap((g) => (g.signals || []).map((s) => s.feedbackId)));
      this.selected = new Set([...this.selected].filter((id) => shown.has(id)));
    },
  },
  mounted() {
    this.page.refresh();
    Classifications.categories(this.$store.state.user, this.$i18n.locale)
      .then((a) => { this.categories = a && Array.isArray(a.items) ? a.items : null; })
      .catch(() => { this.categories = null; });
  },
  methods: {
    groupTitle(g) {
      const calls = this.$t("components.callInsights.feedback.categories.calls", { n: g.calls || 0 }, g.calls || 0);
      const business = CallInsights.businessLabel(g.businessName, g.businessId);
      return g.category ? [this.labels.value("category", g.category), business, calls].join(" · ") : [business, calls].join(" · ");
    },
    subjectText(s) {
      return s.requestText || this.labels.signal(s);
    },
    decidable(s) {
      return s.status === "proposed";
    },
    toggle(id, on) {
      const next = new Set(this.selected);
      if (on) next.add(id); else next.delete(id);
      this.selected = next;
    },
    async decide(s, move) {
      this.busy = true;
      this.result = null;
      try {
        await (move === "apply" ? Classifications.apply(this.$store.state.user, s.feedbackId) : Classifications.reject(this.$store.state.user, s.feedbackId));
      } catch (error) {
        if (isSessionEnded(error)) return;
        this.result = this.$t("components.callInsights.feedback.failed");
      } finally {
        this.busy = false;
      }
      this.page.retry();
    },
    // One call per signal, in order; what happened is counted and said.
    async decideSelected(move) {
      const ids = this.page.items.flatMap((g) => g.signals || []).filter((s) => this.selected.has(s.feedbackId) && this.decidable(s)).map((s) => s.feedbackId);
      this.busy = true;
      let done = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await (move === "apply" ? Classifications.apply(this.$store.state.user, id) : Classifications.reject(this.$store.state.user, id));
          done += 1;
        } catch (error) {
          if (isSessionEnded(error)) return;
          failed += 1;
        }
      }
      this.busy = false;
      this.selected = new Set();
      const key = move === "apply" ? "applied" : "rejected";
      this.result = [this.$t("components.callInsights.feedback.queue." + key, { n: done }, done)]
        .concat(failed ? [this.$t("components.callInsights.feedback.queue.failedN", { n: failed }, failed)] : []).join(" ");
      this.page.retry();
    },
    // An orphan's call read on the admin's request (a recorded opening when the admin is not its owner): its current
    // requests, one of which the correction is re-attached to.
    async startReattach(s) {
      this.busy = true;
      try {
        const call = await Classifications.classifications(this.$store.state.user, s.businessId, s.conversationId);
        const requests = call && Array.isArray(call.requests) ? call.requests : [];
        this.reattaching = { id: s.feedbackId, requests, requestId: requests.length ? requests[0].requestId : null };
      } catch (error) {
        if (isSessionEnded(error)) return;
        this.result = this.$t("components.callInsights.feedback.failed");
      } finally {
        this.busy = false;
      }
    },
    async reattach(s) {
      this.busy = true;
      try {
        await Classifications.apply(this.$store.state.user, s.feedbackId, this.reattaching.requestId);
        this.reattaching = null;
      } catch (error) {
        if (isSessionEnded(error)) return;
        this.result = this.$t("components.callInsights.feedback.failed");
      } finally {
        this.busy = false;
      }
      this.page.retry();
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.feedback-queue-purpose,
.feedback-queue-result {
  font-size: 14px;
  color: @mrcall_grey_text;
}

.feedback-queue-bulk {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.feedback-group {
  margin-bottom: 16px;
}

.feedback-group-title {
  margin: 8px 0;
  font-size: 15px;
  color: @mrcall_dark_grey_text;
}

.feedback-signals {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feedback-signal {
  display: flex;
  gap: 10px;
  padding: 10px;
  border: 1px solid @mrcall_borders;
  border-radius: 10px;
}

.feedback-check {
  width: 20px;
  height: 20px;
  flex: none;
  accent-color: @mrcall_blue;
}

.feedback-signal-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  p {
    margin: 0;
  }
}

.feedback-signal-what {
  font-weight: 600;
}

.feedback-signal-text {
  font-style: italic;
}

.feedback-signal-who,
.feedback-signal-note {
  font-size: 13px;
  color: @mrcall_grey_text2;
}

.feedback-signal-actions,
.feedback-reattach {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.feedback-pager {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
</style>
