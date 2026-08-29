<template>
  <Button
    :label="inCall ? labelHangup : labelCall"
    :icon="inCall ? 'pi pi-times-circle' : 'pi pi-phone'"
    iconPos="right"
    :severity="inCall ? 'danger' : 'primary'"
    :outlined="!inCall"
    :loading="processing"
    :disabled="disabled || (processing && !inCall)"
    :class="{ 'in-call-active': inCall && !processing }"
    @click="handleClick"
  />
  <MicPermissionDialog v-model:visible="micDialogVisible" :kind="micDialogKind" />
</template>

<script setup>
import { ref, computed, shallowRef, markRaw, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import MrCallWebCall from '/public/MrCallWebCall.bundle.js'
import MicPermissionDialog from './MicPermissionDialog.vue'
import { classifyVoiceError } from '@/utils/voiceErrors'

/* ---------------- props / emits ---------------------------------------- */
const props = defineProps({
  /* required */
  businessId: { type: String, required: true },

  /* optional auth */
  authtoken:  { type: String, default: '' },
  username:   { type: String, default: '' },
  password:   { type: String, default: '' },

  /* optional user id (defaults to businessId) */
  userid:     { type: String, default: '' },

  /* button labels & state */
  labelCall:   { type: String, default: 'Call'   },
  labelHangup: { type: String, default: 'Hangup' },
  disabled:    { type: Boolean, default: false   }
})

const emit = defineEmits([
  'call-started',           // (callId)
  'call-answered',          // (callId, legId)
  'call-ended',             // (callId, reason, callQuality)
  'error'                   // (message)
])

/* ---------------- data / state ----------------------------------------- */
const toast       = useToast()
const client      = shallowRef(null)
const callId      = ref(null)
const dialing     = ref(false)     // becomes true as soon as we start dialling
const processing  = ref(false)     // true while awaiting async op
const unmounting  = ref(false)     // becomes true during component teardown
const pageUnloading = ref(false)   // becomes true when the tab/page is leaving

// Mic failures open a modal popup instead of a raw toast. `kind` selects which
// localized body the dialog shows (micDenied vs micNotFound).
const micDialogVisible = ref(false)
const micDialogKind   = ref('micDenied')

/* A start failure can surface both in `onSessionError` and in the `startCall`
 * catch (same double-fire shape as DirectVoiceButton). The catch owns surfacing
 * start failures — it can open the mic dialog — so `onSessionError` skips its
 * toast when this duplicates a start failure. `startInFlight` covers the real
 * ordering; `lastStartError` is a < 2 s message-match backstop. */
let startInFlight = false
let lastStartError = null

/* the button is considered “in a call” while dialling or after callId is set */
const inCall = computed(() => dialing.value || !!callId.value)

/* ---------------- helpers ------------------------------------------------ */
function buildClientIfNeeded () {
  if (client.value) return

  const cfg = {
    business : props.businessId,
    userid   : props.userid || props.businessId,
    baseUrl  : process.env.VUE_APP_STARCHAT_URL
  }
  if (props.authtoken) cfg.authtoken = props.authtoken
  if (props.username)  cfg.username  = props.username
  if (props.password)  cfg.password  = props.password

  client.value = markRaw(new MrCallWebCall(cfg))

  /* ---- event listeners ---- */
  client.value.onLegStatusUpdate = (cid, legId, status) => {
    // Avoid toasting during teardown/unload
    if (!unmounting.value && !pageUnloading.value) {
      toast.add({
        severity:'info',
        summary:`Leg ${status}`,
        detail:`callId: ${cid}, legId: ${legId}`,
        life:3500
      })
    }
    if (status === 'ANSWERED') emit('call-answered', cid, legId)
  }

  client.value.onCallHangup = (cid, callQuality, reason) => {
    dialing.value = false
    callId.value  = null

    if (!unmounting.value && !pageUnloading.value) {
      toast.add({
        severity:'info',
        summary:'Call ended',
        detail:[
          reason      ? `Reason: ${reason}` : '',
          callQuality ? `Quality: ${JSON.stringify(callQuality)}` : ''
        ].filter(Boolean).join(' | '),
        life:5000
      })
    }

    emit('call-ended', cid, reason, callQuality)
  }

  client.value.onSessionError = reason => {
    dialing.value = false
    const msg = String(reason)
    // Skip surfacing when this duplicates a start failure the catch is handling
    // (or about to handle): the catch owns start-failure surfacing and can open
    // the mic dialog, so a second toast here would just stack. Mid-call session
    // errors (no start in flight, no recent match) keep their toast.
    const duplicateStart =
      startInFlight ||
      (lastStartError &&
        lastStartError.message === msg &&
        Date.now() - lastStartError.at < 2000)
    if (!duplicateStart && !unmounting.value && !pageUnloading.value) {
      const kind = classifyVoiceError(reason)
      if (kind) {
        micDialogKind.value = kind
        micDialogVisible.value = true
      } else {
        toast.add({ severity:'error', summary:'Session error', detail:msg, life:6000 })
      }
    }
    emit('error', msg)
  }
}

/**
 * Attempt to hang up the current call if any.
 * - silent=true avoids toasts during teardown/unload.
 */
async function sendHangup ({ silent = false } = {}) {
  try {
    // If there's no client or no active/dialing call, skip.
    if (!client.value || (!dialing.value && !callId.value)) return

    // We don't block teardown/unload on the promise; this is best-effort.
    await client.value.hangup()

    if (!silent) {
      toast.add({
        severity:'info',
        summary:'Hangup requested',
        detail: callId.value ? `id: ${callId.value}` : '',
        life:4000
      })
    }
  } catch (e) {
    const msg = e?.message || String(e)
    if (!silent) {
      toast.add({ severity:'error', summary:'Error hanging up call', detail:msg, life:6000 })
    }
    emit('error', msg)
  }
}

/* ---------------- actions ------------------------------------------------ */
async function startCall () {
  if (processing.value || unmounting.value || pageUnloading.value) return
  processing.value = true
  dialing.value    = true       // turn the button red immediately
  startInFlight    = true       // mark the start so onSessionError can dedupe

  try {
    buildClientIfNeeded()
    await client.value.initialize()
    const id = await client.value.makeCall()
    callId.value = id
    startInFlight = false

    if (!unmounting.value && !pageUnloading.value) {
      toast.add({ severity:'success', summary:'Call requested', detail:`id: ${id}`, life:4000 })
    }
    emit('call-started', id)
  } catch (e) {
    startInFlight = false
    dialing.value = false
    callId.value  = null
    const msg = e?.message || String(e)
    if (!unmounting.value && !pageUnloading.value) {
      // Mic failures get the localized popup with re-grant instructions; every
      // other start failure keeps the raw message as detail for support.
      const kind = classifyVoiceError(e)
      if (kind) {
        micDialogKind.value = kind
        micDialogVisible.value = true
      } else {
        toast.add({ severity:'error', summary:'Error starting call', detail:msg, life:6000 })
      }
    }
    lastStartError = { message: msg, at: Date.now() }
    emit('error', msg)
  } finally {
    processing.value = false
  }
}

async function hangupCall () {
  if (processing.value) return
  processing.value = true
  try {
    await sendHangup({ silent: false }) // confirmation comes via onCallHangup
  } finally {
    processing.value = false
  }
}

async function handleClick () {
  if (props.disabled) return      // completely disabled by parent
  if (inCall.value) await hangupCall()
  else               await startCall()
}

/* ---------------- lifecycle / hardening --------------------------------- */
/**
 * Also hang up if the user navigates away or the page/tab is closed.
 * pagehide works on iOS Safari; beforeunload covers most desktop browsers.
 */
const onPageExit = () => {
  pageUnloading.value = true
  try {
    // Fire-and-forget; browsers may not allow async to complete, but this is best-effort.
    client.value?.hangup()
  } catch { /* ignore */ }
}

onMounted(() => {
  window.addEventListener('beforeunload', onPageExit)
  // Use capture to ensure we run even if the event bubbles are stopped elsewhere
  window.addEventListener('pagehide', onPageExit, { capture: true })
})

onBeforeUnmount(() => {
  unmounting.value = true
  // Best-effort hangup if component is destroyed mid-call
  try {
    client.value?.hangup()
  } catch { /* ignore */ }
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', onPageExit)
  window.removeEventListener('pagehide', onPageExit, { capture: true })
  // Drop the client reference to allow GC
  client.value = null
})
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/fonts';

.in-call-active {
  animation: call-pulse 2s ease-in-out infinite;
}

@keyframes call-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { opacity: 0.85; box-shadow: 0 0 8px 2px rgba(239, 68, 68, 0.3); }
}
</style>