<template>
  <section class="assistant-calendar-connection">
    <div class="account-calendar-state">
      <h4>{{ $t('components.connectCalendar.assistant.accountTitle') }}</h4>
      <p v-if="loading">{{ $t('components.connectCalendar.loadingCalendars') }}</p>
      <p v-else-if="accountConnected">{{ $t('components.connectCalendar.connectedTo') }} <strong>{{ accountCalendar }}</strong></p>
      <p v-else>{{ $t('components.connectCalendar.assistant.accountUnknown') }}</p>
    </div>
    <div class="assistant-calendar-state" :data-status="status">
      <h4>{{ $t('components.connectCalendar.assistant.title') }}</h4>
      <p v-if="loading">{{ $t('components.connectCalendar.loadingCalendars') }}</p>
      <p v-else>{{ $t(`components.connectCalendar.assistant.${status}`) }}</p>
      <p>{{ $t('components.connectCalendar.assistant.explanation') }}</p>
      <div class="connection-actions">
        <Button class="assistant-google-connect" :label="$t('views.configureAI.businessConnection.connect')"
                :disabled="!businessId || loading || busy" :loading="busy" @click="connect" />
        <Button class="assistant-google-refresh" :label="$t('widgets.agentSkills.handoff.refresh')"
                :disabled="!businessId || loading || busy" @click="refresh" />
      </div>
      <p v-if="failed" role="alert">{{ $t('views.configureAI.businessConnection.failed') }}</p>
    </div>
  </section>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { isSessionEnded } from '@/firebase/session';
import agentSkills from '@/utils/AgentSkills';
import { OAuthHelper } from '@/utils/OAuth';
import { businessCalendarAuthorizationUrl } from '@/utils/BusinessSkillConnection';

const props = defineProps({ businessId: { type: String, required: true } });
const store = useStore();
const status = ref('unknown');
const loading = ref(false);
const busy = ref(false);
const failed = ref(false);
const accountConnected = ref(false);
const accountCalendar = ref('');
let generation = 0;
let disposed = false;
onBeforeUnmount(() => { disposed = true; generation++; });

async function refresh() {
  const current = ++generation;
  const user = store.state.user;
  const businessId = props.businessId;
  status.value = 'unknown'; accountConnected.value = false; accountCalendar.value = '';
  failed.value = false; loading.value = false;
  if (!user || !businessId) return;
  loading.value = true;
  try {
    const [accountResult, availabilityResult] = await Promise.allSettled([
      OAuthHelper.getGoogleCalendarCredentials(user),
      agentSkills.getCalendarAvailability(user, businessId, '')
    ]);
    if (current !== generation || store.state.user?.uid !== user.uid || props.businessId !== businessId) return;
    const account = accountResult.status === 'fulfilled' ? accountResult.value : null;
    accountConnected.value = account?.connected === true;
    accountCalendar.value = [account?.calendarName, account?.calendarId].find(value => typeof value === 'string' && value.trim()) || 'Google';
    status.value = availabilityResult.status === 'fulfilled' && availabilityResult.value === 'available' ? 'available' : 'unknown';
  } catch (error) {
    if (isSessionEnded(error)) return;
  } finally {
    if (current === generation) loading.value = false;
  }
}

async function connect() {
  if (loading.value || busy.value) return;
  const user = store.state.user;
  const businessId = props.businessId;
  const current = generation;
  if (!user || !businessId) return;
  busy.value = true; failed.value = false;
  try {
    const url = await businessCalendarAuthorizationUrl(businessId, user.uid, ['https://www.googleapis.com/auth/calendar']);
    if (disposed || current !== generation || store.state.user?.uid !== user.uid || props.businessId !== businessId) return;
    window.location.assign(url);
  } catch (error) {
    if (!isSessionEnded(error) && !disposed && current === generation) failed.value = true;
  } finally { busy.value = false; }
}

watch(() => [props.businessId, store.state.user?.uid], refresh, { immediate: true });
</script>

<style scoped>
.assistant-calendar-connection { display: grid; gap: 1rem; }
.account-calendar-state, .assistant-calendar-state { padding: 1rem; border: 1px solid var(--surface-border); border-radius: 0.5rem; }
.connection-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
h4 { margin-top: 0; }
</style>
