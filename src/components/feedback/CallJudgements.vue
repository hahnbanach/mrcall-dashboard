<template>
  <div ref="root" class="call-judgements">
    <p v-if="alert" class="judgement-alert" role="alert">{{ alert }}</p>

    <template v-if="showChips">
      <dl class="call-facts judgement-rows">
        <template v-for="row in callRows" :key="row.field">
          <dt>{{ fieldLabel(row.field) }}</dt>
          <dd>
            <JudgementChip
              :ref="'chip-' + row.field"
              :field-label="fieldLabel(row.field)"
              :value-label="valueLabel(row.field, row.state.value)"
              :state-label="stateLabel(row.state)"
              :detail="detail(row.field, row.state)"
              :kind="row.state.kind"
              :entries="entriesFor(row.field, row.state)"
              :busy="busyKey === row.field || status === 'loading'"
              :deferred="!loaded"
              @opening="loadThenOpen('chip-' + row.field)"
              @choose="choose(row.field, null, row.state, $event)"
            />
            <JudgementHistory
              v-if="historyOpen === row.field"
              :field-label="fieldLabel(row.field)"
              :entries="historyOf(row.field, null)"
              :label-of="(v) => valueLabel(row.field, v)"
            />
          </dd>
        </template>
      </dl>

      <!-- A fact is not a label: "this is wrong" is a report to MrCall on any of the six facts StarChat reads (its brief,
           decision 1; a012b6926), with the value read, null included -->
      <div class="judgement-facts">
        <JudgementChip
          ref="chip-facts"
          :field-label="$t('components.callInsights.feedback.fact.chip')"
          :value-label="$t('components.callInsights.feedback.fact.chip')"
          :name="$t('components.callInsights.feedback.fact.chip')"
          :entries="factEntries"
          :busy="busyKey === 'facts' || status === 'loading'"
          :deferred="!loaded"
          @opening="loadThenOpen('chip-facts')"
          @choose="reportFact($event.value)"
        />
        <span v-for="f in reportedFacts" :key="f" class="judgement-note" role="status">
          {{ $t("components.callInsights.feedback.fact.reportedOf", { fact: fieldLabel(f) }) }}
        </span>
      </div>

      <!-- What the caller asked: each request with its outcome and, while StarChat names the categories, its category -->
      <div v-if="requests.length > 0" class="judgement-requests-block">
        <h4 class="insight-subtitle" :id="uid + '-requests'">{{ $t("components.callInsights.feedback.requests.title") }}</h4>
        <ul class="judgement-requests" :aria-labelledby="uid + '-requests'">
          <li v-for="r in requests" :key="r.requestId" class="judgement-request">
            <p class="judgement-request-text">{{ r.text }}</p>
            <p v-if="r.excluded" class="judgement-note">{{ $t("components.callInsights.feedback.requests.excluded") }}</p>
            <div class="judgement-request-chips">
              <JudgementChip
                :ref="'chip-outcome-' + r.ordinal"
                :field-label="fieldLabel('outcome')"
                :value-label="valueLabel('outcome', r.outcome.state.value)"
                :state-label="stateLabel(r.outcome.state)"
                :detail="detail('outcome', r.outcome.state)"
                :kind="r.outcome.state.kind"
                :entries="entriesFor('outcome', r.outcome.state)"
                :busy="busyKey === 'outcome:' + r.requestId || status === 'loading'"
                :deferred="!!r.deferred"
                @opening="loadThenOpen('chip-outcome-' + r.ordinal)"
                @choose="choose('outcome', r, r.outcome.state, $event)"
              />
              <JudgementChip
                v-if="categories && !r.deferred"
                :field-label="fieldLabel('category')"
                :value-label="valueLabel('category', r.category.state.value)"
                :state-label="stateLabel(r.category.state)"
                :detail="detail('category', r.category.state)"
                :kind="r.category.state.kind"
                :entries="entriesFor('category', r.category.state)"
                :busy="busyKey === 'category:' + r.requestId"
                @choose="choose('category', r, r.category.state, $event)"
              />
            </div>
            <JudgementHistory
              v-if="historyOpen === 'outcome:' + r.requestId || historyOpen === 'category:' + r.requestId"
              :field-label="fieldLabel(historyOpen.split(':')[0])"
              :entries="historyOf(historyOpen.split(':')[0], r.requestId)"
              :label-of="(v) => valueLabel(historyOpen.split(':')[0], v)"
            />
          </li>
        </ul>
      </div>
    </template>

    <!-- Marked as spam: once, offer to treat the number always so; never naming the number (StarChat decision 6) -->
    <form v-if="ruleOffer" class="judgement-offer" @submit.prevent="createRule">
      <p>{{ $t("components.callInsights.feedback.rules.offer") }}</p>
      <label v-if="ruleOffer.earlierCalls > 0" class="judgement-offer-check">
        <input v-model="applyEarlier" type="checkbox" />
        <span>{{ $t(ruleOffer.earlierMore ? "components.callInsights.feedback.rules.earlierMore" : "components.callInsights.feedback.rules.earlier", { n: ruleOffer.earlierCalls }, ruleOffer.earlierCalls) }}</span>
      </label>
      <div class="judgement-offer-actions">
        <Button type="submit" size="small" :label="$t('components.callInsights.feedback.rules.always')" :loading="ruleBusy" />
        <Button type="button" size="small" text :label="$t('components.callInsights.feedback.rules.noThanks')" @click="ruleOffer = null" />
      </div>
    </form>
    <div v-if="ruleRemoval" class="judgement-offer">
      <p>{{ $t("components.callInsights.feedback.rules.byRule") }}</p>
      <div class="judgement-offer-actions">
        <Button type="button" size="small" :label="$t('components.callInsights.feedback.rules.delete')" :loading="ruleBusy" @click="deleteRule" />
        <Button type="button" size="small" text :label="$t('components.callInsights.feedback.rules.keep')" @click="ruleRemoval = null" />
      </div>
    </div>
    <p v-if="ruleDone" class="judgement-note" role="status">{{ ruleDone }}</p>
  </div>
