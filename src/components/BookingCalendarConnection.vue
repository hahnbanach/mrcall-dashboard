<template>
  <section v-if="available || failed" class="booking-calendar-connection" data-testid="booking-connection">
    <strong>{{ $t('views.configureAI.bookingConnection.title') }}</strong>
    <p v-if="setup.state === 'active'" role="status">{{ $t('views.configureAI.bookingConnection.active') }}</p>
    <template v-else>
      <p>{{ $t('views.configureAI.bookingConnection.explanation') }}</p>
      <template v-if="calendars.length">
        <label for="booking-calendar">{{ $t('views.configureAI.bookingConnection.choose') }}</label>
        <Dropdown input-id="booking-calendar" class="booking-calendar-picker" v-model="selected"
                  :options="calendars" option-label="label" option-value="id"
                  :placeholder="$t('views.configureAI.bookingConnection.select')"
                  :disabled="disabled || busy || loading" />
        <Button class="booking-activate" :label="$t('views.configureAI.bookingConnection.activate')"
                :disabled="disabled || busy || loading || !selected || !!failed" :loading="busy" @click="activate()" />
      </template>
      <Button v-else-if="available" class="booking-google-connect"
              :label="$t('views.configureAI.bookingConnection.connect')"
              :disabled="disabled || busy || loading" :loading="busy" @click="connect" />
    </template>
    <p v-if="failed" role="alert">{{ $t(`views.configureAI.bookingConnection.${failed}`) }}</p>
    <Button v-if="failed" class="p-button-text booking-refresh"
            :label="$t('views.configureAI.bookingConnection.refresh')"
            :disabled="disabled || busy || loading" @click="refresh(true)" />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import zylch from '@/utils/Zylch';
import { isSessionEnded } from '@/firebase/axiosConfig';
import { bookingAuthorizationUrl, clearBookingIntent, consumeBookingConnection } from '@/utils/BookingConnection';

const props = defineProps({ businessId: { type: String, required: true }, sessionId: String,
  changes: { type: Array, default: () => [] }, ready: Boolean, disabled: Boolean });
const emit = defineEmits(['available', 'busy-change', 'result']);
const store = useStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const setup = ref({});
const available = ref(false);
const selected = ref(null);
const failed = ref('');
const loading = ref(false);
const busy = ref(false);
let generation = 0;
let disposed = false;
let consumedReturn = false;
let loadedIdentity = '';
const calendars = computed(() => (setup.value.calendars || []).map(row => ({ ...row,
  label: (row.summary || t('views.configureAI.bookingConnection.unnamed')) +
    (row.primary ? ` (${t('views.configureAI.bookingConnection.primary')})` : '') })));
const identity = () => ({ ownerUid: store.state.user?.uid, businessId: props.businessId, sessionId: props.sessionId });
const current = value => !disposed && Object.entries(value).every(([key, v]) => identity()[key] === v);
const markBusy = value => { busy.value = value; emit('busy-change', value); };
onBeforeUnmount(() => { disposed = true; generation++; emit('busy-change', false); });

watch(() => [props.businessId, props.sessionId, store.state.user?.uid, props.ready, JSON.stringify(props.changes)],
  () => {
    if (JSON.stringify(identity()) !== loadedIdentity) markBusy(false);
    if (!busy.value) refresh();
  }, { immediate: true });

