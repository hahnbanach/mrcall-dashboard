<script setup>
import { ref, watch, toRef, computed } from 'vue';
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const props = defineProps(['recipient', 'variable', 'vselection']);
const emit = defineEmits(['update:recipient']);

// Initialize with a deep copy of the recipient
const localRecipient = ref(JSON.parse(JSON.stringify(props.recipient || [])));
// Use a computed property to ensure reactivity and proper scoping
const valuesSelection = computed(() => {
  return props.vselection || props.variable?.valuesSelection || [];
});

// Watch for external changes to recipient
watch(() => props.recipient, (newVal) => {
  if (JSON.stringify(newVal) !== JSON.stringify(localRecipient.value)) {
    localRecipient.value = JSON.parse(JSON.stringify(newVal || []));
  }
}, { deep: true, immediate: true });

// Update parent when localRecipient changes
watch(() => localRecipient.value, (newVal) => {
  emit('update:recipient', JSON.parse(JSON.stringify(newVal)));
}, { deep: true });

// Create a new item with proper structure
function createNestedValue(item) {
  if (item.type === 'tuples' && item.tuple) {
    return []; // Initialize nested tuple with empty array
  }
  return ""; // Default empty string for other types
}

function createNewItem() {
  // If we have a template, use that as the base
  if (props.variable?.template) {
    return JSON.parse(JSON.stringify(props.variable.template));
  }
  
  // Otherwise, create from valuesSelection
  if (Array.isArray(valuesSelection.value) && valuesSelection.value.length > 0) {
    return valuesSelection.value.map(item => {
      if (item.type === 'tuples' && item.tuple) {
        // For nested tuples, initialize with their template or empty array
        return item.template ? JSON.parse(JSON.stringify(item.template)) : [];
      }
      // Return default value based on type or empty string
      return item.defaultValue !== undefined ? item.defaultValue : "";
    });
  }
  
  // Fallback to empty array if we can't determine the structure
  return [];
}

function append() {
  localRecipient.value.push(createNewItem());
}

function prepend() {
  localRecipient.value.unshift(createNewItem());
}

function remove(index) {
  localRecipient.value.splice(index, 1);
}

function swapElements(index1, index2) {
  if (index1 >= 0 && index2 >= 0 &&
    index1 < localRecipient.value.length &&
    index2 < localRecipient.value.length) {
    const temp = localRecipient.value[index1];
    localRecipient.value.splice(index1, 1, localRecipient.value[index2]);
    localRecipient.value.splice(index2, 1, temp);
  }
}
</script>

<template>
  <div class="tuple-container">
    <div class="main-items-button-bar">
      <Button
        icon="pi pi-plus-circle"
        severity="secondary"
        text
        rounded
        iconPos="right"
        :label="t('widgets.tuplesvariables.additem')"
        @click="prepend()"
      />
    </div>

    <div
      v-for="(item, itemIndex) in localRecipient"
      :key="itemIndex"
      :class="['tuple-item', itemIndex % 2 === 0 ? 'even-item' : 'odd-item']"
    >
      <div class="item-button-bar">
        <div>
          <Button
            icon="pi pi-trash"
            severity="secondary"
            text
            rounded
            :label="t('widgets.tuplesvariables.removeitem')"
            @click="remove(itemIndex)"
          />
        </div>
        <div class="arrows-block">
          <Button
            icon="pi pi-arrow-up"
            severity="secondary"
            :disabled="itemIndex === 0"
            text
            rounded
            @click="swapElements(itemIndex, itemIndex - 1)"
          />
          <Button
            icon="pi pi-arrow-down"
            severity="secondary"
            :disabled="itemIndex === localRecipient.length - 1"
            text
            rounded
            @click="swapElements(itemIndex, itemIndex + 1)"
          />
        </div>
      </div>

      <div class="fields-container">
        <div
          v-for="(tupleItem, tupleItemIndex) in valuesSelection"
          :key="tupleItemIndex"
          class="field-item"
        >
          <div v-if="tupleItem.title" class="inputboxtitle">{{ tupleItem.title }}</div>
          <div class="field-input">
            <div v-if="tupleItem.type === 'text'">
              <Textarea
                v-model="localRecipient[itemIndex][tupleItemIndex]"
                class="w-full"
              />
            </div>
            <div v-else-if="tupleItem.type === 'boolean'">
              <ToggleSwitch
                v-model="localRecipient[itemIndex][tupleItemIndex]"
                trueValue="true"
                falseValue="false"
              />
            </div>
            <div v-else-if="tupleItem.type === 'enum'">
              <Dropdown
                v-model="localRecipient[itemIndex][tupleItemIndex]"
                :options="tupleItem.enum"
                optionLabel="label"
                optionValue="value"
                :filter="true"
                class="w-full"
                :placeholder="tupleItem.placeholder || variable.description"
                :showClear="true"
              >
                <template #option="slotProps">
                  <div>
                    <span>{{ slotProps.option.label }}</span>
                  </div>
                </template>
              </Dropdown>
            </div>
            <div v-else-if="tupleItem.type === 'tuples'">
              <div class="nested-tuple-container">
                <TupleVariable
                  v-model:recipient="localRecipient[itemIndex][tupleItemIndex]"
                  :variable="{
                    valuesSelection: tupleItem.tuple,
                    name: tupleItem.name,
                    description: tupleItem.description
                  }"
                />
              </div>
            </div>
            <div v-else-if="tupleItem.type === 'json'">
              <JsonEditorVue
                v-model="localRecipient[itemIndex][tupleItemIndex]"
                v-bind="{/* local config */}"
                mode="text"
                class="w-full"
              />
            </div>
            <div v-else>
              <InputText
                class="w-full"
                type="text"
                v-model="localRecipient[itemIndex][tupleItemIndex]"
              />
            </div>
          </div>
          <div v-if="tupleItem.subtitle" class="inputboxsubtitle">{{ tupleItem.subtitle }}</div>
        </div>
      </div>
    </div>

    <div v-if="localRecipient.length > 0" class="main-items-button-bar">
      <Button
        icon="pi pi-plus-circle"
        severity="secondary"
        text
        rounded
        iconPos="right"
        :label="t('widgets.tuplesvariables.additem')"
        @click="append()"
      />
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/fonts';
@import '../../assets/style/components/templates/configuration_items';

.tuple-container {
  width: 100%;
}

.main-items-button-bar {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin: 0.5rem 0;
}

.tuple-item {
  margin-bottom: 1.5rem;
  border-radius: 6px;
  overflow: hidden;
}

.even-item {
  background: @mrcall_white;
}

.odd-item {
  background: @mrcall_light_grey_2;
}

.item-button-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.arrows-block {
  display: flex;
  gap: 0.25rem;
}

.fields-container {
  padding: 1rem;
}

.field-item {
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.field-input {
  margin-top: 0.25rem;
}

.nested-tuple-container {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background-color: #f8fafc;
}

.inputboxtitle {
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #495057;
}

.inputboxsubtitle {
  font-size: 0.875rem;
  color: #6c757d;
  margin-top: 0.25rem;
  font-style: italic;
}
</style>