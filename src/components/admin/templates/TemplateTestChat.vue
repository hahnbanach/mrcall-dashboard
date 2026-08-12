<template>
  <div class="test-chat-panel">
    <div class="test-chat-header">
      <span class="test-chat-title">{{ $t('components.admin.templates.testChat') }}</span>
      <Button
        v-if="messages.length > 0"
        icon="pi pi-refresh"
        text size="small"
        @click="clearChat"
      />
    </div>

    <div class="test-chat-messages" ref="messagesContainer">
      <div v-if="messages.length === 0 && !loading" class="empty-state">
        <i class="pi pi-play"></i>
        <span>{{ $t('components.admin.templates.testPlaceholder') }}</span>
      </div>

      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message', msg.role === 'user' ? 'message-user' : 'message-assistant']"
      >
        <div class="message-bubble">
          <div class="message-text" v-html="formatText(msg.text)"></div>
          <div v-if="msg.meta" class="message-meta">
            <span v-if="msg.meta.totalToolCalls > 0" class="meta-item">
              <i class="pi pi-cog"></i> {{ msg.meta.totalToolCalls }} tool{{ msg.meta.totalToolCalls > 1 ? 's' : '' }}
            </span>
            <span v-if="msg.meta.elapsedMs" class="meta-item">
              <i class="pi pi-clock"></i> {{ (msg.meta.elapsedMs / 1000).toFixed(1) }}s
            </span>
          </div>
        </div>
      </div>

      <div v-if="loading" class="message message-assistant">
        <div class="message-bubble loading-bubble">
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>

    <div class="test-chat-input">
      <Textarea
        v-model="userMessage"
        :placeholder="$t('components.admin.templates.testPlaceholder')"
        :disabled="loading"
        rows="1"
        autoResize
        class="chat-input"
        @keydown="onKeydown"
      />
      <Button
        icon="pi pi-send"
        class="send-button"
        :loading="loading"
        :disabled="!userMessage.trim() || loading"
        @click="sendMessage"
      />
    </div>
  </div>
</template>

<script>
import { computed, nextTick } from 'vue'
import { useStore } from 'vuex'
import AgentTemplatesApi from '@/utils/AgentTemplates'

export default {
  props: {
    agentConfig: { type: Object, required: true },
    businessId: { type: String, default: '' }
  },
  setup() {
    const store = useStore()
    return {
      user: computed(() => store.state.user)
    }
  },
  data() {
    return {
      userMessage: '',
      messages: [],
      loading: false,
      sessionId: 'tpl-test-' + Date.now()
    }
  },
  methods: {
    formatText(text) {
      if (!text) return ''
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
      return html
    },
    scrollToBottom() {
      nextTick(() => {
        if (this.$refs.messagesContainer) {
          this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight
        }
      })
    },
    onKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        this.sendMessage()
      }
    },
    clearChat() {
      this.messages = []
      this.sessionId = 'tpl-test-' + Date.now()
    },
    async sendMessage() {
      const text = this.userMessage.trim()
      if (!text || this.loading) return

      this.messages.push({ role: 'user', text })
      this.userMessage = ''
      this.loading = true
      this.scrollToBottom()

      try {
        const res = await AgentTemplatesApi.testAgent(this.user, {
          agentConfig: this.agentConfig,
          userMessage: text,
          sessionId: this.sessionId,
          businessId: this.businessId || undefined
        })

        const data = res.data || {}
        this.messages.push({
          role: 'assistant',
          text: data.content || data.response || data.text || '',
          meta: {
            totalToolCalls: data.totalToolCalls || 0,
            elapsedMs: data.elapsedMs || null
          }
        })
      } catch (error) {
        console.error('Test chat error:', error)
        this.messages.push({
          role: 'assistant',
          text: 'Error: ' + (error.response?.data?.error || error.response?.data?.message || error.message || 'Request failed')
        })
      } finally {
        this.loading = false
        this.scrollToBottom()
      }
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../../assets/style/colors';

.test-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.test-chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid @mrcall_borders;
  background: @mrcall_background;
}

.test-chat-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: @mrcall_dark_grey_text;
}

.test-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-height: 200px;
  max-height: 50vh;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: @mrcall_grey_text;
  font-size: 0.85rem;
  text-align: center;

  i {
    font-size: 2rem;
    opacity: 0.5;
  }
}

.message {
  display: flex;
}

.message-user {
  justify-content: flex-end;
}

.message-assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 90%;
  padding: 0.6rem 0.85rem;
  border-radius: 12px;
  font-size: 0.85rem;
  line-height: 1.5;
}

.message-user .message-bubble {
  background: @mrcall_blue;
  color: @mrcall_white;
  border-bottom-right-radius: 4px;
}

.message-assistant .message-bubble {
  background: @mrcall_background;
  color: @mrcall_dark_grey_text;
  border: 1px solid @mrcall_borders;
  border-bottom-left-radius: 4px;
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;

  :deep(strong) { font-weight: 600; }
  :deep(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.8rem;
  }
}

.message-meta {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid @mrcall_borders;
}

.meta-item {
  font-size: 0.7rem;
  color: @mrcall_grey_text;
  display: flex;
  align-items: center;
  gap: 0.2rem;

  i { font-size: 0.65rem; }
}

.loading-bubble {
  padding: 0.75rem 1.25rem;
}

.typing-indicator {
  display: flex;
  gap: 0.3rem;
  align-items: center;

  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: @mrcall_grey_text;
    animation: typing 1.2s ease-in-out infinite;
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1); }
}

.test-chat-input {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  padding: 0.75rem;
  border-top: 1px solid @mrcall_borders;
}

.chat-input {
  flex: 1;
  min-height: 2.5rem !important;
  max-height: 6rem;
}

.send-button {
  flex-shrink: 0;
  height: 2.5rem;
  width: 2.5rem;
}
</style>
