<template>
  <Button
    :label="buttonLabel"
    :icon="buttonIcon"
    iconPos="left"
    :severity="buttonSeverity"
    :outlined="!inCall"
    :loading="processing"
    :disabled="disabled || (processing && !inCall)"
    :class="{ 'in-call-active': inCall && !processing }"
    @click="handleClick"
  />
</template>

<script setup>
// Audio and WebSocket handling live in @mrcall/directvoice, the same SDK the
// embeddable widget uses. This component used to carry its own copy of the
// worklets and the transport, which drifted: the barge-in playback flush landed
// in the SDK and never reached the dashboard, so the assistant kept talking over
// the caller here long after it had stopped on the phone.
//
// Everything below is presentation and Vue lifecycle. The auth model stays ours:
// the dashboard talks to the Firebase JWT endpoint, so we build the URL and hand
// it to startStream(), which takes an absolute URL as given.
import { ref, computed, onBeforeUnmount, onMounted } from "vue";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";
import { useI18n } from "vue-i18n";
import { auth } from "@/firebase/config";
import MrCallDirectVoice from "@mrcall/directvoice";

const { t } = useI18n();

const props = defineProps({
  businessId: { type: String, required: true },
  encoding: { type: String, default: "opus" }, // 'opus' | 'pcm16'
  labelCall: { type: String, default: "" },
  labelHangup: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["call-started", "call-ended", "error"]);

const toast = useToast();

const callStatus = ref("idle"); // idle | connecting | active | ending
const processing = ref(false);
const unmounting = ref(false);
const pageUnloading = ref(false);

const inCall = computed(
  () => callStatus.value === "connecting" || callStatus.value === "active"
);

const defaultCallLabel = computed(() => {
  return props.labelCall || t("components.directVoice.talkToAssistant");
});

const defaultHangupLabel = computed(() => {
  return props.labelHangup || t("components.directVoice.hangup");
});

const buttonLabel = computed(() => {
  switch (callStatus.value) {
    case "connecting":
      return t("components.directVoice.connecting");
    case "active":
      return defaultHangupLabel.value;
    case "ending":
      return t("components.directVoice.ending");
    default:
      return defaultCallLabel.value;
  }
});

const buttonIcon = computed(() => {
  switch (callStatus.value) {
    case "connecting":
      return "pi pi-spin pi-spinner";
    case "active":
      return "pi pi-times-circle";
    case "ending":
      return "pi pi-spin pi-spinner";
    default:
      return "pi pi-phone";
  }
});

const buttonSeverity = computed(() => {
  switch (callStatus.value) {
    case "connecting":
      return "warn";
    case "active":
      return "danger";
    case "ending":
      return "warn";
    default:
      return "primary";
  }
});

const SAMPLE_RATE = 24000;

let voice = null;

/** Toasts are suppressed while the component or the page is going away: a hangup
 * fired from a teardown handler is expected, not something to report. */
function notify(severity, summary, detail, life) {
  if (unmounting.value || pageUnloading.value) return;
  toast.add({ severity, summary, detail, life });
}

function destroyVoice() {
  if (voice) {
    voice.destroy();
    voice = null;
  }
}

/** The dashboard authenticates with a Firebase JWT against the realm endpoint,
 * which is not the flow the SDK's own initSession covers, so the URL is built
 * here and passed to startStream(). _resolveWsUrl leaves absolute URLs untouched,
 * and the SDK's opus fallback rewrites only the encoding parameter, so the token
 * survives a retry. */
function buildWsUrl(token, encoding) {
  const baseUrl = process.env.VUE_APP_STARCHAT_URL;
  const wsBase = baseUrl.replace(/^https:\/\//, "").replace(/^http:\/\//, "");
  const protocol = baseUrl.startsWith("https") ? "wss" : "ws";
  const params = new URLSearchParams({
    businessId: props.businessId,
    sampleRate: String(SAMPLE_RATE),
    encoding,
    token,
  });
  return `${protocol}://${wsBase}/mrcall/v1/mrcall0/voice/stream?${params.toString()}`;
}

function createVoice() {
  const client = new MrCallDirectVoice({
    baseUrl: process.env.VUE_APP_STARCHAT_URL,
    sampleRate: SAMPLE_RATE,
    encoding: props.encoding,
  });

  client.onStatusChange = (status) => {
    callStatus.value = status;
    if (status === "active" || status === "idle") processing.value = false;
  };

  client.onCallStarted = (sessionId) => {
    notify(
      "success",
      "Direct voice connected",
      `Session: ${sessionId}`,
      3500
    );
    emit("call-started", sessionId);
  };

  client.onCallEnded = (reason) => {
    notify("info", "Direct voice ended", reason || "", 4000);
    emit("call-ended", reason);
  };

  client.onError = (message) => {
    notify("error", "Direct voice error", message, 6000);
    emit("error", message);
  };

  // Opening frames only, then it goes quiet. Tells a stream that never started
  // apart from one that is running but silent, which is the first thing worth
  // knowing when someone reports a dead call.
  client.onAudioStats = ({ direction, seq, bytes, samples, peak }) => {
    const detail = samples !== null ? ` ${samples} samples, peak=${peak}` : "";
    console.log(`DirectVoice ${direction} #${seq}: ${bytes}B${detail}`);
  };

  return client;
}

async function startCall() {
  if (processing.value || unmounting.value || pageUnloading.value) return;
  processing.value = true;
  callStatus.value = "connecting";

  try {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) throw new Error("Not authenticated");

    let token;
    try {
      token = await firebaseUser.getIdToken(true);
    } catch (err) {
      console.error("Failed to get fresh Firebase token:", err);
      throw new Error("Authentication failed — please reload the page");
    }

    destroyVoice();
    voice = createVoice();
    await voice.startStream(buildWsUrl(token, voice.encoding));
  } catch (e) {
    callStatus.value = "idle";
    processing.value = false;
    destroyVoice();
    const msg = e?.message || String(e);
    notify("error", "Error starting direct voice", msg, 6000);
    emit("error", msg);
  }
}

function hangupCall() {
  if (processing.value) return;
  processing.value = true;
  // The SDK sends the hangup, holds "ending" briefly so the server can finalize,
  // then returns to idle and releases the microphone. onStatusChange drives the
  // button through both steps.
  voice?.hangup();
}

function handleClick() {
  if (props.disabled) return;
  if (inCall.value) hangupCall();
  else startCall();
}

const onPageExit = () => {
  pageUnloading.value = true;
  destroyVoice();
};

onMounted(() => {
  window.addEventListener("beforeunload", onPageExit);
  window.addEventListener("pagehide", onPageExit, { capture: true });
});

onBeforeUnmount(() => {
  unmounting.value = true;
  destroyVoice();
  window.removeEventListener("beforeunload", onPageExit);
  window.removeEventListener("pagehide", onPageExit, { capture: true });
});
</script>

<style scoped lang="less">
@import "../../assets/style/colors";
@import "../../assets/style/fonts";

.in-call-active {
  animation: call-pulse 2s ease-in-out infinite;
}

@keyframes call-pulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    opacity: 0.85;
    box-shadow: 0 0 8px 2px rgba(239, 68, 68, 0.3);
  }
}
</style>
