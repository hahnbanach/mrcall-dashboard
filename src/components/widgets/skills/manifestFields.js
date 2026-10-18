/**
 * What a manifest says about one instance's fields, as plain functions.
 *
 * WHY IT IS NOT IN THE COMPONENT. Every one of these was a method of the configurator, which meant
 * that reading a field's label, or deciding whether a field is shown in this phase, required
 * mounting a component with a store, a toast and an i18n instance. The rules themselves depend on
 * nothing but the manifest, the entry and the language, so they are written here and tested by
 * calling them. The card and the configurator both need them, which is the other half of the
 * reason: a skill card drawing a field and a configurator deciding which calendars to fetch were
 * asking the same question of the same manifest through two copies of the answer.
 *
 * Nothing here reads or writes state, and nothing here knows about Vue.
 */

/** The name whoever configured an instance gave it. Declared by both phase contracts, so every
 *  skill has one, and it is the only label on the screen a person chose rather than a generator
 *  produced. */
export const LABEL_FIELD_KEY = 'label';

/** The calendar an instance books on, written by the picker that runs at the end of the
 *  authorisation. Still matched by name: see `CalendarField` for why the source is not declared. */
export const CALENDAR_FIELD_KEY = 'calendarId';

/** Drawn by hand and not by the loop over the schema: `enabled` in the header strip, where it is
 *  reachable with the card shut, and `label` at the very top of the card. Both are about the
 *  instance rather than about what the skill does, and the schema cannot place them — the phase
 *  contract's fields are appended AFTER a skill's own, so left to the loop the name of the card
 *  would appear below every setting it names. */
export const HEADER_FIELD_KEYS = ['enabled', LABEL_FIELD_KEY];

export function fieldsOf(skill) {
  return (skill && skill.configSchema && skill.configSchema.fields) || [];
}

/**
 * The value this instance carries for a field.
 *
 * Params first, then the entry itself, which is the order the runtime reads them in
 * (`AGENT_SKILL:prefetch.sc`). `inject` lived on the entry before it was a declared field, so an
 * instance configured then would otherwise show the default while running on its stored value.
 */
export function valueOf(entry, fieldKey) {
  if (!entry) return '';
  if (entry.params && entry.params[fieldKey] !== undefined) return entry.params[fieldKey];
  if (entry[fieldKey] !== undefined) return entry[fieldKey];
  return '';
}

/** `*` is the default across the localized maps of this system, and it sits above `en`. */
function localised(field, lang) {
  if (!field || !field.labels) return {};
  return field.labels[lang] || field.labels['*'] || field.labels['en'] || {};
}

export function labelOf(field, lang) {
  return localised(field, lang).label || (field && field.key) || '';
}

export function hintOf(field, lang) {
  return localised(field, lang).hint || '';
}

/** An option's title and explanation in `lang` (`options[].labels`, StarChat 2026-10-18), falling back to the English
  * `label` every server has sent, then to the value itself. */
export function optionTextOf(option, lang) {
  const text = (option && option.labels && (option.labels[lang] || option.labels['*'] || option.labels['en'])) || {};
  return { label: text.label || (option && option.label) || (option && option.value) || '', hint: text.hint || '' };
}

/**
 * What goes INSIDE an empty box, which is not the hint.
 *
 * The hint is already rendered under the control, and these hints are long: every prompt field
 * carries the whole %%var%% syntax in its own. A placeholder is an example of a VALUE, and the only
 * example this schema carries is the field's own default; a field without one shows an empty box,
 * which is the honest thing for a box nobody has filled in.
 */
export function placeholderOf(field) {
  return !field || field.default === undefined || field.default === null ? '' : String(field.default);
}

/** Stored as a string, because that is how a business variable stores a boolean. */
export function isEnabled(entry) {
  return String((entry && entry.params && entry.params.enabled) || '').trim().toLowerCase() === 'true';
}

export function oauthFields(skill) {
  return fieldsOf(skill).filter(f => f.type === 'oauth');
}

export function labelFieldOf(skill) {
  return fieldsOf(skill).find(f => f.key === LABEL_FIELD_KEY) || null;
}