</template>

<script>
import Classifications from "@/utils/Classifications";
import CallInsights from "@/utils/CallInsights";
import UndoGesture from "@/utils/UndoGesture";
import JudgementChip from "@/components/feedback/JudgementChip.vue";
import JudgementHistory from "@/components/feedback/JudgementHistory.vue";
import { judgementLabels } from "@/components/feedback/labels";
import { isSessionEnded } from "@/firebase/session";

// The configured categories, read once per language for the page (StarChat answers 404 until it serves the list the
// dashboard's brief proposes: then null, and no category chip is drawn).
const categoryLists = new Map();
function categoryList(user, language) {
  if (!categoryLists.has(language)) {
    categoryLists.set(language, Classifications.categories(user, language)
      .then((answer) => (answer && Array.isArray(answer.items) ? answer.items : null))
      .catch(() => { categoryLists.delete(language); return null; }));
  }
  return categoryLists.get(language);
}

let seq = 0;

/**
 * A call's judgements as chips (brief docs/briefs/2026-10-27-classification-feedback.md, scope 1 and 3; StarChat's
 * brief, decisions 6, 9 and 12): the resolution and the message of the call, each request with its outcome and its
 * category, each a `JudgementChip`; history under a chip on demand; the reader's own proposals and the corrections in
 * force said on the chip (`Classifications.chipState`).
 *
 * WHEN IT READS. A call's judgements are read (`GET insights/calls/{id}/classifications`) for the owner when the call is
 * opened (`eager`) or comes into view; for a non-owner only when the person first opens one of its chips, since
 * StarChat records every such read as an opening. After a gesture, an undo or a restore they are not read again: the
 * answer carries the call's state, which the server derived (StarChat a012b6926); a stale value takes the current
 * values its refusal carries.
 *
 * Until the read answers, and when it answers 404 or 503, the parent's own rows stay (`chips` false). A non-owner sees
 * chips at once, drawn from the call's own details, which open after the read.
 */
