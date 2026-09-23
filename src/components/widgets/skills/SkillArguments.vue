<script setup>
/**
 * The parameters of the function this instance publishes: what the assistant collects during the
 * call, and what it may be asked to collect beyond that.
 *
 * WHY IT IS ON THE CARD AT ALL. A card used to show the configuration and say nothing about the
 * function, so "how does it know which appointment" and "where does the time come from" had no
 * answer on the screen: the answer is that the model passes them, and nothing said the arguments
 * existed. They are read-only here because they belong to the skill, not to this business.
 *
 * The list below them is the other half of the same declaration: the arguments THIS instance adds.
 * Both halves end up in one document — the schema the model is given and the one the platform
 * validates the call against — and both are available as `%%name%%` in every text field of this
 * card.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ListField from '@/components/widgets/skills/fields/ListField.vue';

const { t, locale } = useI18n();

const props = defineProps({
  /** The skill's own arguments, as the catalogue publishes them. */
  parameters: { type: Array, default: () => [] },
  /** The `variables` field of this instance, when the schema has one, and its stored value. */
  extrasField: { type: Object, default: null },
  extrasValue: { type: [String, Array], default: '[]' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:extras']);

const lang = computed(() => (locale.value || 'en-US').split('-')[0]);
const declared = computed(() => props.parameters || []);
const shows = computed(() => declared.value.length > 0 || props.extrasField !== null);
</script>

<template>
  <div v-if="shows" class="skill-arguments">
    <div class="arguments-head">{{ t('widgets.agentSkills.argumentsTitle') }}</div>

    <table v-if="declared.length > 0" class="arguments-table">
      <tbody>
        <tr v-for="argument in declared" :key="argument.name">
          <td class="argument-name"><code>{{ argument.name }}</code></td>
          <td class="argument-need">
            {{ argument.required ? t('widgets.agentSkills.argumentRequired') : t('widgets.agentSkills.argumentOptional') }}
          </td>
          <td class="argument-what">{{ argument.description }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="extrasField" class="arguments-extras">
      <label class="config-label">{{ (extrasField.labels && (extrasField.labels[lang] || extrasField.labels['*'] || extrasField.labels.en) || {}).label || extrasField.key }}</label>
      <ListField :field="extrasField"
                 :modelValue="extrasValue"
                 @update:modelValue="emit('update:extras', $event)"
                 :disabled="disabled"
                 :locale="lang" />
      <small class="config-hint">
        {{ (extrasField.labels && (extrasField.labels[lang] || extrasField.labels['*'] || extrasField.labels.en) || {}).hint || '' }}
      </small>
    </div>

    <small class="config-hint arguments-template-hint">{{ t('widgets.agentSkills.argumentsTemplateHint') }}</small>
  </div>
</template>

<style scoped lang="less">
@import '../../../assets/style/colors';

.skill-arguments {
  border-top: 1px solid @mrcall_borders;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.arguments-head {
  font-size: 0.8rem;
  font-weight: 600;
}

.arguments-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.arguments-table td {
  vertical-align: top;
  padding: 2px 6px 2px 0;
}

.argument-name {
  white-space: nowrap;
}

.argument-need {
  white-space: nowrap;
  color: var(--p-text-muted-color);
}

.argument-what {
  color: var(--p-text-muted-color);
  line-height: 1.3;
}

.config-label {
  font-size: 0.8rem;
  font-weight: 500;
}

.config-hint {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
}

.arguments-extras {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.arguments-template-hint {
  font-style: italic;
}
</style>
