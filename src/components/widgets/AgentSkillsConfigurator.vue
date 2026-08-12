<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";
import { getAuth } from 'firebase/auth';
import agentSkillsUtils from "@/utils/AgentSkills";
import { GoogleAuthFlow, assertScopesAllowed } from '@/utils/OAuth';
import { useToast } from "primevue/usetoast";
import TupleVariable from "./TupleVariable.vue";

const { t, locale } = useI18n();
const toast = useToast();
const store = useStore();
const auth = getAuth();

const props = defineProps({
  modelValue: { type: [String, Object], default: '{}' },
  businessId: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const PHASES = ['prefetch', 'during', 'final'];

const availableSkills = ref([]);
const config = ref({ prefetch: [], during: [], final: [] });
const loading = ref(false);
const expandedPhases = ref({ prefetch: false, during: false, final: false });
const addSkillSelection = ref({ prefetch: null, during: null, final: null });

// Parse initial value
watch(() => props.modelValue, (newVal) => {
  const parsed = agentSkillsUtils.parseConfig(newVal);
  if (JSON.stringify(parsed) !== JSON.stringify(config.value)) {
    config.value = parsed;
  }
}, { immediate: true });

// Emit on config change
watch(() => config.value, (newVal) => {
  emit('update:modelValue', agentSkillsUtils.serializeConfig(newVal));
}, { deep: true });

onMounted(async () => {
  loading.value = true;
  const user = store.state.user;
  if (user) {
    availableSkills.value = await agentSkillsUtils.getAvailableSkills(user, props.businessId);
  }
  loading.value = false;
});

const phaseInfo = computed(() => ({
  prefetch: { label: t('widgets.agentSkills.phasePrefetch'), hint: t('widgets.agentSkills.phasePrefetchHint'), icon: 'pi pi-download', color: '#3b82f6' },
  during: { label: t('widgets.agentSkills.phaseDuring'), hint: t('widgets.agentSkills.phaseDuringHint'), icon: 'pi pi-phone', color: '#22c55e' },
  final: { label: t('widgets.agentSkills.phaseFinal'), hint: t('widgets.agentSkills.phaseFinalHint'), icon: 'pi pi-upload', color: '#f59e0b' }
}));

const currentLang = computed(() => {
  return (locale.value || 'en-US').split('-')[0];
});

function togglePhase(phase) {
  expandedPhases.value[phase] = !expandedPhases.value[phase];
}

function phaseEntryCount(phase) {
  return agentSkillsUtils.phaseEntryCount(config.value, phase);
}

function getPhaseEntries(phase) {
  return config.value[phase] || [];
}

function addableSkillsForPhase(phase) {
  return agentSkillsUtils.getAddableSkills(availableSkills.value, config.value, phase);
}

function addableSkillOptions(phase) {
  return addableSkillsForPhase(phase).map(skill => {
    const isMulti = agentSkillsUtils.isMultiInstance(skill);
    const alreadyInPhase = (config.value[phase] || []).some(e => e.skill === skill.name);
    let label = agentSkillsUtils.skillDisplayName(skill.name);
    if (isMulti && alreadyInPhase) {
      label += ` (${t('widgets.agentSkills.addAnother')})`;
    }
    return { label, value: skill.name };
  });
}

function onAddSkill(phase) {
  const skillName = addSkillSelection.value[phase];
  if (!skillName) return;
  const skillObj = agentSkillsUtils.findSkill(availableSkills.value, skillName);
  if (!skillObj) return;
  config.value = agentSkillsUtils.addSkillToPhase(config.value, skillObj, phase);
  addSkillSelection.value[phase] = null;
}

function removeEntry(phase, index) {
  if (props.disabled) return;
  config.value = agentSkillsUtils.removeFromPhase(config.value, phase, index);
}

function getSkillObj(skillName) {
  return agentSkillsUtils.findSkill(availableSkills.value, skillName);
}

function isOrphanedEntry(entry) {
  return !getSkillObj(entry.skill);
}

function instanceLabel(entry, phase) {
  const skillObj = getSkillObj(entry.skill);
  if (!skillObj) return agentSkillsUtils.skillDisplayName(entry.skill) + ' (unavailable)';
  const phaseEntries = getPhaseEntries(phase);
  return agentSkillsUtils.instanceDisplayLabel(skillObj, entry, phaseEntries);
}

function getFields(entry) {
  const skillObj = getSkillObj(entry.skill);
  return skillObj ? agentSkillsUtils.getSkillFields(skillObj) : [];
}

function getFieldValue(entry, fieldKey) {
  return (entry.params && entry.params[fieldKey] !== undefined) ? entry.params[fieldKey] : '';
}

function setFieldValue(phase, index, fieldKey, value) {
  if (props.disabled) return;
  config.value = agentSkillsUtils.updateEntryParam(config.value, phase, index, fieldKey, value);
}

function getFieldLabel(field) {
  if (field.labels) {
    const labels = field.labels[currentLang.value] || field.labels['en'] || {};
    return labels.label || field.key;
  }
  return field.key;
}

function getFieldHint(field) {
  if (field.labels) {
    const labels = field.labels[currentLang.value] || field.labels['en'] || {};
    return labels.hint || '';
  }
  return '';
}

function skillDescription(entry) {
  const skillObj = getSkillObj(entry.skill);
  if (!skillObj) return '';
  const lang = currentLang.value;
  const i18n = skillObj.descriptionI18n || {};
  const localized = i18n[lang] || i18n['en'] || skillObj.description || '';
  return localized.replace(/\[Skill:.*?\]\s*/, '');
}

function getNonOauthFields(entry, phase) {
  return getFields(entry).filter(f => f.type !== 'oauth' && isFieldVisibleInPhase(f, phase));
}

function isFieldVisibleInPhase(field, phase) {
  if (!field.phases || field.phases.length === 0) return true;
  return field.phases.includes(phase);
}

// --- Key/Value pair helpers ---
// Separate reactive state to allow empty-key rows during editing
const kvState = ref({});

function kvStateKey(phase, entryIdx, fieldKey) {
  return `${phase}_${entryIdx}_${fieldKey}`;
}

function parseKeyValue(jsonStr) {
  try {
    const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr || '{}') : (jsonStr || {});
    return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
  } catch {
    return [];
  }
}

function serializeKeyValue(pairs) {
  const obj = {};
  for (const pair of pairs) {
    if (pair.key && pair.key.trim()) {
      obj[pair.key.trim()] = pair.value || '';
    }
  }
  return JSON.stringify(obj);
}

function getKeyValuePairs(phase, entryIdx, fieldKey) {
  const sk = kvStateKey(phase, entryIdx, fieldKey);
  if (!kvState.value[sk]) {
    const entry = getPhaseEntries(phase)[entryIdx];
    kvState.value[sk] = parseKeyValue(getFieldValue(entry, fieldKey));
  }
  return kvState.value[sk];
}

function syncKvToParam(phase, entryIdx, fieldKey) {
  const sk = kvStateKey(phase, entryIdx, fieldKey);
  const pairs = kvState.value[sk] || [];
  setFieldValue(phase, entryIdx, fieldKey, serializeKeyValue(pairs));
}

function updateKeyValuePair(phase, entryIdx, fieldKey, pairIdx, prop, value) {
  const pairs = getKeyValuePairs(phase, entryIdx, fieldKey);
  if (pairs[pairIdx]) {
    pairs[pairIdx][prop] = value;
  }
  syncKvToParam(phase, entryIdx, fieldKey);
}

function addKeyValuePair(phase, entryIdx, fieldKey) {
  const pairs = getKeyValuePairs(phase, entryIdx, fieldKey);
  pairs.push({ key: '', value: '' });
}

function removeKeyValuePair(phase, entryIdx, fieldKey, pairIdx) {
  const pairs = getKeyValuePairs(phase, entryIdx, fieldKey);
  pairs.splice(pairIdx, 1);
  syncKvToParam(phase, entryIdx, fieldKey);
}

// --- Tuple helpers (reuses TupleVariable widget from BusinessConfiguration) ---
const tupleState = ref({});

function tupleStateKey(phase, entryIdx, fieldKey) {
  return `${phase}_${entryIdx}_${fieldKey}`;
}

function parseTupleValue(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getTupleValue(phase, entryIdx, fieldKey) {
  const sk = tupleStateKey(phase, entryIdx, fieldKey);
  if (!tupleState.value[sk]) {
    const entry = getPhaseEntries(phase)[entryIdx];
    tupleState.value[sk] = parseTupleValue(getFieldValue(entry, fieldKey));
  }
  return tupleState.value[sk];
}

function setTupleValue(phase, entryIdx, fieldKey, value) {
  const sk = tupleStateKey(phase, entryIdx, fieldKey);
  tupleState.value[sk] = value;
  // Store as native array — serializeConfig handles JSON.stringify on the whole config
  setFieldValue(phase, entryIdx, fieldKey, value);
}

function getTupleSelection(field) {
  if (field.valuesSelection) {
    return field.valuesSelection[currentLang.value] || field.valuesSelection['en'] || [];
  }
  return [];
}

function getOauthFields(entry) {
  return getFields(entry).filter(f => f.type === 'oauth');
}

// OAuth connection status (checked per provider)
const oauthStatus = ref({});

async function checkOAuthStatus(provider) {
  // Check if user has an active OAuth connection for this provider
  const user = store.state.user;
  if (!user) return;
  try {
    const headers = { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
    const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/oauth/providers";
    const response = await (await import('axios')).default.get(url, { headers });
    const providers = response.data || [];
    for (const p of providers) {
      oauthStatus.value[p.provider] = { connected: true, accountId: p.providerAccountId };
    }
  } catch (e) {
    console.debug("OAuth status check failed:", e);
  }
}

function isOAuthConnected(field) {
  const status = oauthStatus.value[field.provider];
  return status && status.connected;
}

async function handleOAuthDisconnect(field) {
  try {
    const user = store.state.user;
    if (!user) return;
    const headers = { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
    const url = process.env.VUE_APP_STARCHAT_URL + `/mrcall/v1/mrcall0/oauth/providers/${field.provider}`;
    await (await import('axios')).default.delete(url, { headers });
    delete oauthStatus.value[field.provider];
  } catch (error) {
    console.error('OAuth disconnect error:', error);
  }
}

async function handleOAuthConnect(field) {
  try {
    localStorage.setItem('oauthProvider', field.provider);
    // Save current page URL so callback can redirect back here
    localStorage.setItem('oauthReturnUrl', window.location.pathname + window.location.search);
    const { state, codeChallenge } = await GoogleAuthFlow.begin()

    // The scope list arrives from the backend skill catalog, so this is the one
    // authorization in the app whose scopes are not written here. Checking it
    // against the client's registered set keeps a catalog edit from putting an
    // unregistered scope in front of a customer, where it surfaces as Google's
    // unverified-app screen and leaves no trace on our side.
    const scopes = assertScopesAllowed(field.scopes || [], `skill:${field.provider}`);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', process.env.VUE_APP_GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', process.env.VUE_APP_GOOGLE_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    // Kept, unlike on the sign-in: these credentials are renewed server-side.
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    window.location.href = authUrl.toString();
  } catch (error) {
    console.error('OAuth connection error:', error);
    // Without this the button just does nothing, which reads as a broken page
    // rather than a misconfigured integration.
    localStorage.removeItem('oauthProvider');
    localStorage.removeItem('oauthReturnUrl');
    toast.add({
      severity: 'error',
      summary: t('widgets.agentSkills.oauthScopeUnavailable'),
      detail: error.message,
      life: 8000
    });
  }
}

onMounted(async () => {
  checkOAuthStatus();
});
</script>

<template>
  <div class="agent-skills-configurator">
    <Toast />
    <div v-if="loading" class="flex align-items-center justify-content-center p-4">
      <ProgressSpinner style="width: 30px; height: 30px" strokeWidth="4" />
      <span class="ml-2">{{ t('widgets.agentSkills.loading') }}</span>
    </div>

    <div v-else-if="availableSkills.length === 0" class="empty-state p-4 text-center">
      <i class="pi pi-box" style="font-size: 2rem; color: var(--p-text-muted-color)"></i>
      <p class="mt-2 mb-0 text-color-secondary">{{ t('widgets.agentSkills.noSkills') }}</p>
    </div>

    <div v-else class="phases-container">
      <!-- One section per phase -->
      <div v-for="phase in PHASES" :key="phase" class="phase-section"
           :class="{ 'phase-has-entries': phaseEntryCount(phase) > 0 }">

        <!-- Phase header -->
        <div class="phase-header" @click="togglePhase(phase)"
             :style="{ borderLeftColor: phaseInfo[phase].color }">
          <div class="phase-header-left">
            <i :class="expandedPhases[phase] ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
               class="expand-icon"></i>
            <i :class="phaseInfo[phase].icon" class="phase-icon"
               :style="{ color: phaseInfo[phase].color }"></i>
            <div class="phase-title-block">
              <span class="phase-title">{{ phaseInfo[phase].label }}</span>
              <span class="phase-subtitle">{{ phaseInfo[phase].hint }}</span>
            </div>
          </div>
          <Tag v-if="phaseEntryCount(phase) > 0"
               :value="phaseEntryCount(phase) + ' ' + t('widgets.agentSkills.skills')"
               severity="info" class="phase-badge" />
        </div>

        <!-- Phase content (expanded) -->
        <div v-if="expandedPhases[phase]" class="phase-body">

          <!-- Configured skill instances -->
          <div v-if="getPhaseEntries(phase).length > 0" class="entries-list">
            <div v-for="(entry, idx) in getPhaseEntries(phase)" :key="idx"
                 :class="['entry-card', { 'entry-orphaned': isOrphanedEntry(entry) }]">
              <!-- Entry header -->
              <div class="entry-header">
                <div class="entry-info">
                  <span class="entry-name">{{ instanceLabel(entry, phase) }}</span>
                  <span v-if="isOrphanedEntry(entry)" class="entry-orphaned-hint">
                    {{ t('widgets.agentSkills.skillUnavailable') }}
                  </span>
                  <span v-else-if="skillDescription(entry)" class="entry-description">{{ skillDescription(entry) }}</span>
                </div>
                <Button icon="pi pi-times" severity="danger" text rounded size="small"
                        :disabled="disabled" @click="removeEntry(phase, idx)"
                        :title="t('widgets.agentSkills.removeSkill')" />
              </div>

              <!-- OAuth fields -->
              <div v-if="getOauthFields(entry).length > 0" class="entry-oauth">
                <div v-for="field in getOauthFields(entry)" :key="field.key" class="oauth-field">
                  <div class="oauth-status">
                    <i :class="isOAuthConnected(field) ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"
                       :style="{ color: isOAuthConnected(field) ? '#22c55e' : '#f59e0b' }"></i>
                    <span class="oauth-label">{{ getFieldLabel(field) }}</span>
                    <Tag v-if="isOAuthConnected(field)"
                         :value="t('widgets.agentSkills.oauthConnected')"
                         severity="success" class="oauth-badge" />
                  </div>
                  <div class="oauth-actions">
                    <Button v-if="!isOAuthConnected(field)"
                            :label="t('widgets.agentSkills.oauthConnect')"
                            icon="pi pi-external-link"
                            severity="warning" outlined size="small"
                            @click="handleOAuthConnect(field)"
                            :disabled="disabled" />
                    <Button v-else
                            :label="t('widgets.agentSkills.oauthDisconnect')"
                            icon="pi pi-times"
                            severity="danger" text size="small"
                            @click="handleOAuthDisconnect(field)"
                            :disabled="disabled" />
                  </div>
                  <small v-if="getFieldHint(field)" class="config-hint">{{ getFieldHint(field) }}</small>
                </div>
              </div>

              <!-- Config fields (non-OAuth) -->
              <div v-if="getNonOauthFields(entry, phase).length > 0" class="entry-fields">
                <div v-for="field in getNonOauthFields(entry, phase)" :key="field.key" class="config-field">
                  <label class="config-label">
                    {{ getFieldLabel(field) }}
                    <span v-if="field.required" class="required-mark">*</span>
                  </label>

                  <!-- Boolean toggle -->
                  <ToggleSwitch v-if="field.type === 'boolean'"
                                :modelValue="getFieldValue(entry, field.key) === 'true' || getFieldValue(entry, field.key) === true"
                                @update:modelValue="setFieldValue(phase, idx, field.key, $event ? 'true' : 'false')"
                                :disabled="disabled" />

                  <!-- Number input -->
                  <InputNumber v-else-if="field.type === 'number'"
                               :modelValue="Number(getFieldValue(entry, field.key)) || field.default || 0"
                               @update:modelValue="setFieldValue(phase, idx, field.key, String($event))"
                               :disabled="disabled"
                               :min="field.min"
                               :max="field.max"
                               class="w-full"
                               size="small" />

                  <!-- Enum dropdown -->
                  <Dropdown v-else-if="field.type === 'enum'"
                            :modelValue="getFieldValue(entry, field.key) || field.default || ''"
                            @update:modelValue="setFieldValue(phase, idx, field.key, $event)"
                            :options="field.options || []"
                            optionLabel="label"
                            optionValue="value"
                            :disabled="disabled"
                            :placeholder="getFieldHint(field) || (field.default ? String(field.default) : '')"
                            class="w-full"
                            size="small" />

                  <!-- Key/Value pairs -->
                  <div v-else-if="field.type === 'keyvalue'" class="kv-editor">
                    <div v-for="(pair, pairIdx) in getKeyValuePairs(phase, idx, field.key)" :key="pairIdx"
                         class="kv-row">
                      <InputText :modelValue="pair.key"
                                 @update:modelValue="updateKeyValuePair(phase, idx, field.key, pairIdx, 'key', $event)"
                                 :disabled="disabled"
                                 placeholder="Key"
                                 class="kv-key"
                                 size="small" />
                      <InputText :modelValue="pair.value"
                                 @update:modelValue="updateKeyValuePair(phase, idx, field.key, pairIdx, 'value', $event)"
                                 :disabled="disabled"
                                 placeholder="Value"
                                 class="kv-value"
                                 size="small" />
                      <Button icon="pi pi-trash" severity="danger" text rounded size="small"
                              :disabled="disabled"
                              @click="removeKeyValuePair(phase, idx, field.key, pairIdx)" />
                    </div>
                    <Button icon="pi pi-plus" :label="t('widgets.agentSkills.addPair')"
                            severity="secondary" text size="small"
                            :disabled="disabled"
                            @click="addKeyValuePair(phase, idx, field.key)" />
                  </div>

                  <!-- Tuples (variable extraction) — same widget as REST API variables -->
                  <TupleVariable v-else-if="field.type === 'tuples'"
                                 :recipient="getTupleValue(phase, idx, field.key)"
                                 @update:recipient="setTupleValue(phase, idx, field.key, $event)"
                                 :vselection="getTupleSelection(field)" />

                  <!-- Textarea (multiline text) -->
                  <Textarea v-else-if="field.type === 'textarea'"
                            :modelValue="getFieldValue(entry, field.key)"
                            @update:modelValue="setFieldValue(phase, idx, field.key, $event)"
                            :disabled="disabled"
                            :placeholder="getFieldHint(field) || ''"
                            class="w-full"
                            rows="4"
                            autoResize />

                  <!-- JSON editor -->
                  <JsonEditorVue v-else-if="field.type === 'json'"
                                 :modelValue="getFieldValue(entry, field.key)"
                                 @update:modelValue="setFieldValue(phase, idx, field.key, $event)"
                                 mode="text"
                                 class="w-full json-editor-field" />

                  <!-- Password -->
                  <InputText v-else-if="field.type === 'password'"
                             :modelValue="getFieldValue(entry, field.key)"
                             @update:modelValue="setFieldValue(phase, idx, field.key, $event)"
                             :disabled="disabled"
                             type="password"
                             :placeholder="getFieldHint(field)"
                             class="w-full"
                             size="small" />

                  <!-- Default: string, url -->
                  <InputText v-else
                             :modelValue="getFieldValue(entry, field.key)"
                             @update:modelValue="setFieldValue(phase, idx, field.key, $event)"
                             :disabled="disabled"
                             :type="field.type === 'url' ? 'url' : 'text'"
                             :placeholder="getFieldHint(field) || (field.default ? String(field.default) : '')"
                             class="w-full"
                             size="small" />

                  <small v-if="getFieldHint(field)" class="config-hint">{{ getFieldHint(field) }}</small>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state for phase -->
          <div v-else class="phase-empty">
            <span>{{ t('widgets.agentSkills.noSkillsInPhase') }}</span>
          </div>

          <!-- Add skill dropdown -->
          <div v-if="addableSkillOptions(phase).length > 0 && !disabled" class="add-skill-row">
            <Dropdown v-model="addSkillSelection[phase]"
                      :options="addableSkillOptions(phase)"
                      optionLabel="label"
                      optionValue="value"
                      :placeholder="t('widgets.agentSkills.addSkill')"
                      class="add-skill-dropdown"
                      size="small"
                      @update:modelValue="onAddSkill(phase)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../../assets/style/colors';

.agent-skills-configurator {
  border: 1px solid @mrcall_borders;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.empty-state {
  padding: 2rem;
}

.phases-container {
  display: flex;
  flex-direction: column;
}

.phase-section {
  border-bottom: 1px solid @mrcall_borders;
  &:last-child {
    border-bottom: none;
  }
}

.phase-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background-color 0.15s;
  &:hover {
    background-color: @mrcall_light_grey_2;
  }
}

.phase-has-entries > .phase-header {
  background-color: rgba(59, 130, 246, 0.03);
}

.phase-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.expand-icon {
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
  width: 14px;
  text-align: center;
}

.phase-icon {
  font-size: 1rem;
}

.phase-title-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.phase-title {
  font-weight: 600;
  font-size: 0.9rem;
}

.phase-subtitle {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.phase-badge {
  font-size: 0.65rem !important;
  padding: 1px 6px !important;
}

.phase-body {
  border-top: 1px solid @mrcall_borders;
  background-color: @mrcall_light_grey_2;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.phase-empty {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  font-style: italic;
  padding: 4px 0;
}

.entries-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entry-card {
  background: white;
  border: 1px solid @mrcall_borders;
  border-radius: 6px;
  overflow: hidden;
}

.entry-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 10px 12px;
  gap: 8px;
}

.entry-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.entry-name {
  font-weight: 600;
  font-size: 0.85rem;
}

.entry-description {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  line-height: 1.3;
}

.entry-fields {
  border-top: 1px solid @mrcall_borders;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-label {
  font-size: 0.8rem;
  font-weight: 500;
}

.required-mark {
  color: #ef4444;
}

.config-hint {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
}

.entry-oauth {
  border-top: 1px solid @mrcall_borders;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oauth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.oauth-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.oauth-label {
  font-size: 0.8rem;
  font-weight: 500;
  flex: 1;
}

.oauth-badge {
  font-size: 0.6rem !important;
  padding: 1px 6px !important;
}

.oauth-actions {
  display: flex;
  gap: 6px;
}

.kv-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kv-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kv-key {
  flex: 2;
}

.kv-value {
  flex: 3;
}

.add-skill-row {
  padding-top: 2px;
}

.add-skill-dropdown {
  width: 100%;
}

.json-editor-field {
  min-height: 120px;
}

.entry-orphaned {
  border-color: #f59e0b;
  background: #fffbeb;
}

.entry-orphaned-hint {
  font-size: 0.72rem;
  color: #d97706;
  font-style: italic;
}
</style>
