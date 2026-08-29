<script setup>
import { onMounted } from "vue";
import businessVariablesUtils from "@/utils/BusinessVariables";

const model = defineModel()
const props = defineProps(['business', 'variable'])

onMounted(() => {
  if (model.value === undefined) {
    model.value = []
  }
})

function extractDropdownValuesAndDescriptions(json) {
  const transformedList = [];
  const descriptionsDict = {};

  for (const key in json) {
    if (Object.prototype.hasOwnProperty.call(json, key)) {
      const item = json[key] ;
      const label = item.label || key ;

      const languageCountry = props.business.languageCountry ;
      const lang = languageCountry.substring(0, 2)

      const deps = item.dependsOn ? item.dependsOn : [] ;
      const isDisabled = businessVariablesUtils.checkIfDisabledByParents(props.business, props.variable, deps);

      let pushOnList = true
      if(isDisabled) {
        pushOnList = false
      } else if(item.language) {
        if(item.language === "*") {
          pushOnList = true
        } else if(item.language.length > 2) {
          pushOnList = item.language === languageCountry
        } else {
          pushOnList = item.language === lang
        }
      }

      if(pushOnList) {
        transformedList.push({
          label: label,
          value: key,
          description: item.description,
          language: item.language
        });
        descriptionsDict[key] = item.description;
      }
    }
  }

  return {
    dropdownValues: transformedList,
    descriptions: descriptionsDict
  };
}

const dropdownData = extractDropdownValuesAndDescriptions(props.variable.templatedVariable.values)

function getDescription(key) {
  return dropdownData.descriptions[key]
}

</script>

<template>
  <Dropdown
    :disabled="!variable.modifiable"
    v-model="model" :options="dropdownData.dropdownValues"
    optionLabel="label"
    optionValue="value"
    :filter="true"
    :placeholder="variable.humanName" :showClear="true"
    class="w-full"
  >
  </Dropdown>
  <div class="inputboxsubtitle">{{getDescription(model)}}</div>
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