export default {
  components: { JudgementChip, JudgementHistory },
  props: {
    conversation: { type: Object, required: true },
    businessId: { type: String, required: true },
    user: { type: Object, required: true },
    readOnly: { type: Boolean, default: false },
    eager: { type: Boolean, default: false },
  },
  emits: ["chips"],
  data() {
    seq += 1;
    return {
      uid: "call-judgements-" + seq,
      status: "idle",
      data: null,
      categories: null,
      busyKey: null,
      historyOpen: null,
      alert: null,
      ruleOffer: null,
      ruleRemoval: null,
      applyEarlier: true,
      ruleBusy: false,
      ruleDone: null,
      offered: false,
      undo: UndoGesture.state,
      // the facts reported wrong from this panel
      reportedFacts: [],
      // reads overlap (a gesture's re-read, an undo's): only the latest one's answer is drawn
      gate: CallInsights.latestOnly(),
    };
  },
  computed: {
    labels() {
      return judgementLabels(this.$t, this.categories, this.$i18n.locale);
    },
    role() {
      return this.$store.state.role || "owner";
    },
    loaded() {
      return this.status === "ok" && !!this.data;
    },
    showChips() {
      return this.loaded || (this.readOnly && this.status !== "absent" && this.status !== "unavailable" && this.callRows.length > 0);
    },
    callRows() {
      const rows = [];
      for (const field of ["resolution", "message"]) {
        if (this.loaded) {
          const j = this.data[field];
          if (j && (j.value != null || j.model != null)) rows.push({ field, state: Classifications.chipState(j, this.data.history, { field }, this.role) });
        } else {
          const value = (this.conversation.details || {})[field];
          if (value) rows.push({ field, state: { value, model: value, kind: "model", correction: null, canRestore: false } });
        }
      }
      return rows;
    },
    // A non-owner's call before its judgements are read: the requests the call's details list, each outcome a chip that
    // reads them when opened; no category, which the details do not carry.
    detailRequests() {
      const list = (this.conversation.details || {}).requests;
      return (Array.isArray(list) ? list : []).filter((r) => r && typeof r.request === "string").map((r, i) => ({
        requestId: "detail-" + i, ordinal: i + 1, text: r.request, excluded: false, deferred: true,
        outcome: { state: { value: r.outcome || null, model: r.outcome || null, kind: "model", correction: null, canRestore: false } },
        category: { state: { value: null, model: null, kind: "model", correction: null, canRestore: false } },
      }));
    },
    // The six facts with the value read, each an entry of the report's menu.
    factEntries() {
      if (!this.loaded) return [];
      const facts = (this.data && this.data.facts) || {};
      return Classifications.FACT_FIELDS.map((f) => ({
        key: "fact:" + f, value: f, kind: "value",
        label: this.$t("components.callInsights.feedback.fact.option", { fact: this.fieldLabel(f), value: this.factValue(f, facts[f]) }),
      }));
    },
    requests() {
      if (!this.loaded) return this.readOnly && this.status !== "absent" && this.status !== "unavailable" ? this.detailRequests : [];
      if (!Array.isArray(this.data.requests)) return [];
      return this.data.requests.map((r) => ({
        ...r,
        outcome: { state: Classifications.chipState(r.outcome, this.data.history, { field: "outcome", requestId: r.requestId }, this.role) },
        category: { state: Classifications.chipState(r.category, this.data.history, { field: "category", requestId: r.requestId }, this.role) },
      }));
    },
  },
  watch: {
    showChips: {
      immediate: true,
      handler(value) { this.$emit("chips", value); },
    },
    // another panel or a list changed this call's judgements (a bulk gesture, the same call drawn twice): take the state
    // and the signals the gesture's answer carries, as the panel that made it did
    "undo.recorded"() {
      const last = this.undo.lastRecorded;
      if (!last || last.origin === this.uid || !last.affected.includes(this.conversation.id) || !this.loaded) return;
      const mine = (last.calls || []).find((c) => c && c.conversationId === this.conversation.id);
      if (!mine) { this.load(); return; }
      this.gate.begin();
      this.data = Classifications.withGesture(this.data, last);
      this.status = "ok";
    },
    "undo.undone"() {
      const last = this.undo.lastUndone;
      if (last && last.affected.includes(this.conversation.id) && this.loaded) this.takeCalls(last.calls, last.reverted);
    },
  },
  mounted() {
    if (this.readOnly) return;
    if (this.eager || typeof IntersectionObserver === "undefined") { this.load(); return; }
    this.observer = new IntersectionObserver((seen) => {
      if (seen.some((e) => e.isIntersecting)) {
        this.observer.disconnect();
        this.observer = null;
        this.load();
      }
    });
    this.observer.observe(this.$refs.root);
  },
  beforeUnmount() {
    if (this.observer) this.observer.disconnect();
  },
  methods: {
    // A gesture's or an undo's answer carries the touched calls' state (StarChat a012b6926): this call's is taken as it
    // is, the history kept and the reverted signals marked. Only an answer without it (an older StarChat) reads again.
    takeCalls(calls, reverted) {
      const mine = (Array.isArray(calls) ? calls : []).find((c) => c && c.conversationId === this.conversation.id);
      if (!mine) { this.load(); return; }
      this.gate.begin();
      const next = Classifications.withCallState(this.data, mine);
      next.history = Classifications.withReverted(next.history, reverted);
      this.data = next;
      this.status = "ok";
    },
    load() {
      this.status = this.data ? this.status : "loading";
      const language = this.$i18n.locale;
      const isCurrent = this.gate.begin();
      return Promise.all([
        Classifications.classifications(this.user, this.businessId, this.conversation.id),
        categoryList(this.user, language),
      ]).then(([answer, categories]) => {
        if (!isCurrent()) return;
        this.categories = categories;
        // an answer that is not a call's judgements (no judgement, no request list) is read as none: never chips drawn
        // off a shape this code does not know
        const shaped = answer && typeof answer === "object" && !Array.isArray(answer) && (answer.resolution || answer.message || Array.isArray(answer.requests));
        if (answer === null || (!shaped && !(answer && answer.unavailable))) { this.status = "absent"; this.data = null; return; }
        if (answer && answer.unavailable) { this.status = "unavailable"; this.data = null; return; }
        this.data = answer;
        this.status = "ok";
      }).catch((error) => {
        if (!isCurrent() || isSessionEnded(error)) return;
        this.status = this.data ? "ok" : "error";
      });
    },
    loadThenOpen(ref) {
      const open = () => {
        const chip = this.$refs[ref];
        const c = Array.isArray(chip) ? chip[0] : chip;
        if (c && this.loaded) this.$nextTick(() => c.show());
      };
      if (this.loaded) open();
      else this.load().then(open);
    },
    fieldLabel(field) {
      return this.labels.field(field);
    },
    valueLabel(field, value) {
      return this.labels.value(field, value);
    },
    stateLabel(state) {
      return state.kind && state.kind !== "model" ? this.$t("components.callInsights.feedback.state." + state.kind) : null;
    },
    who(entry) {
      return this.labels.who(entry);
    },
    when(ms) {
      return this.labels.when(ms);
    },
    detail(field, state) {
      const c = state.correction;
      if (!c || (state.kind !== "corrected" && state.kind !== "applied")) return null;
      return this.$t("components.callInsights.feedback.chip.detail", {
        from: this.valueLabel(field, c.from), to: this.valueLabel(field, c.to), who: this.who(c), when: this.when(c.when),
      });
    },
    entriesFor(field, state) {
      if (!this.loaded) return [];
      const raw = Classifications.menuEntries(field, state, this.categories);
      let first = true;
      return raw.map((e) => {
        const action = e.kind !== "value";
        const out = {
          ...e,
          key: e.kind + ":" + (e.value || ""),
          label: action ? this.$t("components.callInsights.feedback.menu." + e.kind) : this.valueLabel(field, e.value),
          action,
          firstAction: action && first,
        };
        if (action) first = false;
        return out;
      });
    },
    historyOf(field, requestId) {
      return Classifications.historyOf(this.data && this.data.history, requestId == null ? { field } : { field, requestId })
        .slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },
    async choose(field, request, state, entry) {
      const key = request ? field + ":" + request.requestId : field;
      if (entry.kind === "history") {
        this.historyOpen = this.historyOpen === key ? null : key;
        return;
      }
      this.alert = null;
      if (entry.kind === "restore") return this.restore(key, entry.feedbackId);
      if (entry.kind === "value" && entry.value === state.value) return;
      const signal = entry.kind === "value" ? "wrong_value" : entry.kind;
      const ask = Classifications.ask({
        conversationId: this.conversation.id, requestId: request ? request.requestId : undefined, field, signal,
        valueFrom: state.value, valueTo: entry.kind === "value" ? entry.value : undefined,
      });
      const gestureId = Classifications.newGestureId();
      const ruleJudged = field === "resolution" && state.value === "spam_wrong_number" && this.inForceSource("resolution") === "rule";
      this.busyKey = key;
      try {
        const answer = await Classifications.signal(this.user, ask, gestureId);
        this.takeAnswer(answer, ask, gestureId);
        UndoGesture.record(gestureId, [this.conversation.id], null, this.uid, answer && answer.call ? [answer.call] : [], [{ ask, answer }], this.role);
        if (field === "resolution" && answer && answer.status === "applied") {
          if (ask.valueTo === "spam_wrong_number") this.offerRule();
          // a rule is the business's owner's: StarChat masks its number to anyone else (a700131a4)
          else if (ruleJudged && signal === "wrong_value" && !this.readOnly) this.offerRuleRemoval();
        }
      } catch (error) {
        if (isSessionEnded(error)) return;
        this.refused(error);
      } finally {
        this.busyKey = null;
      }
    },
    // The signal's answer: its call's state (`call`), and the signal itself recorded in the history so the chip says it.
    // An answer without the call's state (a StarChat older than a012b6926) reads the call again.
    takeAnswer(answer, ask, gestureId) {
      if (!answer) return;
      if (!answer.call) { this.load(); return; }
      this.gate.begin();
      const next = Classifications.withCallState(this.data, answer.call);
      next.history = Classifications.withSignal(this.data && this.data.history, answer, ask, gestureId, this.role);
      this.data = next;
      this.status = "ok";
    },
    // A refusal: a stale value (409) carries only the stale fields' current values, which the chips take at once; the
    // judgements are then read once, since whoever changed them also wrote history this panel has not seen. Anything
    // else is said.
    refused(error) {
      const refusal = CallInsights.refusalOf(error);
      if (refusal && refusal.code === "stale_value") {
        const body = error.response && error.response.data;
        this.data = Classifications.withCurrent(this.data, body && body.current);
        this.alert = this.$t("components.callInsights.feedback.stale");
        this.load();
      } else {
        this.alert = this.$t("components.callInsights.feedback.failed");
      }
    },
    // who put the correction in force: the newest applied one, dated by its decision as `chipState` dates it
    // A fact's value in words: the labels the call's panel uses, "not recorded" for a fact the summary does not hold.
    factValue(f, v) {
      const p = "components.callInsights.";
      if (v === null || v === undefined) return f === "transferred" ? this.$t(p + "transferred.unknown") : this.$t(p + "feedback.facts.none");
      if (f === "booked" && (v === "true" || v === "false")) return this.$t(p + "booked." + v);
      if (f === "transferred" && v === "true") return this.$t(p + "transferred.true");
      if (f === "no_conversation" && CallInsights.NO_CONVERSATION_KEYS.includes(v)) return this.$t(p + "noConversation.reasons." + v);
      if (v === "true" || v === "false") return this.$t(p + "feedback.facts." + (v === "true" ? "yes" : "no"));
      return this.$t(p + "feedback.facts.recorded");
    },
    async reportFact(field) {
      const facts = (this.data && this.data.facts) || {};
      const ask = Classifications.ask({
        conversationId: this.conversation.id, field, signal: "fact_wrong", valueFrom: facts[field] === undefined ? null : facts[field],
      });
      const gestureId = Classifications.newGestureId();
      this.alert = null;
      this.busyKey = "facts";
      try {
        const answer = await Classifications.signal(this.user, ask, gestureId);
        this.takeAnswer(answer, ask, gestureId);
        if (!this.reportedFacts.includes(field)) this.reportedFacts = this.reportedFacts.concat([field]);
      } catch (error) {
        if (isSessionEnded(error)) return;
        this.refused(error);
      } finally {
        this.busyKey = null;
      }
    },
    inForceSource(field) {
      const applied = Classifications.historyOf(this.data && this.data.history, { field }).filter((h) => h.status === "applied");
      const at = (h) => h.decidedAt || h.createdAt || 0;
      const newest = applied.reduce((best, h) => (!best || at(h) > at(best) ? h : best), null);
      return newest ? newest.source : null;
    },
    async restore(key, feedbackId) {
      this.busyKey = key;
      try {
        const row = await Classifications.revert(this.user, feedbackId);
        this.gate.begin();
        const next = row && row.call ? Classifications.withCallState(this.data, row.call) : { ...this.data };
        next.history = Classifications.withDecision(this.data.history, row);
        this.data = next;
      } catch (error) {
        if (isSessionEnded(error)) return;
        this.alert = this.$t("components.callInsights.feedback.failed");
      } finally {
        this.busyKey = null;
      }
    },
    async offerRule() {
      if (this.offered) return;
      this.offered = true;
      try {
        const answer = await Classifications.callerRules(this.user, this.businessId, this.conversation.id);
        const call = answer && answer.call;
        if (call && call.eligible && !call.ruleExists) {
          this.ruleOffer = { earlierCalls: call.earlierCalls || 0, earlierMore: !!call.earlierMore };
          this.applyEarlier = true;
        }
      } catch (error) {
        // an offer that cannot be read is not made; the correction stands
        if (isSessionEnded(error)) return;
      }
    },
    async createRule() {
      this.ruleBusy = true;
      try {
        const answer = await Classifications.createRule(this.user, this.businessId, this.conversation.id, this.applyEarlier && this.ruleOffer.earlierCalls > 0);
        this.ruleOffer = null;
        const n = answer && answer.earlierCorrected ? answer.earlierCorrected : 0;
        this.ruleDone = this.$t("components.callInsights.feedback.rules.created", { n }, n);
      } catch (error) {
        if (isSessionEnded(error)) return;
        this.alert = this.$t("components.callInsights.feedback.failed");
      } finally {
        this.ruleBusy = false;
      }
    },
    async offerRuleRemoval() {
      try {
        const answer = await Classifications.callerRules(this.user, this.businessId, this.conversation.id);
        const call = answer && answer.call;
        if (call && call.eligible && call.ruleExists) this.ruleRemoval = { caller: call.caller };
      } catch (error) {
        // no offer; the correction stands
        if (isSessionEnded(error)) return;
      }
    },
    async deleteRule() {
      this.ruleBusy = true;
      try {
        await Classifications.deleteRule(this.user, this.businessId, this.ruleRemoval.caller);
        this.ruleRemoval = null;
        this.ruleDone = this.$t("components.callInsights.feedback.rules.deleted");
      } catch (error) {
        if (isSessionEnded(error)) return;
        this.alert = this.$t("components.callInsights.feedback.failed");
      } finally {
        this.ruleBusy = false;
      }
      await this.load();
    },
  },
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.call-judgements {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.judgement-rows {
  display: grid;
  grid-template-columns: minmax(120px, 36%) 1fr;
  gap: 8px 12px;
  margin: 0;

  dt {
    font-size: 13px;
    line-height: 32px;
    color: @mrcall_grey_text2;
  }

  dd {
    margin: 0;
  }

  @media screen and (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}

.judgement-alert {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: lighten(@mrcall_salmon, 12%);
  color: @mrcall_dark_grey_text;
  font-size: 14px;
}

.insight-subtitle {
  margin: 6px 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: @mrcall_grey_text2;
}

.judgement-facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.judgement-requests {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.judgement-request {
  border-left: 3px solid @mrcall_borders;
  padding-left: 10px;
}

.judgement-request-text {
  margin: 0 0 6px;
  font-size: 15px;
  color: @mrcall_dark_grey_text;
}

.judgement-request-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.judgement-note {
  margin: 0;
  font-size: 13px;
  color: @mrcall_grey_text2;
}

.judgement-offer {
  border: 1px solid @mrcall_borders;
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  p {
    margin: 0;
    font-size: 14px;
  }
}

.judgement-offer-check {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
}

.judgement-offer-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
