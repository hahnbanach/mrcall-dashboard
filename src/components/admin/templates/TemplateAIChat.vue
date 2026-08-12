<template>
  <div class="ai-chat-panel">
    <div class="ai-chat-header">
      <span class="ai-chat-title">{{ $t('components.admin.templates.aiChat') }}</span>
    </div>

    <div class="ai-chat-messages" ref="messagesContainer">
      <div v-if="messages.length === 0 && !loading" class="empty-state">
        <i class="pi pi-comments"></i>
        <span>{{ $t('components.admin.templates.aiChatPlaceholder') }}</span>
      </div>

      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message', msg.role === 'user' ? 'message-user' : 'message-assistant']"
      >
        <div class="message-bubble">
          <div class="message-text" v-html="formatText(msg.text)"></div>
          <div v-if="msg.role === 'assistant' && msg.extractedPrompt && isLastAssistant(index)" class="apply-action">
            <Button
              :label="$t('components.admin.templates.applyToPrompt')"
              icon="pi pi-check"
              size="small"
              severity="success"
              @click="$emit('apply-prompt', msg.extractedPrompt)"
            />
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

    <div class="ai-chat-input">
      <Textarea
        v-model="userMessage"
        :placeholder="$t('components.admin.templates.aiChatPlaceholder')"
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

const PROMPT_EDITOR_SYSTEM_PROMPT = `You are an expert AI prompt engineer. You help edit and improve system prompts for AI agents.

When the user asks you to modify a prompt, you MUST:
1. Output the complete updated prompt inside a <prompt> XML tag
2. Explain what you changed and why

When the user asks for feedback without requesting changes, provide analysis without the <prompt> tag.

The <prompt> tag allows the UI to extract the new prompt and offer an "Apply" button.

Rules:
- Preserve existing variable placeholders (\${VAR_NAME} format)
- Maintain the prompt's language (don't translate unless asked)
- Keep tool-specific instructions aligned with the available tools listed
- Be concise but thorough in your explanations`

export default {
  props: {
    currentPrompt: { type: String, default: '' },
    currentTools: { type: Array, default: () => [] },
    templateName: { type: String, default: '' }
  },
  emits: ['apply-prompt'],
  setup() {
    const store = useStore()
    return {
      store,
      user: computed(() => store.state.user)
    }
  },
  data() {
    return {
      userMessage: '',
      messages: [],
      loading: false,
      sessionId: 'tpl-editor-' + Date.now()
    }
  },
  methods: {
    isLastAssistant(index) {
      for (let i = this.messages.length - 1; i >= 0; i--) {
        if (this.messages[i].role === 'assistant') return i === index
      }
      return false
    },
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
    extractPrompt(text) {
      const match = text.match(/<prompt>([\s\S]*?)<\/prompt>/)
      return match ? match[1].trim() : null
    },
    stripPromptTag(text) {
      return text.replace(/<prompt>[\s\S]*?<\/prompt>/g, '').trim()
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
    async sendMessage() {
      const text = this.userMessage.trim()
      if (!text || this.loading) return

      this.messages.push({ role: 'user', text })
      this.userMessage = ''
      this.loading = true
      this.scrollToBottom()

      const toolsList = this.currentTools.length > 0 ? this.currentTools.join(', ') : 'none'
      const composedMessage = `Current system prompt:\n---\n${this.currentPrompt}\n---\nAvailable tools: ${toolsList}\n\nUser request: ${text}`

      try {
        const res = await AgentTemplatesApi.runAgent(this.user, {
          agentConfig: {
            name: "_prompt-editor",
            systemPrompt: PROMPT_EDITOR_SYSTEM_PROMPT,
            llmConfig: {
              provider: "openai",
              model: "gpt-4o",
              temperature: 0.7,
              maxTokens: 8192,
              timeoutSeconds: 120
            },
            tools: [],
            maxToolIterations: 1,
            requestTimeoutSeconds: 120
          },
          userMessage: composedMessage,
          sessionId: this.sessionId
        })

        const assistantText = res.data?.content || res.data?.response || res.data?.text || ''
        const extracted = this.extractPrompt(assistantText)
        const displayText = extracted ? this.stripPromptTag(assistantText) : assistantText

        this.messages.push({
          role: 'assistant',
          text: displayText,
          extractedPrompt: extracted
        })
      } catch (error) {
        console.error('AI chat error:', error)
        const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Request failed'
        this.messages.push({
          role: 'assistant',
          text: 'Error: ' + errMsg
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

.ai-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.ai-chat-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid @mrcall_borders;
  background: @mrcall_background;
}

.ai-chat-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: @mrcall_dark_grey_text;
}

.ai-chat-messages {
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

  :deep(strong) {
    font-weight: 600;
  }

  :deep(code) {
    background: rgba(0, 0, 0, 0.06);
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-family: monospace;
    font-size: 0.8rem;
  }
}

.apply-action {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid @mrcall_borders;
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

.ai-chat-input {
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
