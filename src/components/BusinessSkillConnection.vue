<template>
  <section v-if="scopes.length" class="business-skill-connection">
    <p>{{ $t('views.configureAI.businessConnection.explanation') }}</p>
    <Button class="business-google-connect" :label="$t('views.configureAI.businessConnection.connect')"
            :disabled="disabled || busy || loading" :loading="busy" @click="connect" />
    <p v-if="failed" role="alert">{{ $t('views.configureAI.businessConnection.failed') }}</p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useStore } from 'vuex';
import { businessCalendarAuthorizationUrl, businessCalendarScopes, loadBusinessSkillCatalogue } from '@/utils/BusinessSkillConnection';

const props = defineProps({ businessId: { type: String, required: true },
  changes: { type: Array, required: true }, disabled: Boolean });
const emit = defineEmits(['busy-change']);
const store = useStore();
const catalogue = ref([]);
const loading = ref(false);
const busy = ref(false);
const failed = ref(false);
let generation = 0;
let disposed = false;
onBeforeUnmount(() => { disposed = true; generation++; emit('busy-change', false); });
const scopes = computed(() => businessCalendarScopes(catalogue.value, props.changes, props.businessId));

watch(() => [props.businessId, store.state.user?.uid], async () => {
  const current = ++generation;
  catalogue.value = [];
  failed.value = false;
  const user = store.state.user;
  if (!user || !props.businessId) return;
  loading.value = true;
  try {
    const rows = await loadBusinessSkillCatalogue(user, props.businessId);
    if (current === generation) catalogue.value = Array.isArray(rows) ? rows : [];
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
</script>
