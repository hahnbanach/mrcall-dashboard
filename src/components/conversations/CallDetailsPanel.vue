<template>
  <div class="call-details">
    <!-- What the business can do about the call, as the call email offers it -->
    <div v-if="dialable || calendarLink" class="call-actions">
      <a v-if="dialable" class="call-action call-action-primary" :href="'tel:' + dialable">
        <i class="pi pi-phone" aria-hidden="true"></i>
        <span>{{ $t("components.conversations.details.callBack") }}</span>
      </a>
      <a v-if="dialable" class="call-action" :href="whatsappLink" target="_blank" rel="noopener">
        <i class="pi pi-whatsapp" aria-hidden="true"></i>
        <span>{{ $t("components.conversations.details.whatsapp") }}</span>
      </a>
      <a v-if="calendarLink" class="call-action" :href="calendarLink" target="_blank" rel="noopener">
        <i class="pi pi-calendar-plus" aria-hidden="true"></i>
        <span>{{ $t("components.conversations.details.addToCalendar") }}</span>
      </a>
    </div>

    <section v-if="booking" class="call-box call-box-highlighted">
      <h3 class="call-box-title">{{ $t("components.conversations.details.booking") }}</h3>
      <dl class="call-facts">
        <template v-for="row in bookingRows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
    </section>

    <section v-if="details.summary || facts.length > 0" class="call-box" :class="{ 'call-box-highlighted': !booking }">
      <h3 class="call-box-title">{{ $t("components.conversations.details.summary") }}</h3>
      <p v-if="details.summary" class="call-summary">{{ details.summary }}</p>
      <dl v-if="facts.length > 0" class="call-facts">
        <template v-for="row in facts" :key="row.key">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
    </section>

    <!-- What the call said: StarChat's call insights, version 2 (the four dimensions under the
         dashboard's one value table, the topics, the questions the assistant could not answer, the
         checks that fired). Absent on a call from before the feature, exactly like today. -->
    <!-- drawn while the call has insights, or while its judgements are chips (a call whose details carry none, read
         on a page that asks for its judgements) -->
    <section v-if="hasInsights || withJudgements" :class="{ 'call-box call-insights-box': hasInsights || chips }">
      <h3 v-if="hasInsights || chips" class="call-box-title">{{ $t("components.callInsights.panel.title") }}</h3>

      <!-- The judgements as chips a person corrects (CallJudgements); while they are not drawn, today's rows -->
      <CallJudgements
        v-if="withJudgements"
        :conversation="conversation"
        :business-id="businessId"
        :user="user"
        :read-only="readOnly"
        :eager="eager"
        @chips="chips = $event"
      />

      <dl v-for="row in plainRows" :key="row.dimension" class="call-facts insight-fact">
        <dt>{{ $t("components.callInsights.dimensions." + row.dimension) }}</dt>
        <dd>
          {{ $t("components.callInsights." + row.dimension + "." + row.value) }}
          <Tag
            v-if="row.assessed"
            severity="secondary"
            :value="$t('components.callInsights.assessedMarking')"
            class="insight-assessed-tag"
          />
        </dd>
      </dl>

      <!-- A fact is not a label: "this is wrong" is a report to MrCall (StarChat's brief, decision 1) -->
      <div v-if="reportableRows.length > 0" class="fact-reports">
        <template v-for="row in reportableRows" :key="row.dimension">
          <span v-if="reported[row.dimension]" class="fact-reported" role="status">
            {{ $t("components.callInsights.feedback.fact.reported") }} ({{ $t("components.callInsights.dimensions." + row.dimension) }})
          </span>
          <button v-else type="button" class="fact-report" :disabled="reporting === row.dimension" @click="reportFact(row)">
            {{ $t("components.callInsights.feedback.fact.reportOf", { fact: $t("components.callInsights.dimensions." + row.dimension) }) }}
          </button>
        </template>
      </div>

      <div v-if="topics.length > 0" class="insight-topics">
        <Tag v-for="topic in topics" :key="topic" :value="topic" class="insight-topic-tag" />
      </div>

      <div v-if="unkept.length > 0" class="insight-unkept">
        <h4 class="insight-subtitle">{{ $t("components.callInsights.unkept.title") }}</h4>
        <div v-for="(item, idx) in unkept" :key="idx" class="insight-unkept-entry">
          <span class="insight-unkept-action">
            {{ unkeptLabel(item.action) }}
            <Tag
              severity="secondary"
              :value="$t('components.callInsights.assessedMarking')"
              class="insight-assessed-tag"
            />
          </span>
          <p class="insight-unkept-said">&ldquo;{{ item.said }}&rdquo;</p>
        </div>
      </div>

      <div v-if="unanswered.length > 0" class="insight-unanswered">
        <h4 class="insight-subtitle">{{ $t("components.callInsights.panel.unansweredTitle") }}</h4>
        <div v-for="(item, idx) in unanswered" :key="idx" class="insight-question">
          <span class="insight-question-reason">{{ gapLabel(item.gap) }}</span>
          <p class="insight-question-text">{{ item.question }}</p>
          <p v-if="item.suggestion" class="insight-question-suggestion">
            {{ $t("components.callInsights.panel.suggestion", { suggestion: item.suggestion }) }}
          </p>
        </div>
      </div>

      <div v-if="checksFired.length > 0" class="insight-checks-wrapper">
        <h4 class="insight-subtitle">{{ $t("components.callInsights.panel.checksTitle") }}</h4>
        <ul class="insight-checks">
          <li v-for="key in checksFired" :key="key">{{ checkLabel(key) }}</li>
        </ul>
      </div>
    </section>

    <section v-if="previousCalls.length > 0" class="call-section">
      <button
        type="button"
        class="call-toggle"
        :aria-expanded="showPrevious ? 'true' : 'false'"
        @click="showPrevious = !showPrevious"
      >
        <i :class="showPrevious ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" aria-hidden="true"></i>
        {{ $t("components.conversations.details.previousCalls", { count: previousCalls.length }) }}
      </button>
      <ul v-if="showPrevious" class="previous-calls">
        <li v-for="(call, idx) in previousCalls" :key="idx">
          <span v-if="call.date" class="previous-date">{{ call.date }}</span>
          <span>{{ call.summary }}</span>
        </li>
      </ul>
    </section>

    <section v-if="turns.length > 0" class="call-section">
      <button
        type="button"
        class="call-toggle"
        :aria-expanded="showTranscript ? 'true' : 'false'"
        @click="showTranscript = !showTranscript"
      >
        <i :class="showTranscript ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" aria-hidden="true"></i>
        {{ $t("components.conversations.details.transcript", { count: turns.length }) }}
      </button>
      <div v-if="showTranscript" class="transcript">
        <div
          v-for="(msg, idx) in turns"
          :key="idx"
          class="transcript-message"
          :class="msg.speaker_type === 'agent' ? 'transcript-agent' : 'transcript-user'"
        >
          <span class="transcript-alias">{{ msg.alias }}</span>
          <span class="transcript-content">{{ msg.content }}</span>
        </div>
      </div>
    </section>

    <!-- A non-owner's recording comes from a one-time link, and only on a call opened on purpose (StarChat decision 14) -->
    <section v-if="!readOnly || eager" class="call-section">
      <audio v-if="audioUrl" controls autoplay class="call-audio" :src="audioUrl">
        {{ $t("components.conversations.table.audioNotSupported") }}
      </audio>
      <audio v-else-if="audio" controls autoplay class="call-audio">
        <source :src="'data:audio/mpeg;base64,' + audio" />
        {{ $t("components.conversations.table.audioNotSupported") }}
      </audio>
      <button
        v-else-if="recordingState !== 'missing'"
        type="button"
        class="call-toggle"
        :disabled="recordingState === 'loading'"
        @click="loadRecording"
      >
        <i :class="recordingState === 'loading' ? 'pi pi-spin pi-spinner' : 'pi pi-play'" aria-hidden="true"></i>
        {{ $t("components.conversations.details.listen") }}
      </button>
      <span v-else class="call-note">{{ $t("components.conversations.details.recordingMissing") }}</span>
    </section>
  </div>
</template>

<script>
import ConversationApi from "@/utils/Conversation";
import CallInsights from "@/utils/CallInsights";
import CallJudgements from "@/components/feedback/CallJudgements.vue";
import Classifications from "@/utils/Classifications";

/**
 * The body of a call on the conversations page: what the business has to do about it, what the
 * caller said and what the assistant collected, in the order of the call's notification email.
 * The details are read once, by StarChat (CallDetails), and arrive as `conversation.details`; the
 * component draws them and decides nothing about them.
 *
 * The recording is not in the list: StarChat sends it only when one call is read by id, so it is
 * fetched when the owner asks to listen.
 */
export default {
  components: { CallJudgements },
  props: {
    conversation: { type: Object, required: true },
    businessId: { type: String, required: true },
    user: { type: Object, required: true },
    expanded: { type: Boolean, default: false },
    // a call of a business the reader does not own (an admin, a reseller): read-only, recorded by StarChat
    readOnly: { type: Boolean, default: false },
    // the call was opened on purpose (its link): its judgements are read at once rather than when in view
    eager: { type: Boolean, default: false },
    // the judgements as chips: a page that carries the undo bar and knows the reader's ownership asks for them
    withJudgements: { type: Boolean, default: false },
  },
  data() {
    return {
      showTranscript: this.expanded,
      showPrevious: this.expanded,
      audio: this.conversation.audio || null,
      audioUrl: null,
      recordingState: "idle",
      // the judgements are drawn as chips: the plain resolution and message rows step aside
      chips: false,
      // the facts reported wrong in this view, and the one being sent
      reported: {},
      reporting: null,
    };
  },
  computed: {
    details() {
      return this.conversation.details || {};
    },
    dialable() {
      const number = this.details.callerNumber || this.conversation.contactNumber || "";
      const digits = number.replace(/[^+0-9]/g, "");
      return digits.length < 5 ? null : digits;
    },
    whatsappLink() {
      const base = "https://wa.me/" + this.dialable.replace(/^\+/, "");
      const text = this.details.whatsappMessage;
      return text ? base + "?text=" + encodeURIComponent(text) : base;
    },
    calendarLink() {
      return this.details.calendarLink || null;
    },
    booking() {
      return this.details.booking || null;
    },
    bookingRows() {
      const b = this.booking || {};
      return [
        { label: this.$t("components.conversations.details.day"), value: b.day },
        { label: this.$t("components.conversations.details.time"), value: b.time },
        { label: this.$t("components.conversations.details.people"), value: b.people },
      ].filter((row) => row.value);
    },
    facts() {
      const rows = (this.details.fields || []).map((f) => ({ key: f.name, label: f.label, value: f.value }));
      if (this.details.nameAsHeard) {
        rows.push({
          key: "__nameAsHeard",
          label: this.$t("components.conversations.details.nameAsHeard"),
          value: this.details.nameAsHeard,
        });
      }
      return rows;
    },
    previousCalls() {
      return this.details.previousCalls || [];
    },
    topics() {
      return this.details.topics || [];
    },
    unanswered() {
      return this.details.unanswered || [];
    },
    unkept() {
      return CallInsights.unkeptRows(this.details);
    },
    checksFired() {
      return CallInsights.firedChecks(this.details);
    },
    insightRows() {
      return CallInsights.insightRows(this.details);
    },
    reportableRows() {
      return this.insightRows.filter((r) => this.reportable(r));
    },
    plainRows() {
      return this.chips ? this.insightRows.filter((r) => r.dimension !== "resolution" && r.dimension !== "message") : this.insightRows;
    },
    hasInsights() {
      return this.topics.length > 0 || this.unanswered.length > 0 || this.unkept.length > 0 ||
        this.checksFired.length > 0 || this.insightRows.length > 0;
    },
    turns() {
      const data = this.conversation.data;
      const turns = data && Array.isArray(data.conversation_transcription) ? data.conversation_transcription : [];
      return turns.filter((t) => t && t.content && String(t.content).trim().length > 0);
    },
  },
  watch: {
    expanded(value) {
      this.showTranscript = value;
    },
  },
  methods: {
    // Booked and transferred are reported with the value the summary holds ("true", "false"; transferred absent is
    // unset), which StarChat checks; the other facts are not in a call's details, so they are not offered here.
    reportable(row) {
      return row.dimension === "booked" || row.dimension === "transferred";
    },
    async reportFact(row) {
      const valueFrom = row.dimension === "booked" ? String(this.details.booked) : (this.details.transferred === true ? "true" : null);
      this.reporting = row.dimension;
      try {
        await Classifications.signal(this.user, Classifications.ask({
          conversationId: this.conversation.id, field: row.dimension, signal: "fact_wrong", valueFrom,
        }), Classifications.newGestureId());
        this.reported = { ...this.reported, [row.dimension]: true };
      } catch (error) {
        console.error("Fact not reported:", this.conversation.id, error && error.response ? error.response.status : "");
        this.$emit("error");
      } finally {
        this.reporting = null;
      }
    },
    gapLabel(gap) {
      return this.$t("components.callInsights.gaps." + gap);
    },
    unkeptLabel(action) {
      return this.$t("components.callInsights.unkept.actions." + (action || "other"));
    },
    checkLabel(key) {
      return this.$t("components.callInsights.checks." + key);
    },
    async loadRecording() {
      this.recordingState = "loading";
      if (this.readOnly) return this.loadRecordingLink();
      try {
        const call = await ConversationApi.get(this.user, this.businessId, this.conversation.id);
        if (call && call.audio) {
          this.audio = call.audio;
          this.recordingState = "loaded";
        } else {
          this.recordingState = "missing";
        }
      } catch (error) {
        console.error("Recording not loaded:", this.conversation.id, error.response ? error.response.status : "");
        this.recordingState = "idle";
        this.$emit("error");
      }
    },
    // A non-owner's recording: StarChat issues a one-time link (and records it as `conversation.audio`); a 404 is no
    // recording, or a call out of reach.
    async loadRecordingLink() {
      try {
        const link = await Classifications.audioLink(this.user, this.conversation.id);
        if (link && link.url) {
          this.audioUrl = link.url;
          this.recordingState = "loaded";
        } else {
          this.recordingState = "missing";
        }
      } catch (error) {
        if (error && error.response && error.response.status === 404) { this.recordingState = "missing"; return; }
        console.error("Recording link not issued:", this.conversation.id, error && error.response ? error.response.status : "");
        this.recordingState = "idle";
        this.$emit("error");
      }
    },
  },
  emits: ["error"],
};
</script>

<style lang="less" scoped>
@import "../../assets/style/colors";

.call-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.call-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.call-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid @mrcall_blue;
  border-radius: 8px;
  color: @mrcall_blue;
  background: @mrcall_white;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    background: @mrcall_bluette;
  }

  &.call-action-primary {
    background: @mrcall_blue;
    color: @mrcall_white;

    &:hover {
      background: darken(@mrcall_blue, 8%);
    }
  }
}

