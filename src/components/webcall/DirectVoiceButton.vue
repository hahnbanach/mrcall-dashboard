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
  <MicPermissionDialog v-model:visible="micDialogVisible" :kind="micDialogKind" />
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
import { ref, computed, onBeforeUnmount, onMounted, getCurrentInstance } from "vue";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";
import { useI18n } from "vue-i18n";
import { auth } from "@/firebase/config";
import MrCallDirectVoice from "@mrcall/directvoice";
import MicPermissionDialog from "./MicPermissionDialog.vue";
import { classifyVoiceError } from "@/utils/voiceErrors";

const { t } = useI18n();

/** Report an attempt and a failure to GA.
 *
 * This button is the entire free trial: the test phone number was retired, and a
 * real number is only issued after a Stripe checkout, so it is the only way a
 * new signup can hear the product before paying. Yet a microphone prompt that is
 * denied — or merely dismissed — leaves NO trace anywhere: getUserMedia runs
 * before the WebSocket opens, and the StarChat session row is created inside the
 * WS route. Measured on production, 111 of 215 recent signups sat in TEST having
 * never made a call, and nothing could say how many of them clicked and failed.
 *
 * `webcall_attempt` is the load-bearing half. Every other signal we have — the
 * session row, the WS access log — begins only AFTER the microphone is granted,
 * so without an attempt event there is no denominator and no failure rate.
 *
 * Never throws: instrumentation that can break the call is worse than none. */
// Captured HERE, during setup. getCurrentInstance() returns null anywhere else —
// including inside startCall(), which is async and runs from a click handler —
// so resolving it lazily would silently report nothing from the one path that
// matters most.
const $gtag = getCurrentInstance()?.appContext?.config?.globalProperties?.$gtag;

function track(event, params) {
  try {
    $gtag?.event(event, {
      business_id: props.businessId,
      encoding: props.encoding,
      ...params,
    });
  } catch (e) {
    console.debug("webcall telemetry unavailable:", e);
  }
}

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

// Mic failures open a modal popup instead of a 10s toast. `kind` drives which
// localized body the dialog shows (micDenied vs micNotFound).
const micDialogVisible = ref(false);
const micDialogKind = ref("micDenied");

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

// The SDK fires `onError` inside startStream's catch and then rethrows, so one
// start failure reaches BOTH `client.onError` and the `startCall` catch. The
// catch owns surfacing start failures (it can open the mic dialog); `onError`
// must not stack a second toast for the same failure. `startInFlight` marks a
// start in progress and covers the real ordering (onError runs before the
// catch); `lastStartError` is a < 2 s message-match backstop for any race.
let startInFlight = false;
let lastStartError = null;

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
    notify("success", t("components.directVoice.connected"), "", 3500);
    emit("call-started", sessionId);
  };

  client.onCallEnded = (reason) => {
    notify("info", t("components.directVoice.ended"), "", 4000);
    emit("call-ended", reason);
  };

  client.onError = (message) => {
    track("webcall_failed", { stage: "in_call", error_message: message });
    // Skip the toast only when this duplicates a start failure the catch is
    // surfacing (or about to surface): without this guard one mic denial stacks
    // two toasts — "Direct voice error" from here and "Error starting direct
    // voice" from the catch. Mid-call server errors (no start in flight, no
    // recent match) keep their toast.
    const duplicateStart =
      startInFlight ||
      (lastStartError &&
        lastStartError.message === message &&
        Date.now() - lastStartError.at < 2000);
    if (!duplicateStart) {
      notify("error", t("components.directVoice.error"), message, 6000);
    }
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
  track("webcall_attempt");

  try {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) throw new Error("Not authenticated");

    let token;
    try {
      token = await firebaseUser.getIdToken(true);
    } catch (err) {
      console.error("Failed to get fresh Firebase token:", err);
      throw new Error("Authentication failed — please reload the page", { cause: err });
    }

    destroyVoice();
    voice = createVoice();
    startInFlight = true;
    await voice.startStream(buildWsUrl(token, voice.encoding));
    startInFlight = false;
  } catch (e) {
    startInFlight = false;
    callStatus.value = "idle";
    processing.value = false;
    destroyVoice();
    const msg = e?.message || String(e);
    // `error_name` is what separates the failure modes: NotAllowedError is a
    // denied or dismissed prompt, NotFoundError is a machine with no microphone.
    // They need different copy, and the raw message alone cannot tell them apart
    // across browsers and locales.
    track("webcall_failed", { stage: "start", error_name: e?.name, error_message: msg });
    // The microphone failures get their OWN message, because they are the ones
    // the user can actually fix and until now we told them nothing: no
    // instruction to click the padlock, and the raw DOMException in English on
    // a dashboard localised into twelve languages. NotAllowedError is a denied
    // or dismissed prompt — 11 of the 20 errors on the one instrumented surface
    // were a prompt the user simply closed. The classifier matches on name AND
    // message, because the DOMException name is not contractual across
    // browsers/SDK permutations (a dismissed prompt surfaced as a name the old
    // switch did not list). Everything else keeps the raw message as detail,
    // which is what support needs to see.
    const kind = classifyVoiceError(e);
    if (kind) {
      micDialogKind.value = kind;
      micDialogVisible.value = true;
    } else {
      notify("error", t("components.directVoice.errorStarting"), msg, 6000);
    }
    lastStartError = { message: msg, at: Date.now() };
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
