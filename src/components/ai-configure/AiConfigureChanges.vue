<script setup>
import { ref, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  messages: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['quick-reply'])

const messagesContainer = ref(null)

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(() => props.messages.length, scrollToBottom)
watch(() => props.loading, scrollToBottom)

/** Check if this assistant message contains a preview (called previewChanges tool) */
function isPreviewMessage(msg) {
  if (msg.role !== 'assistant' || !msg.meta?.toolCallsMade) return false
  return msg.meta.toolCallsMade.includes('aladmin_previewChanges') &&
    !msg.meta.toolCallsMade.includes('aladmin_applyChanges')
}

/** Check if this is the last assistant message (for showing action buttons) */
function isLastAssistantMessage(index) {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    if (props.messages[i].role === 'assistant') return i === index
  }
  return false
}

function confirmChanges() {
  emit('quick-reply', t('views.aladminConfigurator.confirmApply'))
}

function cancelChanges() {
  emit('quick-reply', t('views.aladminConfigurator.cancelApply'))
}

/** Format text with basic markdown-like rendering (bold, code blocks) */
function formatText(text) {
  if (!text) return ''
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Inline code: `text`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  return html
}
</script>

<template>
  <div class="ai-configure-messages" ref="messagesContainer">
    <div v-if="messages.length === 0 && !loading" class="empty-state">
      <i class="pi pi-comments"></i>
      <span>{{ t('views.aladminConfigurator.emptyChat') }}</span>
    </div>

    <div
      v-for="(msg, index) in messages"
      :key="index"
      :class="['message', msg.role === 'user' ? 'message-user' : 'message-assistant']"
    >
      <div :class="['message-bubble', { 'preview-bubble': isPreviewMessage(msg) }]">
        <div v-if="isPreviewMessage(msg)" class="preview-badge">
          <i class="pi pi-eye"></i> {{ t('views.aladminConfigurator.previewLabel') }}
        </div>
        <div class="message-text" v-html="formatText(msg.text)"></div>
        <div v-if="msg.role === 'assistant' && msg.meta" class="message-meta">
          <span v-if="msg.meta.totalToolCalls > 0" class="meta-item">
            <i class="pi pi-cog"></i> {{ msg.meta.totalToolCalls }} tool{{ msg.meta.totalToolCalls > 1 ? 's' : '' }}
          </span>
          <span v-if="msg.meta.elapsedMs" class="meta-item">
            <i class="pi pi-clock"></i> {{ (msg.meta.elapsedMs / 1000).toFixed(1) }}s
          </span>
        </div>
        <div v-if="isPreviewMessage(msg) && isLastAssistantMessage(index) && !loading" class="preview-actions">
          <Button
            :label="t('views.aladminConfigurator.applyChanges')"
            icon="pi pi-check"
            size="small"
            severity="success"
            @click="confirmChanges"
          />
          <Button
            :label="t('views.aladminConfigurator.cancelChanges')"
            icon="pi pi-times"
            size="small"
            outlined
            severity="secondary"
            @click="cancelChanges"
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
</template>

<style scoped lang="less">
@import '../../assets/style/colors';

.ai-configure-messages {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 60vh;
  overflow-y: auto;
  padding: 0.5rem 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: @mrcall_grey_text;
  font-size: 0.9rem;

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
  max-width: 85%;
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

.preview-bubble {
  border-color: #e8a838 !important;
  border-width: 1.5px !important;
  background: #fffbf0 !important;
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: #c47d10;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 0.4rem;

  i { font-size: 0.7rem; }
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px solid #e8a838;
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

  i {
    font-size: 0.65rem;
  }
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

@media screen and (max-width: 480px) {
  .message-bubble {
    max-width: 95%;
  }
}
</style>
