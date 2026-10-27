<template>
  <section v-if="scopes.length && !hideCalendar" class="business-skill-connection">
    <p>{{ $t('views.configureAI.businessConnection.explanation') }}</p>
    <Button class="business-google-connect" :label="$t('views.configureAI.businessConnection.connect')"
            :disabled="disabled || busy || loading" :loading="busy" @click="connect" />
    <p v-if="failed" role="alert">{{ $t('views.configureAI.businessConnection.failed') }}</p>
  </section>
  <section v-for="target in sheetsTargets" :key="target.operationId" class="sheets-skill-connection" data-testid="sheets-connection">
    <p>{{ $t('views.configureAI.sheetsConnection.explanation') }}</p>
    <Button class="sheets-google-connect" :label="$t('views.configureAI.sheetsConnection.connect')"
            :disabled="disabled || busy || loading || !ready" :loading="busy" @click="connectSheets(target)" />
    <p>{{ $t('views.configureAI.sheetsConnection.unverifiedHelp') }}</p>
    <p v-if="failed" role="alert">{{ $t('views.configureAI.businessConnection.failed') }}</p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { businessCalendarAuthorizationUrl, businessCalendarScopes, loadBusinessSkillCatalogue, sheetsConnectionTargets } from '@/utils/BusinessSkillConnection';

import { beginSheetsConnection, clearSheetsIntent, consumeSheetsConnection } from '@/utils/SheetsConnection';

const props = defineProps({ businessId: { type: String, required: true },
  changes: { type: Array, required: true }, sessionId: String, ready: Boolean, hideCalendar: Boolean, disabled: Boolean });
const emit = defineEmits(['busy-change', 'sheets-connected']);
const store = useStore();
const catalogue = ref([]);
const catalogueReady = ref(false);
const loading = ref(false);
const busy = ref(false);
const failed = ref(false);
let generation = 0;
let disposed = false;
onBeforeUnmount(() => { disposed = true; generation++; emit('busy-change', false); });
const sheetsTargets = computed(() => sheetsConnectionTargets(catalogue.value, props.changes, props.businessId));
watch(() => [props.ready, props.businessId, props.sessionId, store.state.user?.uid, loading.value, catalogueReady.value, sheetsTargets.value], () => {
  if (!props.ready || !catalogueReady.value || loading.value || !props.sessionId || !store.state.user?.uid) return;
  if (consumeSheetsConnection(store.state.user.uid, props.businessId, props.sessionId, sheetsTargets.value)) {
    emit('sheets-connected', { ownerUid: store.state.user.uid, businessId: props.businessId, sessionId: props.sessionId });
  }
}, { immediate: true });
const scopes = computed(() => businessCalendarScopes(catalogue.value, props.changes, props.businessId));

watch(() => [props.businessId, store.state.user?.uid], async () => {
  const current = ++generation;
  catalogueReady.value = false;
  catalogue.value = [];
  failed.value = false;
  const user = store.state.user;
  if (!user || !props.businessId) return;
  loading.value = true;
  try {
    const rows = await loadBusinessSkillCatalogue(user, props.businessId);
    if (current === generation) {
      catalogue.value = Array.isArray(rows) ? rows : [];
      catalogueReady.value = Array.isArray(rows);
    }
  } catch {
    if (current === generation) catalogue.value = [];
  } finally {
    if (current === generation) loading.value = false;
  }
}, { immediate: true });

async function connect() {
  if (props.disabled || busy.value || loading.value || !scopes.value.length) return;
  const user = store.state.user;
  if (!user) return;
  const businessId = props.businessId;
  busy.value = true;
  failed.value = false;
  emit('busy-change', true);
  try {
    const url = await businessCalendarAuthorizationUrl(businessId, user.uid, scopes.value);
    if (disposed || store.state.user?.uid !== user.uid || props.businessId !== businessId) throw new Error('context_changed');
    window.location.assign(url);
  } catch {
    failed.value = true;
  } finally {
    busy.value = false;
    emit('busy-change', false);
  }
}
async function connectSheets(target) {
  if (props.disabled || busy.value || loading.value || !props.ready) return;
  const ownerUid = store.state.user?.uid;
  const businessId = props.businessId;
  const sessionId = props.sessionId;
  if (!ownerUid || !sessionId) return;
  busy.value = true;
  failed.value = false;
  emit('busy-change', true);
  try {
    const url = await beginSheetsConnection(ownerUid, businessId, sessionId, target);
    if (disposed || store.state.user?.uid !== ownerUid || props.businessId !== businessId ||
        props.sessionId !== sessionId || !sheetsTargets.value.some(row => row.fingerprint === target.fingerprint)) {
      clearSheetsIntent(); return;
    }
    window.location.assign(url);
  } catch { failed.value = true; }
  finally { busy.value = false; emit('busy-change', false); }
}
</script>
