<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";
import agentSkillsUtils from "@/utils/AgentSkills";
import { GoogleAuthFlow } from '@/utils/OAuth';
import { useToast } from "primevue/usetoast";
import { componentFor } from '@/components/widgets/skills/fields';

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

// The calendar an instance books on. Written by the picker that runs at the end of the
// authorisation, read here to label an authorisation with something a person recognises.
const CALENDAR_FIELD_KEY = 'calendarId';

// The name whoever configured this instance gave it. Declared by both phase contracts, so every
// skill has one, and it is the only label on this screen that a person chose rather than a
// generator produced: when it is set it wins over the skill's title everywhere an instance is
// named, including the list of authorisations.
const LABEL_FIELD_KEY = 'label';


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

function isEntryEnabled(entry) {
  return String((entry && entry.params && entry.params.enabled) || '').trim().toLowerCase() === 'true';
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

function isOrphanedEntry(entry) {
  return !getSkillObj(entry.skill);
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
  const skillObj = getSkillObj(entry.skill);
  return skillObj ? agentSkillsUtils.getSkillFields(skillObj) : [];
}

/** What a widget needs beyond the contract every field shares.
 *
 * Three widgets want something the card knows and they do not: how long an appointment lasts, which
 * language the labels are read in, and which calendars an authorisation offers. Everything else is
 * drawn from `field`, the value and `disabled`, which is why adding a widget usually adds nothing
 * here at all.
 */
function fieldProps(field, entry) {
  const widget = field.widget || field.type;
  if (widget === 'weekly_hours') {
    return { slotDuration: Number(getFieldValue(entry, 'durationMinutes')) || 15 };
  }
  if (widget === 'list' || widget === 'tuples') {
    return { locale: currentLang.value };
  }
  // Still by name, and only here: see `CalendarField` for why the source is not declared yet.
  if (widget === 'calendar' || field.key === CALENDAR_FIELD_KEY) {
    return { options: calendarOptions(entry), summary: calendarSummary(entry) };
  }
  return {};
}

function getFieldValue(entry, fieldKey) {
  // Params first, then the entry itself, which is the order the runtime reads these in
  // (`AGENT_SKILL:prefetch.sc`). `inject` lived on the entry before it was a declared field, so an
  // instance configured then would otherwise show the default while running on its stored value.
  if (entry.params && entry.params[fieldKey] !== undefined) return entry.params[fieldKey];
  if (entry[fieldKey] !== undefined) return entry[fieldKey];
  return '';
}

function setFieldValue(phase, index, fieldKey, value) {
  if (props.disabled) return;
  config.value = agentSkillsUtils.updateEntryParam(config.value, phase, index, fieldKey, value);
}

function getFieldLabel(field) {
  if (field.labels) {
    // `*` is the default across the localized maps of this system, and it sits above `en`.
    const labels = field.labels[currentLang.value] || field.labels['*'] || field.labels['en'] || {};
    return labels.label || field.key;
  }
  return field.key;
}

function getFieldHint(field) {
  if (field.labels) {
    // `*` is the default across the localized maps of this system, and it sits above `en`.
    const labels = field.labels[currentLang.value] || field.labels['*'] || field.labels['en'] || {};
    return labels.hint || '';
  }
  return '';
}

/**
 * What goes INSIDE an empty box, which is not the hint.
 *
 * The hint is already rendered under the control, and these hints are long: every prompt field
 * carries the whole %%var%% syntax in its own, some 660 characters of it, so the same paragraph
 * appeared twice on one screen. Greyed out inside the textbox it reads as an example the user is
 * meant to follow rather than as help they have already read, and it is neither.
 *
 * A placeholder is an example of a VALUE. The only example this schema carries is the field's own
 * default, and a field without one shows an empty box, which is the honest thing for a box nobody
 * has filled in.
 */
function getFieldPlaceholder(field) {
  return field.default === undefined || field.default === null ? '' : String(field.default);
}

function skillDescription(entry) {
  const skillObj = getSkillObj(entry.skill);
  if (!skillObj) return '';
  const lang = currentLang.value;
  const i18n = skillObj.descriptionI18n || {};
  const localized = i18n[lang] || i18n['en'] || skillObj.description || '';
  return localized.replace(/\[Skill:.*?\]\s*/, '');
}

// `enabled` is deliberately not among them: it is drawn in the header instead, where it is
// reachable with the card shut. It is the one setting whose answer has to be visible and
// changeable without opening anything, because it is the setting that decides whether the rest of
// them run at all.
// Drawn by hand and not by the loop over the schema: `enabled` in the header strip, `label` at the
// very top of the card. Both are about the instance rather than about what the skill does, and the
// schema cannot place them — the phase contract's fields are appended AFTER a skill's own, so left
// to the loop the name of the card would appear below every setting it names.
const HEADER_FIELD_KEYS = ['enabled', LABEL_FIELD_KEY];

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

// Written trimmed, so that a trailing space never makes two identical names different in storage.
function setLabelValue(phase, idx, value) {
  setFieldValue(phase, idx, LABEL_FIELD_KEY, (value || '').replace(/\s+/g, ' ').trim());
}

/** What the backend says is wrong with this skill, as it is installed HERE.
 *
 * Sent per skill by `/agent/skills/available` — the schema's own verdict plus the one thing only
 * the deployment knows, whether its OAuth client can obtain the scopes the skill asks for. The
 * channel has existed all along and this screen discarded it, so a skill that could not possibly
 * be authorised looked exactly like one that could until somebody pressed the button.
 */
function skillDiagnostics(entry) {
  const skillObj = getSkillObj(entry.skill);
  const all = (skillObj && skillObj.diagnostics) || [];
  return all.filter(d => (d.severity || 'error') === 'error');
}

function labelField(entry) {
  return getFields(entry).find(f => f.key === LABEL_FIELD_KEY) || null;
}

/** A field kept for the configurations that already carry it, and asked of nobody new.
 *
 * `variables` is the one: version 1 declared a skill's arguments inside its configuration, version
 * 2 declares them in the manifest, and every skill shipped today marks the old field deprecated.
 * It stayed on the screen because the deprecation was written in the manifest and never travelled
 * down to the renderer — so a person configuring a calendar skill was shown a list to fill whose
 * contents the skill would ignore.
 *
 * Hidden when it is EMPTY, not always. A configuration that carries a value has to be able to show
 * it and clear it; hiding a filled field would hide the only evidence that it is there.
 */
function isRetiredAndEmpty(entry, field) {
  if (!field.deprecated) return false;
  const value = getFieldValue(entry, field.key);
  return value === undefined || value === null || String(value).trim() === ''
    || String(value).trim() === '[]' || String(value).trim() === '{}';
}

function getNonOauthFields(entry, phase) {
  return getFields(entry).filter(f =>
    f.type !== 'oauth' && !HEADER_FIELD_KEYS.includes(f.key)
    && !isRetiredAndEmpty(entry, f)
    && isFieldVisibleInPhase(f, phase) && isFieldVisibleHere(entry, f));
}

/**
 * Whether this field means anything in the state this instance is in.
 *
 * `visibleWhen` names sibling fields and the values they must hold, and the schema is where that
 * condition is written, not this file: `firstInteraction` asks whether a fragment also goes into
 * the welcome message, which cannot happen for a fragment that `inject` keeps out of the prompt
 * altogether, so the contract declares `{"inject": true}` and the runtime applies the same rule.
 *
 * Compared as strings, because that is how a business variable stores a boolean, and against the
 * sibling's default when nothing has been written: `inject` is on unless it was turned off.
 */
function isFieldVisibleHere(entry, field) {
  if (!field.visibleWhen) return true;
  return Object.keys(field.visibleWhen).every(siblingKey => {
    const sibling = getFields(entry).find(f => f.key === siblingKey);
    const raw = getFieldValue(entry, siblingKey);
    const value = raw === '' || raw === undefined
      ? (sibling && sibling.default !== undefined ? sibling.default : '')
      : raw;
    return String(value) === String(field.visibleWhen[siblingKey]);
  });
}

/**
 * Whether this entry, in this phase, shows a box a %%var%% template can be written in.
 *
 * The syntax of those templates is one paragraph, and it used to live inside the hint of every
 * prompt field: 36 copies of the same 550 characters across six skills and three language slots,
 * so a screen with two prompt boxes said it twice. It is now said once, here, and the hints say
 * only what is true of their own field.
 */
function hasTemplateFields(entry, phase) {
  return getNonOauthFields(entry, phase).some(f => f.type === 'textarea' || String(f.key).startsWith('prompt'));
}

function isFieldVisibleInPhase(field, phase) {
  if (!field.phases || field.phases.length === 0) return true;
  return field.phases.includes(phase);
}

// --- Key/Value pair helpers ---
// Separate reactive state to allow empty-key rows during editing

// --- Tuple helpers (reuses TupleVariable widget from BusinessConfiguration) ---

function getOauthFields(entry) {
  return getFields(entry).filter(f => f.type === 'oauth');
}

// The authorisations this user holds, as the backend lists them. Kept as the list rather than a
// map keyed by provider: one business can now hold several grants for one provider, one per skill
// instance, so a map keyed that way would say "connected" for an instance that is not.
const oauthGrants = ref([]);

async function checkOAuthStatus() {
  const user = store.state.user;
  if (!user) return;
  try {
    const headers = { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
    const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/oauth/providers";
    const response = await (await import('axios')).default.get(url, { headers });
    oauthGrants.value = response.data || [];
  } catch (e) {
    console.debug("OAuth status check failed:", e);
  }
}

// Which authorisation an instance acts with. The instance id the platform already assigns,
// `{outputPrefix}_{N}`, is that name: assigned once, stored with the entry, never shown and never
// typed. An entry that has been pointed at another instance's authorisation carries that name in
// the field instead, which is how one authorisation is reused by two instances.
function grantNameFor(entry, field) {
  const stored = entry && entry.params ? entry.params[field.key] : '';
  return (stored && String(stored).trim()) || (entry && entry.instanceId) || '';
}

// Empty business or empty name mean ANY on the backend, which is the authorisation given before
// these were scoped. An instance is covered by its own, or by one given for the whole business.
function grantFor(field, entry) {
  const wanted = grantNameFor(entry, field);
  const mine = oauthGrants.value.filter(g =>
    g.provider === field.provider && (g.businessId || '') === (props.businessId || ''));
  return mine.find(g => (g.grantName || '') === wanted)
    || mine.find(g => (g.grantName || '') === '')
    || null;
}

function isOAuthConnected(field, entry) {
  return !!grantFor(field, entry);
}

// What this instance could act with instead of asking for a new authorisation: the ones this
// business already holds for the same provider, minus the one it is using. Shown by account, since
// the name is an internal identifier and means nothing to a reader.
// Every authorisation this business holds for this provider, the one in use included.
//
// It used to list only the OTHERS, as a "reuse one" control beside the connect button, and that is
// why choosing one looked like it did nothing: the moment the choice was made the chosen grant
// became the current one, dropped out of its own list, and the whole control disappeared. Nothing
// confirmed the choice and nothing showed what was now in use. One dropdown, with the current
// value selected, says both.
function grantOptions(field) {
  return oauthGrants.value.filter(g =>
    g.provider === field.provider
    && (g.businessId || '') === (props.businessId || '')
    && (g.grantName || ''));
}

/** What to call an authorisation on screen.
 *
 * The account's email, when the grant carries one. Grants given before the connect started sending
 * `providerAccountId` do not, and on this estate that is every one of them, which is why this list
 * read "Google Calendar" three times over and told a reader nothing. So, in order: the account,
 * then the calendar the instance that gave it books on, then the instance's own name. The last is
 * an internal identifier and a poor label, but it is a DISTINGUISHING one, and between a bad name
 * and three identical good ones the bad name is the one you can act on.
 */
/** What to call an authorisation on screen, in a list where several may look alike.
 *
 * It names the CARD the authorisation was given for, always with that card's number, and adds the
 * account when the grant carries one. The number is not optional here as it is on a card header: a
 * header sits above the thing it names, while this list is the only place two authorisations of
 * two instances of one skill can be told apart, and without it they read identically.
 */
function grantAccountLabel(grant) {
  if (!grant) return '';
  const owner = allEntries().find(e => e.instanceId === grant.grantName);
  const parts = [];
  if (owner) {
    // The same function the card header uses, so that what this list names can be found on the
    // screen by reading. Two label rules for one thing is how they came to disagree.
    parts.push(instanceLabel(owner));
    const calendar = calendarNameOf(owner);
    if (calendar) parts.push(calendar);
  } else if (grant.grantName) {
    // No card OWNS it. That is not the same as nobody using it: the instance that asked for it may
    // have been deleted while another card still acts with it, and that grant is inherited rather
    // than orphaned. Named by whoever uses it, and called orphaned only when nobody does.
    const users = instancesUsing(grant.grantName);
    parts.push(users.length > 0
      ? instanceLabel(users[0])
      : t('widgets.agentSkills.oauthOrphanGrant'));
  }
  if (grant.providerAccountId) parts.push(grant.providerAccountId);
  return parts.length ? parts.join(' — ') : grant.grantName;
}

// The calendars of each authorisation, by grant name. Fetched from the backend because the
// identifier stored in the configuration is not a name and the browser cannot ask Google: after
// the authorisation round trip the token belongs to the server.
const calendarsByGrant = ref({});
const calendarsLoading = ref({});

async function loadCalendars(field, entry) {
  if (field.provider !== 'google_calendar') return;
  const grant = grantFor(field, entry);
  if (!grant || !grant.grantName) return;
  if (calendarsByGrant.value[grant.grantName] || calendarsLoading.value[grant.grantName]) return;
  const user = store.state.user;
  if (!user) return;
  calendarsLoading.value = { ...calendarsLoading.value, [grant.grantName]: true };
  try {
    const headers = { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
    const params = new URLSearchParams();
    if (grant.businessId) params.set('businessId', grant.businessId);
    if (grant.grantName) params.set('grantName', grant.grantName);
    const url = process.env.VUE_APP_STARCHAT_URL
      + `/mrcall/v1/mrcall0/oauth/providers/${field.provider}/calendars?${params.toString()}`;
    const response = await (await import('axios')).default.get(url, { headers });
    calendarsByGrant.value = { ...calendarsByGrant.value, [grant.grantName]: response.data || [] };
  } catch (error) {
    console.debug('Could not list the calendars of this authorisation:', error);
    calendarsByGrant.value = { ...calendarsByGrant.value, [grant.grantName]: [] };
  } finally {
    const pending = { ...calendarsLoading.value };
    delete pending[grant.grantName];
    calendarsLoading.value = pending;
  }
}

/** The calendars offered for this instance, with the account's own first. */
function calendarOptions(entry) {
  const oauthField = getFields(entry).find(f => f.type === 'oauth');
  const grant = oauthField ? grantFor(oauthField, entry) : null;
  const list = (grant && calendarsByGrant.value[grant.grantName]) || [];
  return list.map(c => ({
    value: c.id,
    primary: !!c.primary,
    label: c.primary ? `${c.summary} (${t('widgets.agentSkills.calendarPrimary')})` : c.summary
  }));
}

/** The calendar an instance books on, by name when the name is known. */
function calendarNameOf(entry) {
  const current = (entry.params || {})[CALENDAR_FIELD_KEY];
  const known = calendarOptions(entry).find(o => o.value === current);
  if (known) return known.label;
  if (current) return current;
  const primary = calendarOptions(entry).find(o => o.primary);
  return primary ? primary.label : '';
}

/** What to say where the calendar goes when there is nothing to choose from yet, which is never a
 *  blank: either this instance has no authorisation, or the list has not arrived. */
function calendarSummary(entry) {
  const named = calendarNameOf(entry);
  if (named) return named;
  const oauthField = getFields(entry).find(f => f.type === 'oauth');
  if (!oauthField || !isOAuthConnected(oauthField, entry)) {
    return t('widgets.agentSkills.calendarNotChosen');
  }
  return t('widgets.agentSkills.calendarUnavailable');
}

/** Whose authorisation this is.
 *
 * An authorisation is named after the instance that asked for it, so an instance owns the one
 * whose name is its own id and borrows any other. The distinction is not cosmetic: revoking is an
 * act on the Google account and takes the authorisation away from every instance using it, while
 * an instance that merely borrowed one has nothing to revoke and everything to lose by trying.
 */
function ownsGrant(entry, grant) {
  return !!grant && !!entry.instanceId && grant.grantName === entry.instanceId;
}

/** Which instances, anywhere in the configuration, act with this authorisation. */
function instancesUsing(grantName) {
  if (!grantName) return [];
  return allEntries().filter(e => {
    const oauthField = getFields(e).find(f => f.type === 'oauth');
    return oauthField && grantNameFor(e, oauthField) === grantName;
  });
}

function useExistingGrant(phase, entryIdx, field, grantName) {
  if (!grantName) return;
  setFieldValue(phase, entryIdx, field.key, grantName);
}

/** Take an authorisation back from Google. The one act here that cannot be undone from this page:
 *  the tokens are gone and the only way back is the consent screen. */
async function revokeGrant(field, grant) {
  const user = store.state.user;
  if (!user || !grant) return;
  const headers = { "Content-type": "application/json; charset=UTF-8", "auth": user.accessToken };
  // Named exactly as it was looked up. Revoking on the provider alone would take every business's
  // authorisation for it, including ones this screen is not showing.
  const params = new URLSearchParams();
  if (grant.businessId) params.set('businessId', grant.businessId);
  if (grant.grantName) params.set('grantName', grant.grantName);
  const query = params.toString() ? `?${params.toString()}` : '';
  const url = process.env.VUE_APP_STARCHAT_URL
    + `/mrcall/v1/mrcall0/oauth/providers/${field.provider}${query}`;
  await (await import('axios')).default.delete(url, { headers });
  oauthGrants.value = oauthGrants.value.filter(g => g !== grant);
}

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
            <div v-for="(entry, idx) in getPhaseEntries(phase)" :key="idx"
                 :class="['entry-card', { 'entry-orphaned': isOrphanedEntry(entry) }]">
              <!-- Entry header. The whole strip is the toggle, so the target is the card and not a
                   12-pixel chevron; the buttons beside it stop the click from reaching it. -->
              <div class="entry-header entry-header-toggle"
                   @click="toggleEntry(phase, entry, idx)">
                <!-- First on the strip, and there whether the card is open or shut: this is the
                     switch that decides whether the instance runs, and it used to be one field
                     among twenty inside the card. `.stop` so that flicking it does not also open
                     or close what it sits on. -->
                <ToggleSwitch :modelValue="isEntryEnabled(entry)"
                              @update:modelValue="setFieldValue(phase, idx, 'enabled', $event ? 'true' : 'false')"
                              @click.stop
                              :disabled="disabled"
                              class="entry-switch"
                              :title="t('widgets.agentSkills.entryEnabledHint')" />
                <i :class="isEntryOpen(phase, entry, idx) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                   class="entry-chevron"></i>
                <div class="entry-info">
                  <span class="entry-name">{{ instanceLabel(entry) }}</span>
                  <span v-if="instanceSubtitle(entry)" class="entry-subtitle">{{ instanceSubtitle(entry) }}</span>
                  <span v-if="isOrphanedEntry(entry)" class="entry-orphaned-hint">
                    {{ t('widgets.agentSkills.skillUnavailable') }}
                  </span>
                  <span v-else-if="isEntryOpen(phase, entry, idx) && skillDescription(entry)"
                        class="entry-description">{{ skillDescription(entry) }}</span>
                </div>
                <!-- On or off, always one of the two, and never nothing. An instance is created
                     switched off, and a closed card that says nothing about it is how one stays
                     off unnoticed; but a badge that appears only when something is wrong is also a
                     badge whose absence has to be interpreted. Stating both means the strip can be
                     read rather than inferred from. -->
                <Tag :value="isEntryEnabled(entry)
                               ? t('widgets.agentSkills.entryOn')
                               : t('widgets.agentSkills.entryOff')"
                     :severity="isEntryEnabled(entry) ? 'success' : 'warn'"
                     class="entry-state-badge" />
                <Button icon="pi pi-copy" severity="secondary" text rounded size="small"
                        :disabled="disabled" @click.stop="duplicateEntry(phase, idx)"
                        :title="t('widgets.agentSkills.duplicateSkill')" />
                <Button icon="pi pi-times" severity="danger" text rounded size="small"
                        :disabled="disabled" @click.stop="removeEntry(phase, idx)"
                        :title="t('widgets.agentSkills.removeSkill')" />
              </div>

              <!-- OAuth fields -->
              <!-- The name, first, because it names everything below it and because a card opened
                   to be configured is a card whose name is about to matter. -->
              <div v-if="isEntryOpen(phase, entry, idx) && labelField(entry)" class="entry-name-field">
                <label class="config-label" :for="'label-' + (entry.instanceId || idx)">
                  {{ getFieldLabel(labelField(entry)) }}
                </label>
                <InputText :id="'label-' + (entry.instanceId || idx)"
                           :modelValue="getFieldValue(entry, LABEL_FIELD_KEY)"
                           @update:modelValue="setLabelValue(phase, idx, $event)"
                           :invalid="labelClashes(entry)"
                           :disabled="disabled"
                           :placeholder="instanceSubtitle(entry) || instanceLabel(entry)"
                           class="w-full"
                           size="small" />
                <small v-if="labelClashes(entry)" class="config-hint label-clash">
                  {{ t('widgets.agentSkills.labelClash') }}
                </small>
                <small v-else-if="getFieldHint(labelField(entry))" class="config-hint">
                  {{ getFieldHint(labelField(entry)) }}
                </small>
              </div>

              <div v-if="isEntryOpen(phase, entry, idx) && getOauthFields(entry).length > 0" class="entry-oauth">
                <div v-for="field in getOauthFields(entry)" :key="field.key" class="oauth-field">
                  <div class="oauth-status">
                    <i :class="isOAuthConnected(field, entry) ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"
                       :style="{ color: isOAuthConnected(field, entry) ? '#22c55e' : '#f59e0b' }"></i>
                    <span class="oauth-label">{{ getFieldLabel(field) }}</span>
                    <Tag v-if="isOAuthConnected(field, entry)"
                         :value="grantAccountLabel(grantFor(field, entry))"
                         severity="success" class="oauth-badge" />
                  </div>
                  <!-- A skill the platform cannot authorise does not offer a button that cannot
                       work: what is wrong is said here, in the words of the side that knows. -->
                  <div v-if="skillDiagnostics(entry).length > 0" class="oauth-unavailable">
                    <i class="pi pi-exclamation-triangle"></i>
                    <span>{{ skillDiagnostics(entry).map(d => d.detail).join(' · ') }}</span>
                  </div>
                  <div v-else class="oauth-actions">
                    <Button v-if="!isOAuthConnected(field, entry)"
                            :label="t('widgets.agentSkills.oauthConnect')"
                            icon="pi pi-external-link"
                            severity="warning" outlined size="small"
                            @click="handleOAuthConnect(field, phase, idx, entry)"
                            :disabled="disabled" />
                    <Button v-else
                            :label="ownsGrant(entry, grantFor(field, entry))
                                      ? t('widgets.agentSkills.oauthDisconnect')
                                      : t('widgets.agentSkills.oauthStopUsing')"
                            icon="pi pi-times"
                            severity="danger" text size="small"
                            @click="handleOAuthDisconnect(field, phase, idx, entry)"
                            :disabled="disabled" />
                  </div>
                  <!-- Which authorisation this instance acts with, the one in use shown as the
                       selected value. Sharing one between two instances is picking the same entry
                       twice; a new account is the button above. -->
                  <div v-if="grantOptions(field).length > 0" class="oauth-reuse">
                    <label class="oauth-reuse-label">{{ t('widgets.agentSkills.oauthReuse') }}</label>
                    <Dropdown :options="grantOptions(field)"
                              :model-value="grantNameFor(entry, field)"
                              :option-label="grantAccountLabel"
                              option-value="grantName"
                              :placeholder="t('widgets.agentSkills.oauthReusePlaceholder')"
                              :disabled="disabled"
                              class="oauth-reuse-select"
                              @change="useExistingGrant(phase, idx, field, $event.value)" />
                  </div>
                  <small v-if="field.key === CALENDAR_FIELD_KEY" class="config-hint">
                    {{ getFieldValue(entry, field.key)
                         ? t('widgets.agentSkills.calendarChosen')
                         : t('widgets.agentSkills.calendarNotChosen') }}
                  </small>
                  <small v-else-if="getFieldHint(field)" class="config-hint">{{ getFieldHint(field) }}</small>
                </div>
              </div>

              <!-- Config fields (non-OAuth) -->
              <div v-if="isEntryOpen(phase, entry, idx) && getNonOauthFields(entry, phase).length > 0" class="entry-fields">
                <div v-for="field in getNonOauthFields(entry, phase)" :key="field.key" class="config-field">
                  <label class="config-label">
                    {{ getFieldLabel(field) }}
                    <span v-if="field.required" class="required-mark">*</span>
                  </label>

                  <!-- WHICH COMPONENT DRAWS THIS FIELD IS A LOOKUP, not a chain of branches.
                       Eleven of them lived here, two keyed on the NAME of a field rather than on
                       what it is, so a skill that brought a new kind of field made somebody edit
                       this file and re-read the ten that already worked. -->
                  <component v-if="componentFor(field)"
                             :is="componentFor(field)"
                             :field="field"
                             :modelValue="getFieldValue(entry, field.key)"
                             @update:modelValue="setFieldValue(phase, idx, field.key, $event)"
                             :disabled="disabled"
                             :placeholder="getFieldPlaceholder(field)"
                             v-bind="fieldProps(field, entry)" />

                  <!-- Nothing rather than a text box: a field drawn by the wrong widget looks like
                       it works, and writes a value that is wrong in a way nobody sees until a call
                       goes badly. -->
                  <small v-else class="config-hint">
                    {{ t('widgets.agentSkills.unknownWidget', { widget: field.widget || field.type }) }}
                  </small>

                  <small v-if="getFieldHint(field)" class="config-hint">{{ getFieldHint(field) }}</small>
                </div>

                <!-- Said once for the whole entry, not once per prompt field. -->
                <details v-if="hasTemplateFields(entry, phase)" class="template-help">
                  <summary>{{ t('widgets.agentSkills.templateSyntaxTitle') }}</summary>
                  <p>{{ t('widgets.agentSkills.templateSyntaxHelp') }}</p>
                </details>
              </div>
            </div>
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

.template-help {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--p-text-muted-color, #6b7280);
}

.template-help summary {
  cursor: pointer;
}

.template-help p {
  margin: 0.35rem 0 0;
  line-height: 1.45;
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

.entry-header-toggle {
  cursor: pointer;
  user-select: none;
}

.entry-chevron {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  margin-right: 6px;
}

.oauth-unavailable {
  display: flex;
  align-items: flex-start;
  gap: .45rem;
  font-size: .85rem;
  color: var(--red-500, #ef4444);
  padding: .35rem 0;
}

.calendar-unavailable {
  display: flex;
  align-items: center;
  gap: .4rem;
  font-size: .85rem;
  color: var(--text-color-secondary, #6b7280);
  padding: .35rem 0;
}

.label-clash {
  color: var(--red-500, #ef4444);
}

.entry-name-field {
  padding: .75rem 1rem 0;
}

.entry-subtitle {
  font-size: .78rem;
  color: var(--text-color-secondary, #6b7280);
}

.entry-switch {
  flex: 0 0 auto;
  margin-right: 0.25rem;
}

.entry-state-badge {
  margin-right: 6px;
  flex-shrink: 0;
}

.oauth-reuse {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.oauth-reuse-label {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.oauth-reuse-select {
  min-width: 220px;
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
  // it sits above the list now, not under it
  padding-bottom: 8px;
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
