<template>
  <section class="skill-summary" data-testid="skill-summary">
    <p>{{ $t(`views.configureAI.summary.${change.action}`) }}</p>
    <p class="activation-state" :data-activation="summary.activation">
      {{ $t(`views.configureAI.summary.${summary.activation}`) }}
    </p>
    <dl>
      <template v-for="row in summary.rows" :key="row.key">
        <dt>{{ row.label }}</dt>
        <dd>
          <template v-if="change.action === 'replace' && row.before !== null">
            <span class="value-label">{{ $t('views.configureAI.pending.before') }}:</span>
            <span class="readable-value">{{ row.before }}</span>
            <span class="value-label">{{ $t('views.configureAI.pending.after') }}:</span>
          </template>
          <span class="readable-value">{{ change.action === 'remove' ? row.before : row.after }}</span>
        </dd>
      </template>
    </dl>
    <p v-if="summary.technicalCount">{{ $t('views.configureAI.summary.additional') }}</p>
  </section>
  <details class="skill-technical-details" data-testid="skill-technical-details">
    <summary>{{ $t('views.configureAI.summary.details') }}</summary>
    <p>{{ $t(`views.configureAI.pending.${change.phase}`) }}</p>
    <p>{{ change.skill }} · {{ change.operation_id }}</p>
    <p v-if="change.instance_id">{{ change.instance_id }}</p>
    <p v-else>{{ $t('views.configureAI.pending.draft') }} {{ change.draft_id }}</p>
    <div v-for="field in fields" :key="field" class="field-preview">
      <strong>{{ label(change.preview?.field_labels?.[field]) || field }}</strong>
      <div>{{ $t('views.configureAI.pending.before') }}: <pre>{{ exact(change.preview?.before?.[field]) }}</pre></div>
      <div>{{ $t('views.configureAI.pending.after') }}: <pre>{{ exact(change.preview?.after?.[field]) }}</pre></div>
    </div>
  </details>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { changedSkillFields, exactSkillValue, localizedSkillLabel, skillSummary } from '@/utils/SkillPendingPresentation';

const props = defineProps({ change: { type: Object, required: true } });
const { locale, t } = useI18n();
const summary = computed(() => skillSummary(props.change, locale.value, t));
const fields = computed(() => changedSkillFields(props.change));
const label = value => localizedSkillLabel(value, locale.value);
const exact = exactSkillValue;
</script>

<style scoped>
.skill-summary dl { margin: 0.75rem 0; }
.skill-summary dt { font-weight: 600; margin-top: 0.6rem; }
.skill-summary dd { margin: 0.2rem 0 0; overflow-wrap: anywhere; }
.activation-state { font-weight: 600; }
.readable-value { display: block; white-space: pre-line; }
.value-label { display: block; margin-top: 0.3rem; }
.skill-technical-details { margin-top: 0.75rem; }
.skill-technical-details summary { cursor: pointer; }
.field-preview { margin-top: 0.5rem; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0.2rem 0; }
</style>
