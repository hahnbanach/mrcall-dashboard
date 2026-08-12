<template>
  <div class="zylch-chat-container">
    <!-- Chat Messages Area -->
    <div class="chat-messages" ref="messagesContainer">
      <!-- Welcome message -->
      <div v-if="messages.length === 0" class="welcome-message">
        <i class="pi pi-comments" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
        <h3>{{ $t('components.zylchChat.welcome') }}</h3>
        <p>{{ $t('components.zylchChat.welcomeDescription') }}</p>
      </div>

      <!-- Message List -->
      <div v-for="(msg, index) in messages" :key="msg.id || index"
           :class="['message-wrapper', msg.role]">
        <div class="message-bubble">
          <div class="message-header">
            <i :class="msg.role === 'user' ? 'pi pi-user' : msg.role === 'system' ? 'pi pi-spin pi-spinner' : 'pi pi-android'"></i>
            <span class="message-role">{{ msg.role === 'user' ? 'You' : msg.role === 'system' ? '' : 'Zylch AI' }}</span>
            <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div v-if="msg.content" class="message-content" v-html="formatMessage(msg.content)"></div>
          <!-- Liveness line: backend progress event while no content has streamed yet. -->
          <div v-if="msg.streaming && !msg.content && msg.progress" class="message-progress">
            <i class="pi pi-spin pi-spinner"></i>
            <span>{{ msg.progress }}</span>
          </div>
        </div>
      </div>

      <!-- Typing Indicator (hidden when streaming text is already visible) -->
      <div v-if="isProcessing && !messages.some(m => m.streaming)" class="message-wrapper assistant">
        <div class="message-bubble typing-indicator">
          <div class="message-header">
            <i class="pi pi-android"></i>
            <span class="message-role">Zylch AI</span>
          </div>
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="errorMessage" class="error-banner">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ errorMessage }}</span>
        <Button icon="pi pi-times" text @click="errorMessage = null" />
      </div>
    </div>

    <!-- Chat Input Area -->
    <div class="chat-input-container">
      <!-- Attachment Preview -->
      <div v-if="attachments.length > 0" class="attachments-preview">
        <div v-for="(att, i) in attachments" :key="i" class="attachment-chip">
          <i :class="getAttachmentIcon(att.type)"></i>
          <span class="attachment-name">{{ att.name }}</span>
          <Button icon="pi pi-times" text rounded severity="secondary" size="small"
                  @click="removeAttachment(i)" class="attachment-remove" />
        </div>
      </div>

      <div class="input-wrapper">
        <textarea
          ref="textareaRef"
          v-model="currentMessage"
          @keydown="handleKeydown"
          @input="autoResize"
          :placeholder="$t('components.zylchChat.inputPlaceholder')"
          :disabled="isProcessing || disabled"
          class="message-input"
          rows="1"
        ></textarea>
        <div class="input-actions">
          <input type="file" ref="fileInput" @change="handleFileSelect" :accept="ACCEPTED_TYPES" hidden multiple />
          <Button
            icon="pi pi-paperclip"
            text rounded
            @click="$refs.fileInput.click()"
            :disabled="isProcessing || disabled"
            class="attach-button"
            v-tooltip.top="'Allega file (PDF, immagini, testo)'"
          />
          <Button
            icon="pi pi-send"
            @click="sendMessage"
            :disabled="isProcessing || disabled || (!currentMessage.trim() && attachments.length === 0)"
            :loading="isProcessing"
            class="send-button"
          />
        </div>
      </div>

      <!-- Session Info -->
      <div v-if="sessionId" class="session-info">
        <small>Session: {{ sessionId }}</small>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import Button from 'primevue/button';
import Tooltip from 'primevue/tooltip';
import ZylchAPI from '@/utils/Zylch.js';

// Max 20MB per file (Anthropic API limit)
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = 'application/pdf,image/png,image/jpeg,image/gif,image/webp,text/plain,text/csv,text/html';

