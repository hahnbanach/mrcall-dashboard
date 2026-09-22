<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";
import agentSkillsUtils from "@/utils/AgentSkills";
import { GoogleAuthFlow } from '@/utils/OAuth';
import { useToast } from "primevue/usetoast";
import SkillCard from '@/components/widgets/skills/SkillCard.vue';
import { LABEL_FIELD_KEY, fieldsOf } from '@/components/widgets/skills/manifestFields';
import { useSkillGrants } from '@/components/widgets/skills/useSkillGrants';

const { t, locale } = useI18n();
const toast = useToast();
const store = useStore();

const props = defineProps({
  modelValue: { type: [String, Object], default: '{}' },
  businessId: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue', 'request-save']);

const PHASES = ['prefetch', 'during', 'final'];


const availableSkills = ref([]);
const config = ref({ prefetch: [], during: [], final: [] });
const loading = ref(false);
// One phase open, and one open from the start. All three shut is a widget that looks like it
// holds nothing, and three open is three lists of cards to scroll past to reach the third. The
// first phase is the one that opens because it is the first: a rule about which phase is most
// used would be a guess, and this one is at least predictable.
const openPhase = ref(PHASES[0]);
const addSkillSelection = ref({ prefetch: null, during: null, final: null });

// Parse initial value
watch(() => props.modelValue, (newVal) => {
  const parsed = agentSkillsUtils.parseConfig(newVal);
  if (JSON.stringify(parsed) !== JSON.stringify(config.value)) {
    config.value = parsed;
  }
}, { immediate: true });

/** Hand the current configuration to the parent, now rather than on the next tick.
 *
 * The watcher below does this for every ordinary edit and is enough for all of them, because the
 * parent only has to hold the value by the time somebody presses Save. It is NOT enough on the one
 * path that edits and then immediately asks the parent to save and navigate away: a Vue watcher
 * flushes after the current tick, so `emit('request-save')` fired in the same tick sends the
 * parent's PREVIOUS copy.
 *
 * Measured on business 2d81b01d, 2026-09-21 15:09: authorising a calendar instance wrote the grant
 * name into the entry and saved, and what reached the database had no `SKILL_CALENDAR_AUTH` at all
 * and the `enabled` the entry had before it was touched. Both edits were real and both were
 * discarded by the save they triggered, which reads from the outside as an authorisation that did
 * nothing and a switch that moved on its own.
 */
function emitConfig() {
  emit('update:modelValue', agentSkillsUtils.serializeConfig(config.value));
}

// Emit on config change
watch(() => config.value, () => {
  emitConfig();
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

function isPhaseOpen(phase) {
  return openPhase.value === phase;
}

// Same rule as the cards inside them: opening one shuts the others, and clicking the open one
// shuts it, so all three closed stays reachable.
function togglePhase(phase) {
  openPhase.value = openPhase.value === phase ? null : phase;
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

// Which entry is open, per phase, and at most one. A phase with six skills in it is a page nobody
// can read, and the thing somebody is editing is almost always one: opening a second closes the
// first rather than pushing it further down.
//
// Keyed by the entry's own identity and not by its position: duplicating inserts and removing
// shifts, and an index kept across either opens whichever card moved into that slot.
const openEntry = ref({ prefetch: null, during: null, final: null });

function entryKeyOf(entry, idx) {
  return (entry && entry.instanceId) || `idx:${idx}`;
}

function isEntryOpen(phase, entry, idx) {
  return openEntry.value[phase] === entryKeyOf(entry, idx);
}

function toggleEntry(phase, entry, idx) {
  // Opening a card is when its calendars are worth fetching: before that nobody is looking, and
  // fetching for every instance on the page would be one Google round trip per card.
  const oauthField = getFields(entry).find(f => f.type === 'oauth');
  if (oauthField) loadCalendars(oauthField, entry);
  const key = entryKeyOf(entry, idx);
  openEntry.value[phase] = openEntry.value[phase] === key ? null : key;
}

// The ids that authorisations still name, including those of cards that no longer exist. An id is
// never handed out again while a grant refers to it: see `_nextInstanceId`.
function reservedInstanceIds() {
  return oauthGrants.value.map(g => g.grantName).filter(Boolean);
}

function onAddSkill(phase) {
  const skillName = addSkillSelection.value[phase];
  if (!skillName) return;
  const skillObj = agentSkillsUtils.findSkill(availableSkills.value, skillName);
  if (!skillObj) return;
  config.value = agentSkillsUtils.addSkillToPhase(config.value, skillObj, phase, reservedInstanceIds());
  // Open what was just created: it is empty, and a card that arrives closed reads as nothing
  // having happened. Everything else stays closed, which is how the page opens.
  openEntry.value[phase] = entryKeyOf(getPhaseEntries(phase)[0], 0);
  addSkillSelection.value[phase] = null;
}

function duplicateEntry(phase, idx) {
  const entry = getPhaseEntries(phase)[idx];
  if (!entry) return;
  const skillObj = getSkillObj(entry.skill);
  config.value = agentSkillsUtils.duplicateInPhase(config.value, skillObj, phase, idx, reservedInstanceIds());
  const copy = getPhaseEntries(phase)[idx + 1];
  openEntry.value[phase] = entryKeyOf(copy, idx + 1);
}



function getSkillObj(skillName) {
  return agentSkillsUtils.findSkill(availableSkills.value, skillName);
}

// Every instance of every phase, not this phase's: two instances of one skill in two different
// phases are two things a reader has to tell apart, and until now they carried the same label.
function allEntries() {
  return PHASES.flatMap(p => getPhaseEntries(p));
}

function instanceLabel(entry) {
  const written = ((entry.params || {})[LABEL_FIELD_KEY] || '').trim();
  if (written) {
    // A written name is chosen by a person and nothing stops two instances carrying the same one.
    // Left alone that would reopen exactly the problem this field was added to close: an
    // authorisation named "Sala 2" pointing at either of two cards. When the name is shared it is
    // qualified with the number the platform assigned, which is unique and never moves.
    const sharing = allEntries().filter(e =>
      ((e.params || {})[LABEL_FIELD_KEY] || '').trim().toLowerCase() === written.toLowerCase());
    if (sharing.length <= 1) return written;
    const n = (entry.instanceId || '').match(/_(\d+)$/);
    return n ? `${written} #${n[1]}` : written;
  }
  const skillObj = getSkillObj(entry.skill);
  if (!skillObj) return agentSkillsUtils.skillDisplayName(entry.skill) + ' (unavailable)';
  return agentSkillsUtils.instanceDisplayLabel(skillObj, entry, allEntries(), currentLang.value);
}

// With a name of its own, the card's own title is worth keeping in sight: it is what says which
// skill this is, and the name says which one of them.
function instanceSubtitle(entry) {
  const written = ((entry.params || {})[LABEL_FIELD_KEY] || '').trim();
  if (!written) return '';
  const skillObj = getSkillObj(entry.skill);
  return skillObj
    ? agentSkillsUtils.instanceDisplayLabel(skillObj, entry, allEntries(), currentLang.value)
    : agentSkillsUtils.skillDisplayName(entry.skill);
}

function getFields(entry) {
  return fieldsOf(getSkillObj(entry.skill));
}

function setFieldValue(phase, index, fieldKey, value) {
  if (props.disabled) return;
  config.value = agentSkillsUtils.updateEntryParam(config.value, phase, index, fieldKey, value);
}


/** Whether another instance already carries this name.
 *
 * Compared case-insensitively and on the trimmed text, because "Sala 2", "sala 2" and "Sala 2 "
 * are one name to the person reading the card and three to a string comparison. Reported on the
 * field rather than refused on save: the name is not a key, nothing breaks if two are alike, and
 * refusing a save would strand somebody mid-edit on a page with twenty other settings. What it
 * must not do is pass unnoticed, because the list of authorisations names instances BY this.
 */
function labelClashes(entry) {
  const written = ((entry.params || {})[LABEL_FIELD_KEY] || '').trim().toLowerCase();
  if (!written) return false;
  return allEntries().filter(e =>
    ((e.params || {})[LABEL_FIELD_KEY] || '').trim().toLowerCase() === written).length > 1;
}

/** The authorisations, from the composable that owns them.
 *
 * Held as ONE object and handed to every card as a prop, rather than destructured into eight
 * bindings and drilled through eight attributes. A card asks it what it needs to draw an
 * authorisation; what stays here is what needs this component rather than a card: the connect flow,
 * which navigates away from the page and has to save first, and the revoke on delete.
 */
const grants = useSkillGrants({
  store,
  businessId: () => props.businessId,
  fieldsOf: getFields,
  entriesOf: allEntries,
  setFieldValue,
  t
});

const {
  oauthGrants, checkOAuthStatus, grantFor, loadCalendars,
  ownsGrant, instancesUsing, useExistingGrant, revokeGrant
} = grants;

/** Deleting an instance, and what becomes of the authorisation it asked for.
 *
 * An authorisation is stored under the instance id, so deleting the card that asked for it used to
 * leave a row at Google that nothing on the screen named: an orphan. Two outcomes and no third:
 *
 *  - ANOTHER INSTANCE STILL USES IT. It is inherited, which needs no act at all — the borrower's
 *    field already names it and keeps working. What had to change is what this screen CALLS such a
 *    grant: it was labelled orphaned because no card OWNED it, when the question is whether any
 *    card USES it.
 *  - NOBODY USES IT. It is revoked here and now, with the card that was its only reason for
 *    existing. Leaving it is what produced a Google account still authorised for a business whose
 *    screen shows nothing about it, and the id it was stored under is never handed out again, so
 *    it could not even be reclaimed by accident.
 */
async function removeEntry(phase, index) {
  if (props.disabled) return;
  const entry = getPhaseEntries(phase)[index];
  const oauthField = entry ? getFields(entry).find(f => f.type === 'oauth') : null;
  const owned = oauthField ? grantFor(oauthField, entry) : null;
  const wasOwner = owned && ownsGrant(entry, owned);

  config.value = agentSkillsUtils.removeFromPhase(config.value, phase, index);

  if (!wasOwner) return;
  if (instancesUsing(owned.grantName).length > 0) return; // inherited by whoever still names it
  try {
    await revokeGrant(oauthField, owned);
  } catch (error) {
    // The configuration is already saved without the card; a grant that could not be revoked is
    // reported rather than swallowed, because the alternative is a live authorisation nobody knows
    // about.
    console.error('Could not revoke the authorisation of a deleted instance:', error);
    toast.add({
      severity: 'warn',
      summary: t('widgets.agentSkills.oauthRevokeFailed'),
      life: 10000
    });
  }
}

async function handleOAuthDisconnect(field, phase, entryIdx, entry) {
  try {
    const user = store.state.user;
    if (!user) return;
    const grant = grantFor(field, entry);
    if (!grant) return;

    // BORROWED: this instance did not ask for this authorisation and must not be able to take it
    // from the instances that did. Stopping using it is a deselection, and it is local to this
    // card. Revoking here used to be the same button, which meant that detaching one card silently
    // logged out every other card sharing the account.
    if (!ownsGrant(entry, grant)) {
      setFieldValue(phase, entryIdx, field.key, '');
      return;
    }

    // OWN, BUT SHARED: revoking would take it from the others too. The owner is not asked to
    // choose between breaking them and keeping it — it is refused, and the others are named, so
    // that whoever wants it gone knows what has to be detached first.
    const others = instancesUsing(grant.grantName).filter(e => e !== entry);
    if (others.length > 0) {
      toast.add({
        severity: 'warn',
        summary: t('widgets.agentSkills.oauthSharedRefuse'),
        detail: others.map(e => instanceLabel(e)).join(', '),
        life: 10000
      });
      return;
    }
    await revokeGrant(field, grant);
  } catch (error) {
    console.error('OAuth disconnect error:', error);
  }
}

async function handleOAuthConnect(field, phase, entryIdx, entry) {
  try {
    // THIS INSTANCE'S OWN ID, never the name currently in the field.
    //
    // It used to read the field, which holds a BORROWED name whenever this instance was set to act
    // with another card's authorisation. Pressing Authorise there did not create an authorisation
    // for this instance: it overwrote the other card's, at Google, and the calendar chosen in the
    // picker was then applied to that other card — which is what "I authorise one skill and keep
    // seeing the other one's calendar" was. An authorisation belongs to whoever asked for it.
    //
    // A skill that cannot be instantiated twice has no id, and for it the empty name means the
    // business-level authorisation, which is what it has always meant.
    const grantName = entry.instanceId || '';
    setFieldValue(phase, entryIdx, field.key, grantName);

    // SAVED AUTOMATICALLY, and the redirect does not happen if the save did not. Authorising
    // navigates away from this page, and an instance that exists only in this component's memory is
    // gone when the callback comes back: the entry disappears and the authorisation, if it were
    // granted, would be stored under the name of an instance nobody can find. The grant and the
    // instance it belongs to are one thing, so they are persisted together or not at all.
    //
    // Nobody is asked to save first, and until 2026-09-21 one skill effectively was: the server
    // refused to store an instance missing a required field, so `google_sheets_read` — which needs
    // a spreadsheet id — could not be saved and therefore could not be authorised, while the
    // calendar skills, which require nothing, went through. Completeness is now asked only of an
    // instance that is switched on, and a new one is created off, so this save succeeds for every
    // skill alike.
    // Synchronously, before asking for the save: see `emitConfig`. The watcher would deliver this
  // after the save had already read the old copy.
  emitConfig();
  const saved = await new Promise(resolve => emit('request-save', resolve));
    if (!saved) {
      toast.add({
        severity: 'warn',
        summary: t('widgets.agentSkills.oauthSaveFirst'),
        life: 8000
      });
      return;
    }

    localStorage.setItem('oauthProvider', field.provider);
    localStorage.setItem('oauthBusinessId', props.businessId || '');
    localStorage.setItem('oauthGrantName', grantName);
    // Save current page URL so callback can redirect back here
    localStorage.setItem('oauthReturnUrl', window.location.pathname + window.location.search);
    const { state, codeChallenge } = await GoogleAuthFlow.begin()

    // The scopes come from the backend catalogue, and so does the verdict on them. StarChat holds
    // the OAuth client and the manifests, compares the two per client, and sends the result as a
    // diagnostic with the skill; this screen used to hold a copy of that comparison and refused a
    // scope Google had been granting for months. The button is not offered at all when a skill
    // carries diagnostics, so reaching here means there was nothing to say.
    const scopes = (field.scopes || []).join(' ');

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
    localStorage.removeItem('oauthBusinessId');
    localStorage.removeItem('oauthGrantName');
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

// Whichever card is open, in whichever phase, asks for its calendars. The toggle does it too, but
// a card can be open without having been toggled — the one just created, and the one returned to
// after the authorisation round trip — and those are exactly the cards whose calendar matters.
watch([openEntry, availableSkills], () => {
  if (!availableSkills.value || availableSkills.value.length === 0) return;
  for (const phase of PHASES) {
    getPhaseEntries(phase).forEach((entry, idx) => {
      if (!isEntryOpen(phase, entry, idx)) return;
      const oauthField = getFields(entry).find(f => f.type === 'oauth');
      if (oauthField) loadCalendars(oauthField, entry);
    });
  }
}, { deep: true });

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
            <i :class="isPhaseOpen(phase) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
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
        <div v-if="isPhaseOpen(phase)" class="phase-body">

          <!-- Adding one, at the top: this is where the eye already is when the phase opens, and
               a new instance is put at the head of the list so it appears right here rather than
               below everything already configured. -->
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
          <div v-if="getPhaseEntries(phase).length > 0" class="entries-list">
            <SkillCard v-for="(entry, idx) in getPhaseEntries(phase)"
                       :key="entryKeyOf(entry, idx)"
                       :entry="entry"
                       :skill="getSkillObj(entry.skill)"
                       :phase="phase"
                       :open="isEntryOpen(phase, entry, idx)"
                       :disabled="disabled"
                       :title="instanceLabel(entry)"
                       :subtitle="instanceSubtitle(entry)"
                       :label-clash="labelClashes(entry)"
                       :grants="grants"
                       @toggle="toggleEntry(phase, entry, idx)"
                       @update:field="setFieldValue(phase, idx, $event.key, $event.value)"
                       @duplicate="duplicateEntry(phase, idx)"
                       @remove="removeEntry(phase, idx)"
                       @oauth-connect="handleOAuthConnect($event, phase, idx, entry)"
                       @oauth-disconnect="handleOAuthDisconnect($event, phase, idx, entry)"
                       @use-grant="useExistingGrant(phase, idx, $event.field, $event.grantName)" />
          </div>

          <!-- Empty state for phase -->
          <div v-else class="phase-empty">
            <span>{{ t('widgets.agentSkills.noSkillsInPhase') }}</span>
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

.add-skill-row {
  // it sits above the list now, not under it
  padding-bottom: 8px;
}

.add-skill-dropdown {
  width: 100%;
}

</style>
