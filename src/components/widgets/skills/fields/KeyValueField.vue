<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

/** Pairs of name and value — http headers, and whatever else is an object of strings.
  *
  * The rows are kept here and the value is written out on every change, rather than the value being
  * re-parsed on every keystroke: a half-typed key would otherwise vanish the moment it is not valid
  * JSON, and a row being emptied would disappear under the cursor.
  */
const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Object], default: '{}' },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

function parse (value) {
  try {
    const obj = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {})
    return Object.entries(obj).map(([key, v]) => ({ key, value: String(v) }))
  } catch {
    return []
  }
}

function serialise (rows) {
  const obj = {}
  rows.forEach(row => {
    if (row.key && row.key.trim()) obj[row.key.trim()] = row.value || ''
  })
  return JSON.stringify(obj)
}

const pairs = ref(parse(props.modelValue))

// Only when the value changed elsewhere: comparing with what these rows produce keeps the rows
// stable while somebody is typing in them.
watch(() => props.modelValue, value => {
  if (serialise(pairs.value) !== value) pairs.value = parse(value)
})

function publish () { emit('update:modelValue', serialise(pairs.value)) }
function add () { pairs.value.push({ key: '', value: '' }) }
function remove (index) { pairs.value.splice(index, 1); publish() }
</script>

<template>
  <div class="kv-editor">
    <div v-for="(pair, index) in pairs" :key="index" class="kv-row">
      <InputText v-model="pair.key" @update:modelValue="publish"
                 :disabled="disabled" placeholder="Key" class="kv-key" size="small" />
      <InputText v-model="pair.value" @update:modelValue="publish"
                 :disabled="disabled" placeholder="Value" class="kv-value" size="small" />
      <Button icon="pi pi-trash" severity="danger" text rounded size="small"
              :disabled="disabled" @click="remove(index)" />
    </div>
    <Button icon="pi pi-plus" :label="t('widgets.agentSkills.addPair')"
            severity="secondary" text size="small" :disabled="disabled" @click="add" />
  </div>
</template>

<style scoped lang="less">
.kv-editor { display: flex; flex-direction: column; gap: .35rem; }
.kv-row { display: flex; gap: .35rem; align-items: center; }
.kv-key { flex: 1 1 40%; }
.kv-value { flex: 1 1 60%; }
</style>
