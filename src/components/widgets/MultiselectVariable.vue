<script setup>
import { onMounted } from "vue";
const model = defineModel()
const props = defineProps(['variable'])

onMounted(() => {
  if (model.value === undefined) {
    model.value = []
  }
})

const multiselectOptions = props.variable.valuesSelection
</script>

<template>
  <MultiSelect
      :disabled="!variable.modifiable"
      v-model="model"
      :options="multiselectOptions"
      optionLabel="name"
      optionValue="value"
      :placeholder="variable.humanName"
      class="w-full" />
</template>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/fonts';
@import '../../assets/style/components/templates/configuration_items';
</style>