.call-box {
  border: 1px solid @mrcall_borders;
  border-radius: 10px;
  padding: 12px 14px;

  &.call-box-highlighted {
    background: lighten(@mrcall_salmon, 12%);
    border-color: @mrcall_salmon;
  }
}

.call-box-title {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: @mrcall_grey_text2;
}

.call-summary {
  margin: 0 0 8px 0;
  font-size: 15px;
  line-height: 1.5;
  color: @mrcall_dark_grey_text;
  white-space: pre-line;
}

.call-facts {
  display: grid;
  grid-template-columns: minmax(120px, 36%) 1fr;
  gap: 6px 12px;
  margin: 0;

  dt {
    font-size: 13px;
    line-height: 1.5;
    color: @mrcall_grey_text2;
  }

  dd {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    font-weight: 600;
    color: @mrcall_dark_grey_text;
    white-space: pre-line;
    word-break: break-word;
  }

  @media screen and (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: 0;

    dd {
      margin-bottom: 8px;
    }
  }
}

.call-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 4px 0;
  font-size: 14px;
  font-weight: 600;
  color: @mrcall_grey_text;
  cursor: pointer;

  &:hover {
    color: @mrcall_dark_grey_text;
  }

  &:disabled {
    cursor: progress;
  }
}

.previous-calls {
  list-style: none;
  margin: 6px 0 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  li {
    font-size: 14px;
    color: @mrcall_dark_grey_text;
    display: flex;
    gap: 8px;
  }
}