export default {
  name: 'ZylchChat',
  components: {
    Button
  },
  directives: {
    tooltip: Tooltip
  },
  props: {
    messageTransformer: {
      type: Function,
      default: null
    },
    initialSessionId: {
      type: String,
      default: null
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['pending-changes'],
  setup(props, { emit }) {
    const store = useStore();
    const user = computed(() => store.state.user);

    const messages = ref([]);
    const currentMessage = ref('');
    const isProcessing = ref(false);
    const errorMessage = ref(null);
    const sessionId = ref(null);
    const messagesContainer = ref(null);
    const textareaRef = ref(null);
    const fileInput = ref(null);
    const attachments = ref([]);

    // Load conversation history on mount
    onMounted(async () => {
      await loadHistory();
      await nextTick();
      scrollToBottom();
    });

    // Auto-scroll to bottom when messages change
    watch(messages, async () => {
      await nextTick();
      scrollToBottom();
    }, { deep: true });

    const loadHistory = async () => {
      try {
        // Use initialSessionId prop to scope chat per business (if provided)
        const sid = props.initialSessionId || null;
        const response = await ZylchAPI.getHistory(user.value, sid);
        if (response.success && response.messages.length > 0) {
          messages.value = response.messages;
          sessionId.value = response.session_id;
        } else if (sid) {
          // No history yet for this business — set sessionId so first message creates it
          sessionId.value = sid;
        }
        // Rehydrate pending_changes so the Save changes bar survives a
        // tab switch / reload. Server merges per-turn dry-run deltas into
        // mrcall_chat_sessions.pending_changes; ConfigureAIPanel listens.
        if (response.pending_changes && response.pending_changes.length > 0) {
          emit('pending-changes', response.pending_changes);
        }
      } catch (error) {
        console.error('Error loading history:', error);
        // Don't show error for empty history
        if (error.response?.status !== 404) {
          errorMessage.value = 'Failed to load conversation history';
        }
        // Still set sessionId from prop so messages go to the right session
        if (props.initialSessionId) {
          sessionId.value = props.initialSessionId;
        }
      }
    };

    const handleKeydown = (e) => {
      // Enter sends, Shift+Enter adds newline
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };

    const autoResize = () => {
      const el = textareaRef.value;
      if (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
      }
    };

    const handleFileSelect = async (event) => {
      const files = Array.from(event.target.files || []);
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          errorMessage.value = `File "${file.name}" too large (max 20MB)`;
          continue;
        }
        const base64 = await fileToBase64(file);
        attachments.value.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64,
        });
      }
      // Reset input so same file can be re-selected
      event.target.value = '';
    };

    const fileToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // Strip data:...;base64, prefix — backend expects raw base64
          const result = reader.result.split(',')[1];
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    const removeAttachment = (index) => {
      attachments.value.splice(index, 1);
    };

    const getAttachmentIcon = (mimeType) => {
      if (mimeType === 'application/pdf') return 'pi pi-file-pdf';
      if (mimeType.startsWith('image/')) return 'pi pi-image';
      return 'pi pi-file';
    };

    const sendMessage = async (options = {}) => {
      const { silent = false, hideResponse = false } = options;

      if ((!currentMessage.value.trim() && attachments.value.length === 0) || isProcessing.value) {
        return;
      }

      const messageText = currentMessage.value.trim();
      const messageAttachments = [...attachments.value];
      currentMessage.value = '';
      attachments.value = [];
      errorMessage.value = null;

      // Reset textarea height
      if (textareaRef.value) {
        textareaRef.value.style.height = 'auto';
      }

      // Wrap user message for the API (if transformer set and not a slash command)
      const apiText = (!silent && props.messageTransformer && !messageText.startsWith('/'))
        ? props.messageTransformer(messageText)
        : messageText;

      // Build display text for UI (show attachment names)
      let displayText = messageText;
      if (messageAttachments.length > 0) {
        const names = messageAttachments.map(a => a.name).join(', ');
        displayText = messageText
          ? `${messageText}\n📎 ${names}`
          : `📎 ${names}`;
      }

      // Add user message to UI immediately (unless silent)
      const userMessage = {
        role: 'user',
        content: displayText,
        timestamp: new Date().toISOString()
      };
      if (!silent) {
        messages.value.push(userMessage);
      }

      // Set processing state
      isProcessing.value = true;

      // Add empty assistant message placeholder for streaming
      // Use reactive() so Vue tracks property changes (content += text)
      // without needing to replace the object in the array.
      // `progress` carries the latest liveness text from backend
      // (Thinking…, Searching the web…, heartbeat dot). The template
      // renders it as an italicised line while content is empty; it
      // clears as soon as any text arrives.
      const assistantMessage = reactive({
        role: 'assistant',
        content: '',
        progress: '',
        timestamp: new Date().toISOString(),
        streaming: true,
      });
      if (!hideResponse) {
        messages.value.push(assistantMessage);
      }

      try {
        // Use streaming SSE for real-time text delivery
        await new Promise((resolve, reject) => {
          ZylchAPI.sendMessageStream(
            user.value,
            apiText,
            {
              onProgress: (_phase, text) => {
                assistantMessage.progress = text;
              },
              onTextDelta: (text) => {
                // Append text incrementally — reactive() auto-triggers Vue updates
                assistantMessage.progress = '';
                assistantMessage.content += text;
              },
              onTextReplace: (text) => {
                // Replace entire content with properly decoded text (fixes JSON escapes)
                assistantMessage.progress = '';
                assistantMessage.content = text;
              },
              onToolResult: (toolUsed, result) => {
                assistantMessage.progress = '';
                if (toolUsed && toolUsed.startsWith('configure_')) {
                  // Dry-run: a configure_* result is a PROPOSED change, applied
                  // only when the user clicks Save. Never assert "updated" — the
                  // backend response_text already speaks in pending/Save terms;
                  // the fallback must too (avoids the "says it saved but didn't" lie).
                  const responseText = result?.response_text || `${toolUsed.replace('configure_', '').replace('_', ' ')} change ready — click Save to apply`;
                  assistantMessage.content += (assistantMessage.content ? '\n\n' : '') + '📝 ' + responseText;
                }
              },
              onMetadata: (metadata) => {
                // Emit pending changes to parent
                if (metadata?.pending_changes) {
                  emit('pending-changes', metadata.pending_changes);
                }
              },
              onError: (message) => {
                assistantMessage.progress = '';
                reject(new Error(message));
              },
              onDone: (sid) => {
                if (sid) sessionId.value = sid;
                assistantMessage.progress = '';
                assistantMessage.streaming = false;
                resolve();
              },
            },
            sessionId.value,
            messageAttachments.length > 0 ? messageAttachments : null
          );
        });

      } catch (error) {
        console.error('Error sending message:', error);

        // Show error in assistant message or as error banner
        if (assistantMessage.content) {
          assistantMessage.content += '\n\n❌ ' + (error.message || 'Connection lost');
          assistantMessage.streaming = false;
        } else {
          // No content was streamed — remove placeholder, show error
          if (!hideResponse) {
            messages.value.pop();
          }
          errorMessage.value = error.message || 'Failed to send message. Please try again.';

          // Restore message and attachments to input
          currentMessage.value = messageText;
          attachments.value = messageAttachments;
        }
      } finally {
        isProcessing.value = false;
      }
    };

    const scrollToBottom = () => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    };

    const formatTime = (timestamp) => {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      const now = new Date();

      // If today, show only time
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      // Otherwise show date + time
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatMessage = (content) => {
      if (!content) return '';

      // 1. Protect code blocks first - replace with placeholders
      // Using <<>> instead of __ __ to avoid collision with bold regex
      const codeBlocks = [];
      let formatted = content.replace(/`([^`]+)`/g, (match, code) => {
        codeBlocks.push(code);
        return `<<CODE_BLOCK_${codeBlocks.length - 1}>>`;
      });

      // 2. Convert line breaks to <br>
      formatted = formatted.replace(/\n/g, '<br>');

      // 3. Bold: **text** or __text__
      formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');

      // 4. Italic: *text* only (NOT underscore - causes issues with variable names like welcome_message)
      formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      // REMOVED underscore italic: /_(.+?)_/g - breaks variable names

      // 5. Restore code blocks
      formatted = formatted.replace(/<<CODE_BLOCK_(\d+)>>/g, (match, index) => {
        return `<code>${codeBlocks[parseInt(index)]}</code>`;
      });

      // 6. Checkmarks and X marks
      formatted = formatted.replace(/✅/g, '<span class="success-icon">✅</span>');
      formatted = formatted.replace(/❌/g, '<span class="error-icon">❌</span>');

      return formatted;
    };

    // Send message silently (no UI display for user message)
    const sendSilent = (message, options = {}) => {
      currentMessage.value = message;
      return sendMessage({ silent: true, ...options });
    };

    // Add a system-level status message to the chat
    const addSystemMessage = (text, id = null) => {
      const msg = {
        role: 'system',
        content: text,
        timestamp: new Date().toISOString(),
        id: id || `sys_${Date.now()}`
      };
      messages.value.push(msg);
      return msg.id;
    };

    // Remove a system message by its id
    const removeSystemMessage = (id) => {
      const index = messages.value.findIndex(m => m.id === id);
      if (index !== -1) {
        messages.value.splice(index, 1);
      }
    };

    // Update a system message's text by its id
    const updateSystemMessage = (id, text) => {
      const msg = messages.value.find(m => m.id === id);
      if (msg) {
        msg.content = text;
      }
    };

    return {
      messages,
      currentMessage,
      isProcessing,
      errorMessage,
      sessionId,
      messagesContainer,
      textareaRef,
      fileInput,
      attachments,
      ACCEPTED_TYPES,
      sendMessage,
      sendSilent,
      handleKeydown,
      autoResize,
      handleFileSelect,
      removeAttachment,
      getAttachmentIcon,
      addSystemMessage,
      removeSystemMessage,
      updateSystemMessage,
      formatTime,
      formatMessage
    };
  }
};
</script>

<style scoped lang="less">
@import '../assets/style/colors';

.zylch-chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
  max-width: 1200px;
  margin: 0 auto;
  background: var(--surface-card);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.welcome-message {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--text-color-secondary);
}

.welcome-message h3 {
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.command-examples {
  margin-top: 2rem;
  text-align: left;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  background: var(--surface-ground);
  padding: 1.5rem;
  border-radius: 8px;
}

.command-examples ul {
  list-style: none;
  padding: 0;
  margin-top: 1rem;
}

.command-examples li {
  padding: 0.5rem 0;
}

.command-examples code {
  background: var(--surface-card);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  color: var(--primary-color);
}

.message-wrapper {
  display: flex;
  margin-bottom: 0.5rem;
}

.message-wrapper.user {
  justify-content: flex-end;
}

.message-wrapper.assistant {
  justify-content: flex-start;
}

.message-wrapper.system {
  justify-content: center;
}

.message-wrapper.system .message-bubble {
  background: var(--surface-hover, var(--surface-ground));
  max-width: 80%;
  text-align: center;
  font-style: italic;
  color: var(--text-color-secondary);
  border: 1px dashed var(--surface-border);
}

.message-wrapper.system .message-header {
  justify-content: center;
}

.message-wrapper.system .message-time {
  display: none;
}

.message-bubble {
  max-width: 70%;
  padding: 1rem;
  border-radius: 12px;
  background: var(--surface-ground);
}

.message-wrapper.user .message-bubble {
  background: @mrcall_teal;
  color: white;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  opacity: 0.8;
}

.message-header i {
  font-size: 1rem;
}

.message-role {
  font-weight: 600;
}

.message-time {
  margin-left: auto;
  font-size: 0.75rem;
}

.message-content {
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message-progress {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-style: italic;
  opacity: 0.75;
  font-size: 0.9em;

  i.pi-spinner {
    font-size: 0.85em;
  }
}

.message-content :deep(code) {
  background: rgba(0, 0, 0, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.message-wrapper.user .message-content :deep(code) {
  background: rgba(255, 255, 255, 0.2);
}

.typing-indicator {
  background: var(--surface-ground);
}

.typing-dots {
  display: flex;
  gap: 0.25rem;
  padding: 0.5rem 0;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-color-secondary);
  animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--red-100);
  color: var(--red-900);
  border-radius: 8px;
  margin-top: 1rem;
}

.error-banner i {
  font-size: 1.5rem;
}

.chat-input-container {
  padding: 1.5rem;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-card);
}

.attachments-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.attachment-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.5rem;
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 16px;
  font-size: 0.85rem;
}

.attachment-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-remove {
  width: 1.2rem !important;
  height: 1.2rem !important;
}

.input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.message-input {
  flex: 1;
  resize: none;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.5;
  background: var(--surface-ground);
  color: var(--text-color);
  outline: none;
  min-height: 2.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.message-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 1px var(--primary-color);
}

.message-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.attach-button {
  color: var(--text-color-secondary);
}

.send-button {
  flex-shrink: 0;
}

.session-info {
  margin-top: 0.5rem;
  text-align: center;
  color: var(--text-color-secondary);
}

.success-icon {
  color: var(--green-500);
}

.error-icon {
  color: var(--red-500);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .zylch-chat-container {
    height: calc(100vh - 150px);
  }

  .message-bubble {
    max-width: 85%;
  }

  .chat-messages {
    padding: 1rem;
  }

  .command-examples {
    padding: 1rem;
  }
}
</style>
