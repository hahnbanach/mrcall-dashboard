<template>
  <div class="text-chat-widget" :class="{ 'chat-open': chatOpen }">
    <!-- Toggle button -->
    <Button
      :label="buttonLabel"
      :icon="buttonIcon"
      iconPos="right"
      :severity="buttonSeverity"
      :outlined="!chatOpen"
      :loading="connecting"
      :disabled="disabled"
      @click="toggleChat"
    />

    <!-- Chat panel (overlay) -->
    <div v-if="chatOpen" class="chat-panel">
      <div class="chat-header">
        <span class="chat-title">Chat — {{ businessId }}</span>
        <div class="chat-header-actions">
          <span v-if="sessionId" class="chat-session-id">{{ sessionId.substring(0, 12) }}...</span>
          <Button
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            @click="closeChat"
          />
        </div>
      </div>

      <div ref="messagesContainer" class="chat-messages">
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="chat-message"
          :class="msg.role"
        >
          <div class="chat-bubble">
            <span class="chat-text">{{ msg.text }}</span>
            <span class="chat-time">{{ msg.time }}</span>
          </div>
        </div>

        <!-- Typing indicator -->
        <div v-if="botTyping" class="chat-message bot">
          <div class="chat-bubble typing">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>

        <!-- Status messages -->
        <div v-if="statusMessage" class="chat-status">
          {{ statusMessage }}
        </div>
      </div>

      <div class="chat-input-area">
        <InputText
          ref="chatInput"
          v-model="inputText"
          class="chat-input"
          :placeholder="inputPlaceholder"
          :disabled="!connected || ended"
          @keyup.enter="sendMessage"
        />
        <Button
          icon="pi pi-send"
          severity="primary"
          :disabled="!inputText.trim() || !connected || ended"
          @click="sendMessage"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { auth } from '@/firebase/config'

const props = defineProps({
  businessId: { type: String, required: true },
  disabled:   { type: Boolean, default: false }
})

const emit = defineEmits(['chat-started', 'chat-ended', 'error'])

const toast = useToast()

const chatOpen = ref(false)
const connecting = ref(false)
const connected = ref(false)
const ended = ref(false)
const sessionId = ref(null)
const messages = ref([])
const inputText = ref('')
const botTyping = ref(false)
const statusMessage = ref(null)
const messagesContainer = ref(null)
const chatInput = ref(null)

let ws = null
let pingInterval = null
let unmounting = false
let pageUnloading = false

const buttonLabel = computed(() => {
  if (connecting.value) return 'Connecting...'
  if (chatOpen.value) return 'Chat'
  return 'Test chat'
})

const buttonIcon = computed(() => {
  if (connecting.value) return 'pi pi-spin pi-spinner'
  if (chatOpen.value) return 'pi pi-comments'
  return 'pi pi-comments'
})

const buttonSeverity = computed(() => {
  if (connecting.value) return 'warn'
  if (chatOpen.value) return 'info'
  return 'primary'
})

const inputPlaceholder = computed(() => {
  if (ended.value) return 'Session ended'
  if (!connected.value) return 'Connecting...'
  return 'Type a message...'
})

function formatTime() {
  const now = new Date()
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function addMessage(role, text) {
  messages.value.push({ role, text, time: formatTime() })
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function cleanup() {
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }
  if (ws) {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close()
    }
    ws = null
  }
}

function connectWs(token) {
  const baseUrl = process.env.VUE_APP_STARCHAT_URL
  const wsBase = baseUrl.replace(/^https:\/\//, '').replace(/^http:\/\//, '')
  const protocol = baseUrl.startsWith('https') ? 'wss' : 'ws'
  const wsUrl = `${protocol}://${wsBase}/mrcall/v1/mrcall0/text/stream?businessId=${encodeURIComponent(props.businessId)}&token=${encodeURIComponent(token)}`

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    connected.value = true
    connecting.value = false
    // Send initial ping to trigger server to send queued messages (sessionStarted, greeting)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }))
    }
    // Start ping interval
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 25000)
  }

  ws.onmessage = (event) => {
    if (typeof event.data !== 'string') return
    try {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'sessionStarted':
          sessionId.value = msg.sessionId
          emit('chat-started', msg.sessionId)
          break

        case 'greeting':
          botTyping.value = false
          if (msg.text) {
            addMessage('bot', msg.text)
          }
          break

        case 'botMessage':
          botTyping.value = false
          if (msg.text) {
            addMessage('bot', msg.text)
          }
          break

        case 'listenStarted':
          // Bot is waiting for input — no UI action needed
          break

        case 'sessionEnded':
          ended.value = true
          statusMessage.value = reasonLabel(msg.reason)
          if (!unmounting && !pageUnloading) {
            toast.add({ severity: 'info', summary: 'Chat ended', detail: msg.reason || '', life: 4000 })
          }
          emit('chat-ended', msg.reason)
          break

        case 'idleWarning':
          statusMessage.value = `Session will expire in ${Math.round((msg.remainingMs || 30000) / 1000)}s — send a message to stay connected`
          break

        case 'sessionResumed':
          statusMessage.value = null
          break

        case 'error':
          if (!unmounting && !pageUnloading) {
            toast.add({ severity: 'error', summary: 'Chat error', detail: msg.message, life: 6000 })
          }
          emit('error', msg.message)
          break

        case 'ping':
        case 'pong':
          break
      }
    } catch (e) {
      console.error('TextChat: failed to parse message', e)
    }
  }

  ws.onerror = (err) => {
    console.error('TextChat WebSocket error:', err)
    console.error('TextChat WebSocket readyState:', ws?.readyState, 'url:', wsUrl)
    connected.value = false
    connecting.value = false
    if (!unmounting && !pageUnloading) {
      toast.add({ severity: 'error', summary: 'Connection error', detail: 'WebSocket connection failed', life: 6000 })
    }
    emit('error', 'WebSocket connection failed')
    cleanup()
  }

  ws.onclose = (event) => {
    console.log('TextChat WebSocket closed:', event.code, event.reason, 'wasClean:', event.wasClean)
    if (ws === null) return
    connected.value = false
    if (!ended.value) {
      statusMessage.value = `Disconnected (code: ${event.code})`
    }
  }
}

