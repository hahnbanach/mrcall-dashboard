<script setup>
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import businessVariablesUtils from "@/utils/BusinessVariables";

const model = defineModel()
const props = defineProps(['business', 'variable'])
const { t } = useI18n()

onMounted(() => {
  if (model.value === undefined) {
    model.value = []
  }
})

// Computed, not read once: the values offered depend on other variables of the business, the
// engine above all, and have to follow them while the page is open.
const dropdownValues = computed(() => businessVariablesUtils.templatedOptions(props.business, props.variable))

const unavailable = computed(() => businessVariablesUtils.unavailableTemplatedValue(props.business, props.variable))

function getDescription(key) {
  const item = ((props.variable.templatedVariable && props.variable.templatedVariable.values) || {})[key]
  return item ? item.description : undefined
}

</script>

<template>
  <Dropdown
    :disabled="!variable.modifiable"
    v-model="model" :options="dropdownValues"
    :invalid="!!unavailable"
    optionLabel="label"
    optionValue="value"
    :filter="true"
    :placeholder="variable.humanName" :showClear="true"
    class="w-full"
  >
  </Dropdown>
  <div v-if="unavailable" class="p-error">{{ t('widgets.templatedVariable.unavailable', { option: unavailable.label }) }}</div>
  <div v-else class="inputboxsubtitle">{{getDescription(model)}}</div>
</template>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/fonts';
@import '../../assets/style/components/templates/configuration_items';

.main-items-button-bar {
  display: flex;
  flex-direction: column;
  align-items: end;
}

.item-button-bar {
  width: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.even-item {
  background: @mrcall_white;
  border-radius: 3px;
}

.odd-item {
  background: @mrcall_light_grey_2;
  border-radius: 3px;
}

.arrows-block {
  display: flex;
  flex-direction: row;
}
</style>