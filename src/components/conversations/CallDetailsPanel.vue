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

    <section class="call-section">
      <audio v-if="audio" controls autoplay class="call-audio">
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
  props: {
    conversation: { type: Object, required: true },
    businessId: { type: String, required: true },
    user: { type: Object, required: true },
    expanded: { type: Boolean, default: false },
  },
  data() {
    return {
      showTranscript: this.expanded,
      showPrevious: this.expanded,
      audio: this.conversation.audio || null,
      recordingState: "idle",
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
    async loadRecording() {
      this.recordingState = "loading";
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
</style>