async function refresh(resetFailure = false) {
  const target = identity();
  const key = JSON.stringify(target);
  if (key !== loadedIdentity) {
    if (loadedIdentity) clearBookingIntent();
    loadedIdentity = key;
    setup.value = {};
    selected.value = null;
    available.value = false;
    consumedReturn = false;
    failed.value = '';
    emit('available', false);
  }
  const request = ++generation;
  if (!props.ready || !target.ownerUid || !target.businessId || !target.sessionId) return;
  loading.value = true;
  if (resetFailure) failed.value = '';
  let supported = false;
  try {
    const data = await zylch.getBookingSetup(store.state.user, target.businessId, target.sessionId);
    if (!current(target) || request !== generation) return;
    supported = data?.available === true;
    const rows = data?.calendars;
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.id !== 'string' || !row.id ||
        typeof row.summary !== 'string' || typeof row.primary !== 'boolean') ||
        new Set(rows.map(row => row.id)).size !== rows.length ||
        (supported && (typeof data.setup_token !== 'string' || !/^[a-f0-9]{64}$/.test(data.setup_token)))) {
      throw new Error('invalid_calendar_list');
    }
    setup.value = data;
    available.value = data.available === true && typeof data.setup_token === 'string';
    emit('available', available.value);
    selected.value = rows.some(row => row.id === selected.value) ? selected.value : null;
    if (!consumedReturn && route.query.skillBusinessConnection === 'google_calendar') {
      consumedReturn = true;
      const intent = consumeBookingConnection(target.ownerUid, target.businessId, target.sessionId, data.setup_token);
      const query = { ...route.query }; delete query.skillBusinessConnection;
      await router.replace({ path: route.path, query });
      if (!current(target)) return;
      if (intent === 'changed') failed.value = 'stale';
      if (intent === 'ready' && !rows.length) failed.value = 'failed';
      if (intent === 'ready' && available.value && data.state !== 'active' && rows.length === 1) {
        selected.value = rows[0].id;
        await activate(true);
      }
    }
  } catch (error) {
    if (isSessionEnded(error)) return;
    if (current(target) && request === generation) {
      if (available.value || supported) failed.value = 'failed';
      available.value = false;
      emit('available', false);
    }
  } finally {
    if (current(target) && request === generation) loading.value = false;
  }
}

async function connect() {
  if (props.disabled || busy.value || loading.value || !available.value) return;
  const target = identity();
  markBusy(true);
  failed.value = '';
  try {
    const url = await bookingAuthorizationUrl(store.state.user, target.businessId, target.sessionId,
      setup.value.setup_token, setup.value.oauth_scopes);
    if (!current(target)) { clearBookingIntent(); return; }
    window.location.assign(url);
  } catch (error) { if (!isSessionEnded(error) && current(target)) failed.value = 'failed'; }
  finally { if (current(target)) markBusy(false); }
}

async function activate(fromReturn = false) {
  if (busy.value || props.disabled || (!fromReturn && loading.value) || !selected.value || !available.value) return;
  const target = identity();
  markBusy(true);
  failed.value = '';
  try {
    const result = await zylch.activateBooking(store.state.user, target.businessId, target.sessionId,
      setup.value.setup_token, selected.value);
    if (!current(target)) return;
    if (typeof result?.success !== 'boolean' || typeof result.booking_active !== 'boolean' ||
        !Array.isArray(result.remaining_pending) || !Array.isArray(result.skill_outcomes) ||
        (result.booking_active && !result.success)) throw new Error('invalid_activation_response');
    emit('result', { ...target, result });
    if (result.booking_active === true && result.success === true) setup.value = { ...setup.value, state: 'active' };
    else failed.value = 'partial';
  } catch (error) {
    if (isSessionEnded(error)) return;
    if (current(target)) {
      failed.value = error.response?.status === 409 ? 'stale' : 'failed';
      emit('result', { ...target, lost: true, refused: !!error.response });
    }
  } finally { if (current(target)) markBusy(false); }
}
</script>

<style scoped>
.booking-calendar-connection { flex: 0 0 auto; padding: 0.75rem; border: 1px solid var(--surface-border); border-radius: 8px; }
.booking-calendar-connection p { margin: 0.4rem 0; }
.booking-calendar-connection label { display: block; margin: 0.5rem 0; }
.booking-calendar-picker { width: min(100%, 28rem); margin-right: 0.5rem; margin-bottom: 0.5rem; }
.booking-activate, .booking-google-connect { max-width: 100%; }
</style>
