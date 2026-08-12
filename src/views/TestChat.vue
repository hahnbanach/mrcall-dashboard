<template>
  <div class="test-chat-page">
    <div v-if="!businessId" class="no-business">
      <p>Missing business ID. Use <code>/testchat?id=BUSINESS_ID</code></p>
    </div>
    <div v-else class="chat-container">
      <div class="chat-header-bar">
        <span class="chat-business-id">{{ businessId }}</span>
        <Button
          v-if="ended"
          label="Restart"
          icon="pi pi-refresh"
          severity="secondary"
          size="small"
          @click="restartChat"
        />
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
        <div v-if="botTyping" class="chat-message bot">
          <div class="chat-bubble typing">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
        <div v-if="statusMessage" class="chat-status">{{ statusMessage }}</div>
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
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { auth } from '@/firebase/config'

const route = useRoute()
const businessId = computed(() => route.query.id || '')

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

const inputPlaceholder = computed(() => {
  if (ended.value) return 'Session ended — click Restart'
  if (!connected.value) return 'Connecting...'
  return 'Type a message...'
})

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

async function connectWebSocket() {
  if (ws) closeWebSocket()
  if (!businessId.value) return

  connecting.value = true
  statusMessage.value = 'Connecting...'

  try {
    const user = auth.currentUser
    if (!user) {
      statusMessage.value = 'Not authenticated'
      connecting.value = false
      return
    }
    const token = await user.getIdToken()
    const baseUrl = process.env.VUE_APP_STARCHAT_URL || ''
    const wsBase = baseUrl.replace(/^https:\/\//, '').replace(/^http:\/\//, '')
    const protocol = baseUrl.startsWith('https') ? 'wss' : 'ws'
    const wsUrl = `${protocol}://${wsBase}/mrcall/v1/mrcall0/text/stream?businessId=${encodeURIComponent(businessId.value)}&token=${encodeURIComponent(token)}`

    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      connecting.value = false
      connected.value = true
      statusMessage.value = null
      // Send initial ping to trigger server to send queued messages (sessionStarted, greeting)
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
      }
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 25000)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleMessage(data)
      } catch (e) {
        console.warn('WS parse error:', e)
      }
    }

    ws.onerror = () => {
      statusMessage.value = 'Connection error'
      connecting.value = false
    }

    ws.onclose = (event) => {
      connected.value = false
      if (!unmounting) {
        if (!ended.value) {
          statusMessage.value = `Disconnected (${event.code})`
        }
      }
      if (pingInterval) { clearInterval(pingInterval); pingInterval = null }
    }
  } catch (e) {
    statusMessage.value = 'Connection failed: ' + e.message
    connecting.value = false
  }
}

function handleMessage(data) {
  switch (data.type) {
    case 'sessionStarted':
      sessionId.value = data.sessionId || null
      break
    case 'greeting':
    case 'botMessage':
      botTyping.value = false
      if (data.text) {
        messages.value.push({ role: 'bot', text: data.text, time: formatTime() })
        scrollToBottom()
      }
      break
    case 'listenStarted':
      botTyping.value = false
      break
    case 'sessionEnded':
      ended.value = true
      botTyping.value = false
      statusMessage.value = 'Session ended'
      break
    case 'idleWarning':
      statusMessage.value = 'Session idle — send a message to keep it alive'
      break
    case 'error':
      statusMessage.value = 'Error: ' + (data.message || 'Unknown')
      break
  }
}

function sendMessage() {
  if (!inputText.value.trim() || !connected.value || ended.value) return

  const text = inputText.value.trim()
  messages.value.push({ role: 'user', text, time: formatTime() })
  inputText.value = ''
  botTyping.value = true
  scrollToBottom()

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'message', text }))
  }
}

function closeWebSocket() {
  if (pingInterval) { clearInterval(pingInterval); pingInterval = null }
  if (ws) {
    try { ws.close() } catch (e) { /* ignore */ }
    ws = null
  }
}

function restartChat() {
  closeWebSocket()
  messages.value = []
  ended.value = false
  connected.value = false
  statusMessage.value = null
  sessionId.value = null
  botTyping.value = false
  connectWebSocket()
}

onMounted(() => {
  if (businessId.value) {
    // Wait for Firebase auth state to be ready before connecting
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe()
      if (user) {
        connectWebSocket()
      } else {
        statusMessage.value = 'Not authenticated — please log in first'
      }
    })
  }
})

watch(businessId, (val) => {
  if (val) {
    restartChat()
  }
})

onBeforeUnmount(() => {
  unmounting = true
  closeWebSocket()
})
</script>

<style scoped>
.test-chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 700px;
  margin: 0 auto;
  padding: 1rem;
}

.no-business {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.chat-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.85rem;
  color: #666;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-message {
  display: flex;
}
.chat-message.user {
  justify-content: flex-end;
}
.chat-message.bot {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 75%;
  padding: 0.6rem 0.9rem;
  border-radius: 12px;
  position: relative;
}
.chat-message.user .chat-bubble {
  background: #007bff;
  color: #fff;
  border-bottom-right-radius: 4px;
}
.chat-message.bot .chat-bubble {
  background: #f0f0f0;
  color: #333;
  border-bottom-left-radius: 4px;
}

.chat-text {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-time {
  display: block;
  font-size: 0.7rem;
  opacity: 0.6;
  margin-top: 0.2rem;
  text-align: right;
}

.chat-bubble.typing {
  display: flex;
  gap: 4px;
  padding: 0.8rem 1rem;
}
.chat-bubble.typing .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
  animation: typing 1.2s infinite ease-in-out;
}
.chat-bubble.typing .dot:nth-child(2) { animation-delay: 0.2s; }
.chat-bubble.typing .dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}

.chat-status {
  text-align: center;
  font-size: 0.8rem;
  color: #999;
  padding: 0.3rem;
}

.chat-input-area {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid #e0e0e0;
  background: #fafafa;
}

.chat-input {
  flex: 1;
}
</style>