function reasonLabel(reason) {
  switch (reason) {
    case 'client_hangup': return 'You ended the conversation'
    case 'idle_timeout': return 'Session expired due to inactivity'
    case 'hard_limit': return 'Session time limit reached'
    case 'hangup': return 'Conversation completed'
    default: return reason || 'Session ended'
  }
}

async function openChat() {
  if (connecting.value) return
  connecting.value = true
  chatOpen.value = true
  messages.value = []
  sessionId.value = null
  ended.value = false
  statusMessage.value = null
  botTyping.value = true

  try {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) throw new Error('Not authenticated')

    let token
    try {
      token = await firebaseUser.getIdToken(true)
    } catch (err) {
      console.error('Failed to get Firebase token:', err)
      throw new Error('Authentication failed — please reload the page', { cause: err })
    }

    connectWs(token)
  } catch (e) {
    connecting.value = false
    chatOpen.value = false
    botTyping.value = false
    cleanup()
    const msg = e?.message || String(e)
    if (!unmounting && !pageUnloading) {
      toast.add({ severity: 'error', summary: 'Error starting chat', detail: msg, life: 6000 })
    }
    emit('error', msg)
  }
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text || !ws || ws.readyState !== WebSocket.OPEN || ended.value) return

  addMessage('user', text)
  inputText.value = ''
  botTyping.value = true
  statusMessage.value = null

  ws.send(JSON.stringify({ type: 'message', text }))
}

function sendHangup() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'hangup' }))
  }
}

function closeChat() {
  if (connected.value && !ended.value) {
    sendHangup()
  }
  setTimeout(() => {
    chatOpen.value = false
    connected.value = false
    ended.value = false
    botTyping.value = false
    statusMessage.value = null
    cleanup()
  }, 300)
}

function toggleChat() {
  if (chatOpen.value) {
    closeChat()
  } else {
    openChat()
  }
}

// Focus input when chat opens
watch(chatOpen, (open) => {
  if (open) {
    nextTick(() => {
      chatInput.value?.$el?.focus()
    })
  }
})

const onPageExit = () => {
  pageUnloading = true
  sendHangup()
  cleanup()
}

onMounted(() => {
  window.addEventListener('beforeunload', onPageExit)
  window.addEventListener('pagehide', onPageExit, { capture: true })
})

onBeforeUnmount(() => {
  unmounting = true
  sendHangup()
  cleanup()
  window.removeEventListener('beforeunload', onPageExit)
  window.removeEventListener('pagehide', onPageExit, { capture: true })
})
</script>

<style scoped lang="less">
@import '../../assets/style/colors';

.text-chat-widget {
  position: relative;
  display: inline-block;
}

.chat-panel {
  position: fixed;
  bottom: 80px;
  right: 24px;
  width: 380px;
  max-width: calc(100vw - 48px);
  height: 520px;
  max-height: calc(100vh - 120px);
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: @mrcall_blue;
  color: @mrcall_white;
  flex-shrink: 0;
}

.chat-title {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-session-id {
  font-size: 11px;
  opacity: 0.7;
  font-family: monospace;
}

.chat-header :deep(.p-button) {
  color: @mrcall_white;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: @mrcall_light_grey_2;
}

.chat-message {
  display: flex;

  &.user {
    justify-content: flex-end;
  }

  &.bot {
    justify-content: flex-start;
  }
}

.chat-bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
  display: flex;
  flex-direction: column;
  gap: 2px;

  .user & {
    background: @mrcall_blue;
    color: @mrcall_white;
    border-bottom-right-radius: 4px;
  }

  .bot & {
    background: @mrcall_white;
    color: @mrcall_dark_grey_text;
    border: 1px solid @mrcall_borders;
    border-bottom-left-radius: 4px;
  }
}

.chat-text {
  white-space: pre-wrap;
}

.chat-time {
  font-size: 10px;
  opacity: 0.6;
  align-self: flex-end;
}

.chat-bubble.typing {
  display: flex;
  flex-direction: row;
  gap: 4px;
  padding: 12px 16px;
  align-items: center;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: @mrcall_grey_text2;
  animation: typing-bounce 1.4s infinite ease-in-out;

  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; }
}

@keyframes typing-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-4px); opacity: 1; }
}

.chat-status {
  text-align: center;
  font-size: 11px;
  color: @mrcall_grey_text2;
  padding: 4px 8px;
  font-style: italic;
}

.chat-input-area {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid @mrcall_borders;
  background: @mrcall_white;
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  font-size: 13px;
}
</style>