.previous-date {
  color: @mrcall_grey_text2;
  white-space: nowrap;
}

.transcript {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.transcript-message {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 85%;
}

.transcript-agent {
  background: @mrcall_light_grey_2;
  align-self: flex-start;
}

.transcript-user {
  background: @mrcall_bluette;
  align-self: flex-end;
}

.transcript-alias {
  font-size: 12px;
  font-weight: 600;
  color: @mrcall_grey_text;
}

.transcript-content {
  color: @mrcall_dark_grey_text;
}

.call-audio {
  width: 100%;
  height: 40px;
}

.call-note {
  font-size: 13px;
  color: @mrcall_grey_text2;
}

.insight-fact {
  margin-bottom: 10px;

  dd {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.fact-reports {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: -4px 0 10px;
}

.fact-report {
  background: none;
  border: none;
  padding: 2px 4px;
  font-size: 13px;
  color: @mrcall_blue;
  text-decoration: underline;
  cursor: pointer;
}

.fact-reported {
  font-size: 13px;
  color: @mrcall_grey_text2;
}

.insight-assessed-tag {
  font-size: 11px;
  font-weight: 600;
}

.insight-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.insight-subtitle {
  margin: 10px 0 6px 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: @mrcall_grey_text2;
}

.insight-unanswered {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.insight-question {
  border-left: 3px solid @mrcall_salmon;
  padding-left: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.insight-question-reason {
  font-size: 12px;
  font-weight: 600;
  color: @mrcall_grey_text2;
}

.insight-question-text {
  margin: 0;
  font-size: 15px;
  color: @mrcall_dark_grey_text;
}

.insight-question-suggestion {
  margin: 0;
  font-size: 13px;
  color: @mrcall_grey_text;
}

.insight-unkept {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.insight-unkept-entry {
  border-left: 3px solid @mrcall_salmon;
  padding-left: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.insight-unkept-action {
  font-size: 12px;
  font-weight: 600;
  color: @mrcall_grey_text2;
}

.insight-unkept-said {
  margin: 0;
  font-size: 15px;
  font-style: italic;
  color: @mrcall_dark_grey_text;
  overflow-wrap: anywhere;
}

.insight-checks {
  list-style: disc;
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
  color: @mrcall_dark_grey_text;
}
</style>
