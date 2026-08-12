<script setup>
import {useI18n} from "vue-i18n";
import businessVariablesUtils from "@/utils/BusinessVariables";

const { t } = useI18n()
const data = defineProps(['business', 'variable'])
if(data.business.variables[data.variable.name] === undefined) {
  data.business.variables[data.variable.name] = []
}

function extractDropdownValuesAndDescriptions(json) {
  const transformedList = [];
  const descriptionsDict = {};

  for (const key in json) {
    if (json.hasOwnProperty(key)) {
      const item = json[key] ;
      const label = item.label || key ;

      const languageCountry = data.business.languageCountry ;
      const lang = languageCountry.substring(0, 2)

      const deps = item.dependsOn ? item.dependsOn : [] ;
      const isDisabled = businessVariablesUtils.checkIfDisabledByParents(data.business, data.variable, deps);

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

const dropdownData = extractDropdownValuesAndDescriptions(data.variable.templatedVariable.values)

function getDescription(key) {
  return dropdownData.descriptions[key]
}

</script>

<template>
  <Dropdown
    :disabled="!variable.modifiable"
    v-model="business.variables[variable.name]" :options="dropdownData.dropdownValues"
    optionLabel="label"
    optionValue="value"
    :filter="true"
    v-model:placeholder="variable.humanName" :showClear="true"
    class="w-full"
  >
  </Dropdown>
  <div class="inputboxsubtitle">{{getDescription(business.variables[variable.name])}}</div>
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