export function visibleInPhase(field, phase) {
  if (!field.phases || field.phases.length === 0) return true;
  return field.phases.includes(phase);
}

/**
 * Whether a field means anything in the state this instance is in.
 *
 * `visibleWhen` names sibling fields and the values they must hold, and the schema is where that
 * condition is written: `firstInteraction` asks whether a fragment also goes into the welcome
 * message, which cannot happen for a fragment that `inject` keeps out of the prompt altogether, so
 * the contract declares `{"inject": true}` and the runtime applies the same rule.
 *
 * Compared as strings, and against the sibling's default when nothing has been written: `inject` is
 * on unless it was turned off.
 */
export function visibleHere(skill, entry, field) {
  if (!field.visibleWhen) return true;
  const fields = fieldsOf(skill);
  return Object.keys(field.visibleWhen).every(siblingKey => {
    const sibling = fields.find(f => f.key === siblingKey);
    const raw = valueOf(entry, siblingKey);
    const value = raw === '' || raw === undefined
      ? (sibling && sibling.default !== undefined ? sibling.default : '')
      : raw;
    return String(value) === String(field.visibleWhen[siblingKey]);
  });
}

/**
 * A field kept for the configurations that already carry it, and asked of nobody new.
 *
 * `variables` is the one: version 1 declared a skill's arguments inside its configuration, version
 * 2 declares them in the manifest, and every skill shipped today marks the old field deprecated.
 *
 * Hidden when it is EMPTY, not always. A configuration that carries a value has to be able to show
 * it and clear it; hiding a filled field would hide the only evidence that it is there.
 */
export function retiredAndEmpty(entry, field) {
  if (!field.deprecated) return false;
  const value = valueOf(entry, field.key);
  return value === undefined || value === null || String(value).trim() === ''
    || String(value).trim() === '[]' || String(value).trim() === '{}';
}

/** The `x-audience` value of a field that only its skill's own page edits (StarChat R8). */
export const PAGE_AUDIENCE = 'page';

/**
 * Whether the person looking is meant to see this field. A manifest marks a technical field
 * `x-audience: platform` (carried down as `audience`): an admin sees it, an owner does not. It hides;
 * it does not protect: the server refuses no field by role.
 *
 * `x-audience: page` is drawn by nobody here, admins included: the field has one editor, its skill's own
 * page (the restaurant's hours, rules and "what we ask for every booking"), and a second editor in this form
 * is the duplicate the owner asked to remove (brief, addendum 2026-10-12 (2)). `platform` could not be reused
 * for it because an admin still sees a `platform` field. The card shows what those fields are and where they
 * are edited instead (`pageFieldsOf`).
 */
export function visibleTo(field, viewer) {
  if (field.audience === PAGE_AUDIENCE) return false;
  return field.audience !== 'platform' || !!(viewer && viewer.admin);
}

/** The fields of a skill that only its page edits, in the manifest's order. */
export function pageFieldsOf(skill) {
  return fieldsOf(skill).filter(f => f.audience === PAGE_AUDIENCE);
}

/** The switch of a skill that has a page of its own: the page on or off. Declared by the manifest as an
 *  ordinary boolean field named so; a skill without it has the one switch it always had, `enabled`. */
export const PAGE_SWITCH_KEY = 'page';

export function pageSwitchOf(skill) {
  return fieldsOf(skill).find(f => f.key === PAGE_SWITCH_KEY && (f.type === 'boolean' || f.widget === 'boolean')) || null;
}

/** A boolean as the variables store it ("true", "false", a JSON boolean), or the field's default when the
 *  instance stores nothing. */
function booleanOf(entry, field) {
  const raw = valueOf(entry, field.key);
  const v = raw === '' || raw === undefined || raw === null ? field.default : raw;
  return String(v === undefined || v === null ? '' : v).trim().toLowerCase() === 'true';
}

/** Whether the skill's page is on; true for a skill without a page switch, which has nothing to turn off. */
export function isPageOn(skill, entry) {
  const field = pageSwitchOf(skill);
  return field ? booleanOf(entry, field) : true;
}

