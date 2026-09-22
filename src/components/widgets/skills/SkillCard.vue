<script setup>
/**
 * One configured instance of one skill: the strip that names it, and everything inside it.
 *
 * WHY IT IS A COMPONENT. This was 220 lines of the configurator's template and half its script, and
 * the two are different jobs: the configurator owns the three phases, the list, what is added and
 * removed and what is saved; a card owns how ONE instance is drawn. Adding a skill should not make
 * anybody read either, and while they were one file it made somebody read both.
 *
 * WHAT IT DOES NOT DECIDE. It changes nothing: every edit leaves as an event and the configurator
 * applies it to the configuration it owns. It does not know the other instances either — its title,
 * its subtitle and whether its name clashes are handed to it, because all three are answers about
 * the whole configuration and a card that computed them would be reaching across the list.
 *
 * The authorisation API arrives as a prop rather than an import: one business can hold several
 * grants, the composable that tracks them belongs to the screen, and a card asks it questions.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { componentFor } from '@/components/widgets/skills/fields';
import {
  CALENDAR_FIELD_KEY, LABEL_FIELD_KEY,
  valueOf, labelOf, hintOf, placeholderOf, isEnabled, oauthFields, labelFieldOf,
  configurableFields, hasTemplateFields, descriptionOf, errorDiagnostics
} from '@/components/widgets/skills/manifestFields';

const { t, locale } = useI18n();

const props = defineProps({
  /** The stored instance: `skill`, `instanceId`, `params`. */
  entry: { type: Object, required: true },
  /** Its manifest as the catalogue sent it, or null for an instance whose skill is gone. */
  skill: { type: Object, default: null },
  phase: { type: String, required: true },
  open: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /** What this instance is called, and what it is, decided over the whole configuration. */
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  /** Whether another instance already carries the same written name. */
  labelClash: { type: Boolean, default: false },
  /** The authorisations, from `useSkillGrants`. */
  grants: { type: Object, required: true }
});

const emit = defineEmits([
  'toggle', 'update:field', 'duplicate', 'remove',
  'oauth-connect', 'oauth-disconnect', 'use-grant'
]);

const lang = computed(() => (locale.value || 'en-US').split('-')[0]);

/** A skill the catalogue no longer lists. The card stays, because the configuration does. */
const orphaned = computed(() => !props.skill);
const enabled = computed(() => isEnabled(props.entry));
const description = computed(() => descriptionOf(props.skill, lang.value));
const diagnostics = computed(() => errorDiagnostics(props.skill));
const nameField = computed(() => labelFieldOf(props.skill));
const authFields = computed(() => oauthFields(props.skill));
const bodyFields = computed(() => configurableFields(props.skill, props.entry, props.phase));
const showsTemplates = computed(() => hasTemplateFields(props.skill, props.entry, props.phase));

function value(key) {
  return valueOf(props.entry, key);
}

function label(field) {
  return labelOf(field, lang.value);
}

function hint(field) {
  return hintOf(field, lang.value);
}

function write(key, value) {
  if (props.disabled) return;
  emit('update:field', { key, value });
}

/** Written trimmed, so that a trailing space never makes two identical names different in
 *  storage. */
function writeName(value) {
  write(LABEL_FIELD_KEY, (value || '').replace(/\s+/g, ' ').trim());
}

/** What a widget needs beyond the contract every field shares.
 *
 * Three widgets want something the card knows and they do not: how long an appointment lasts, which
 * language the labels are read in, and which calendars an authorisation offers. Everything else is
 * drawn from `field`, the value and `disabled`, which is why adding a widget usually adds nothing
 * here at all.
 */
function fieldProps(field) {
  const widget = field.widget || field.type;
  if (widget === 'weekly_hours') {
    return { slotDuration: Number(value('durationMinutes')) || 15 };
  }
  if (widget === 'list' || widget === 'tuples') {
    return { locale: lang.value };
  }
  if (widget === 'calendar' || field.key === CALENDAR_FIELD_KEY) {
    return {
      options: props.grants.calendarOptions(props.entry),
      summary: props.grants.calendarSummary(props.entry)
    };
  }
  return {};
}
</script>

