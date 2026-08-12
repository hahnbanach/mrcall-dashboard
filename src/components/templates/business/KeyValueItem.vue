<script setup>
import { useSlots } from 'vue'
const slots = useSlots()
</script>

<template>
  <!--
  <div id="inputbox" class="col-12 mb-4">
      <div class="text-center mb-4">
        <label class="title text-lg block"
               :for="variable.name"
               v-text="mandatoryParameterHumanName(variable)"
               :class="{'mb-1': variable.description}"
        ></label>

        <span class="font-normal font-italic title text-sm" v-text="variable.description"></span>
        <div v-if="variable.upgradeInformation">
          <span  class="font-normal font-italic upgradeInformation text-sm" v-html="variable.upgradeInformation"></span>
        </div>
      </div>

      <InputText
          class="w-full"
          :id="variable.name" type="text" v-model="business.variables[variable.name]"
      />
  </div>
  -->
</template>

<style scoped lang="less">

</style>