/**
 * What one flick of the page switch writes. Off writes `enabled` off in the SAME edit, so the one save that
 * follows carries both: StarChat refuses an instance with the assistant on and the page off
 * (`assistant_without_page`) and does not switch the assistant off itself, so the editor must send both
 * (plan R8r, "the coupled save"). On writes only the page: the assistant stays off until somebody turns it on.
 */
export function pageSwitchWrites(on) {
  return on
    ? [{ key: PAGE_SWITCH_KEY, value: 'true' }]
    : [{ key: PAGE_SWITCH_KEY, value: 'false' }, { key: 'enabled', value: 'false' }];
}

/** Everything the card draws in its body: not the OAuth fields, not the two drawn by hand (nor the page
 *  switch, drawn in the strip in place of `enabled`), not a
 *  retired one nobody filled, not one this phase or this state has no use for, not one meant for the
 *  platform's people when an owner is looking. */
export function configurableFields(skill, entry, phase, viewer = { admin: false }) {
  const pageSwitch = pageSwitchOf(skill);
  return fieldsOf(skill).filter(f =>
    f.type !== 'oauth' && !HEADER_FIELD_KEYS.includes(f.key) && f !== pageSwitch
    && !retiredAndEmpty(entry, f)
    && visibleInPhase(f, phase) && visibleHere(skill, entry, f) && visibleTo(f, viewer));
}

/**
 * Whether this entry, in this phase, shows a box a %%var%% template can be written in.
 *
 * The syntax of those templates is one paragraph, and it used to live inside the hint of every
 * prompt field: 36 copies of the same 550 characters across six skills and three language slots. It
 * is said once per card now, and the hints say only what is true of their own field.
 */
export function hasTemplateFields(skill, entry, phase, viewer = { admin: false }) {
  return configurableFields(skill, entry, phase, viewer)
    .some(f => f.type === 'textarea' || String(f.key).startsWith('prompt'));
}

export function descriptionOf(skill, lang) {
  if (!skill) return '';
  const i18n = skill.descriptionI18n || {};
  const localizedText = i18n[lang] || i18n['en'] || skill.description || '';
  return localizedText.replace(/\[Skill:.*?\]\s*/, '');
}

/**
 * What the backend says is wrong with this skill, as it is installed HERE.
 *
 * Sent per skill by the catalogue — the schema's own verdict plus the one thing only the deployment
 * knows, whether its OAuth client can obtain the scopes the skill asks for. The channel existed all
 * along and the screen discarded it, so a skill that could not possibly be authorised looked exactly
 * like one that could until somebody pressed the button.
 */
export function errorDiagnostics(skill) {
  return ((skill && skill.diagnostics) || []).filter(d => (d.severity || 'error') === 'error');
}

/**
 * Which arguments this instance really requires, which is not always what the skill declares.
 *
 * `x-required-when` makes an argument mandatory only in the state the instance is configured into:
 * the identifier of the appointment to cancel is needed when the instance cancels ONE named
 * appointment and not when it cancels everything the caller has, and the confirmation is needed when
 * the instance asks for one. The catalogue publishes the arguments materialised against NO
 * configuration — it answers for the skill, not for an instance — so a card that printed that
 * answer would tell somebody an identifier is optional for a call the platform refuses without it.
 *
 * The same two forms the platform reads: a string names a property and means "set", an object names
 * a property and a value and means "holds that value".
 */
export function requiredArguments(skill, entry) {
  const manifest = (skill && skill.manifest) || {};
  const args = manifest.arguments || {};
  const declared = new Set(args.required || []);
  const properties = args.properties || {};
  return Object.keys(properties).filter(name => {
    if (declared.has(name)) return true;
    const when = properties[name]['x-required-when'];
    if (typeof when === 'string') return String(valueOf(entry, when) || '').trim() !== '';
    if (when && typeof when === 'object') {
      return Object.keys(when).every(key => String(valueOf(entry, key) || '') === String(when[key]));
    }
    return false;
  });
}

/** The skill's arguments as this instance publishes them: the catalogue's rows, with the mandatory
  * flag answered for this configuration rather than for no configuration at all. */
export function argumentsOf(skill, entry) {
  const required = new Set(requiredArguments(skill, entry));
  return ((skill && skill.parameters) || []).map(p => ({ ...p, required: required.has(p.name) }));
}