<template>
  <div :class="['entry-card', { 'entry-orphaned': orphaned }]">

    <!-- The strip. The whole of it is the toggle, so the target is the card and not a 12-pixel
         chevron; the controls on it stop the click from reaching it. -->
    <div class="entry-header entry-header-toggle" @click="emit('toggle')">
      <!-- First on the strip, and there whether the card is open or shut: this is the switch that
           decides whether the instance runs, and it used to be one field among twenty inside the
           card. `.stop` so that flicking it does not also open or close what it sits on. -->
      <ToggleSwitch :modelValue="enabled"
                    @update:modelValue="write('enabled', $event ? 'true' : 'false')"
                    @click.stop
                    :disabled="disabled"
                    class="entry-switch"
                    :title="t('widgets.agentSkills.entryEnabledHint')" />
      <i :class="open ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="entry-chevron"></i>
      <div class="entry-info">
        <span class="entry-name">{{ title }}</span>
        <span v-if="subtitle" class="entry-subtitle">{{ subtitle }}</span>
        <span v-if="orphaned" class="entry-orphaned-hint">
          {{ t('widgets.agentSkills.skillUnavailable') }}
        </span>
        <span v-else-if="open && description" class="entry-description">{{ description }}</span>
      </div>
      <!-- On or off, always one of the two, and never nothing. An instance is created switched off,
           and a closed card that says nothing about it is how one stays off unnoticed; but a badge
           that appears only when something is wrong is also a badge whose absence has to be
           interpreted. Stating both means the strip can be read rather than inferred from. -->
      <Tag :value="enabled ? t('widgets.agentSkills.entryOn') : t('widgets.agentSkills.entryOff')"
           :severity="enabled ? 'success' : 'warn'"
           class="entry-state-badge" />
      <Button icon="pi pi-copy" severity="secondary" text rounded size="small"
              :disabled="disabled" @click.stop="emit('duplicate')"
              :title="t('widgets.agentSkills.duplicateSkill')" />
      <Button icon="pi pi-times" severity="danger" text rounded size="small"
              :disabled="disabled" @click.stop="emit('remove')"
              :title="t('widgets.agentSkills.removeSkill')" />
    </div>

    <!-- The name, first, because it names everything below it and because a card opened to be
         configured is a card whose name is about to matter. -->
    <div v-if="open && nameField" class="entry-name-field">
      <label class="config-label" :for="'label-' + (entry.instanceId || phase)">
        {{ label(nameField) }}
      </label>
      <InputText :id="'label-' + (entry.instanceId || phase)"
                 :modelValue="value(LABEL_FIELD_KEY)"
                 @update:modelValue="writeName($event)"
                 :invalid="labelClash"
                 :disabled="disabled"
                 :placeholder="subtitle || title"
                 class="w-full"
                 size="small" />
      <small v-if="labelClash" class="config-hint label-clash">
        {{ t('widgets.agentSkills.labelClash') }}
      </small>
      <small v-else-if="hint(nameField)" class="config-hint">{{ hint(nameField) }}</small>
    </div>

    <div v-if="open && authFields.length > 0" class="entry-oauth">
      <div v-for="field in authFields" :key="field.key" class="oauth-field">
        <div class="oauth-status">
          <i :class="grants.isOAuthConnected(field, entry) ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"
             :style="{ color: grants.isOAuthConnected(field, entry) ? '#22c55e' : '#f59e0b' }"></i>
          <span class="oauth-label">{{ label(field) }}</span>
          <Tag v-if="grants.isOAuthConnected(field, entry)"
               :value="grants.grantAccountLabel(grants.grantFor(field, entry))"
               severity="success" class="oauth-badge" />
        </div>
        <!-- A skill the platform cannot authorise does not offer a button that cannot work: what is
             wrong is said here, in the words of the side that knows. -->
        <div v-if="diagnostics.length > 0" class="oauth-unavailable">
          <i class="pi pi-exclamation-triangle"></i>
          <span>{{ diagnostics.map(d => d.detail).join(' · ') }}</span>
        </div>
        <div v-else class="oauth-actions">
          <Button v-if="!grants.isOAuthConnected(field, entry)"
                  :label="t('widgets.agentSkills.oauthConnect')"
                  icon="pi pi-external-link"
                  severity="warning" outlined size="small"
                  @click="emit('oauth-connect', field)"
                  :disabled="disabled" />
          <Button v-else
                  :label="grants.ownsGrant(entry, grants.grantFor(field, entry))
                            ? t('widgets.agentSkills.oauthDisconnect')
                            : t('widgets.agentSkills.oauthStopUsing')"
                  icon="pi pi-times"
                  severity="danger" text size="small"
                  @click="emit('oauth-disconnect', field)"
                  :disabled="disabled" />
        </div>
        <!-- Which authorisation this instance acts with, the one in use shown as the selected
             value. Sharing one between two instances is picking the same entry twice; a new account
             is the button above. -->
        <div v-if="grants.grantOptions(field).length > 0" class="oauth-reuse">
          <label class="oauth-reuse-label">{{ t('widgets.agentSkills.oauthReuse') }}</label>
          <Dropdown :options="grants.grantOptions(field)"
                    :model-value="grants.grantNameFor(entry, field)"
                    :option-label="grants.grantAccountLabel"
                    option-value="grantName"
                    :placeholder="t('widgets.agentSkills.oauthReusePlaceholder')"
                    :disabled="disabled"
                    class="oauth-reuse-select"
                    @change="emit('use-grant', { field, grantName: $event.value })" />
        </div>
        <small v-if="field.key === CALENDAR_FIELD_KEY" class="config-hint">
          {{ value(field.key)
               ? t('widgets.agentSkills.calendarChosen')
               : t('widgets.agentSkills.calendarNotChosen') }}
        </small>
        <small v-else-if="hint(field)" class="config-hint">{{ hint(field) }}</small>
      </div>
    </div>

    <div v-if="open && bodyFields.length > 0" class="entry-fields">
      <div v-for="field in bodyFields" :key="field.key" class="config-field">
        <label class="config-label">
          {{ label(field) }}
          <span v-if="field.required" class="required-mark">*</span>
        </label>

        <!-- WHICH COMPONENT DRAWS THIS FIELD IS A LOOKUP, not a chain of branches. Eleven of them
             lived here, two keyed on the NAME of a field rather than on what it is, so a skill that
             brought a new kind of field made somebody edit this file and re-read the ten that
             already worked. -->
        <component v-if="componentFor(field)"
                   :is="componentFor(field)"
                   :field="field"
                   :modelValue="value(field.key)"
                   @update:modelValue="write(field.key, $event)"
                   :disabled="disabled"
                   :placeholder="placeholderOf(field)"
                   v-bind="fieldProps(field)" />

        <!-- Nothing rather than a text box: a field drawn by the wrong widget looks like it works,
             and writes a value that is wrong in a way nobody sees until a call goes badly. -->
        <small v-else class="config-hint">
          {{ t('widgets.agentSkills.unknownWidget', { widget: field.widget || field.type }) }}
        </small>

        <small v-if="hint(field)" class="config-hint">{{ hint(field) }}</small>
      </div>

      <!-- Said once for the whole entry, not once per prompt field. -->
      <details v-if="showsTemplates" class="template-help">
        <summary>{{ t('widgets.agentSkills.templateSyntaxTitle') }}</summary>
        <p>{{ t('widgets.agentSkills.templateSyntaxHelp') }}</p>
      </details>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../../../assets/style/colors';

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

.entry-header-toggle {
  cursor: pointer;
  user-select: none;
}

.entry-chevron {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  margin-right: 6px;
}

.entry-switch {
  flex: 0 0 auto;
  margin-right: 0.25rem;
}

.entry-state-badge {
  margin-right: 6px;
  flex-shrink: 0;
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

.entry-subtitle {
  font-size: .78rem;
  color: var(--text-color-secondary, #6b7280);
}

.entry-description {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  line-height: 1.3;
}

.entry-name-field {
  padding: .75rem 1rem 0;
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

.label-clash {
  color: var(--red-500, #ef4444);
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

.oauth-unavailable {
  display: flex;
  align-items: flex-start;
  gap: .45rem;
  font-size: .85rem;
  color: var(--red-500, #ef4444);
  padding: .35rem 0;
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
