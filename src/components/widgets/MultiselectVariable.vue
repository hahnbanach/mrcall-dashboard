<script setup>
import {useI18n} from "vue-i18n";
import {ref} from 'vue'
const { t } = useI18n()
const data = defineProps(['business', 'variable'])
if(data.business.variables[data.variable.name] === undefined) {
  data.business.variables[data.variable.name] = []
}

const multiselectOptions = data.variable.valuesSelection
</script>

<template>
  <MultiSelect
      :disabled="!variable.modifiable"
      v-model="business.variables[variable.name]"
      :options="multiselectOptions"
      optionLabel="name"
      optionValue="value"
      v-model:placeholder="variable.humanName"
      class="w-full" />
</template>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/fonts';
@import '../../assets/style/components/templates/configuration_items';
</style>