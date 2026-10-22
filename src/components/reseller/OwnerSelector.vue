<template>
  <div class="owner-selector">
    <Dropdown
      v-model="selectedOwner"
      :options="ownerOptions"
      optionLabel="label"
      optionValue="value"
      :placeholder="$t('components.reseller.ownerSelector.placeholder')"
      class="owner-selector-dropdown"
      @change="onOwnerChange"
    />
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'

export default {
  setup() {
    const store = useStore()
    return {
      store,
      user: computed(() => store.state.user),
    }
  },
  data() {
    return {
      selectedOwner: this.$store.state.selectedOwnerId
    }
  },
  computed: {
    ownerOptions() {
      const options = [
        { label: this.$t('components.reseller.ownerSelector.allAccounts'), value: null },
        { label: this.$t('components.reseller.ownerSelector.myAccount'), value: this.user?.uid }
      ]
      const owners = this.store.state.managedOwners || []
      owners.forEach(owner => {
        const name = owner.displayName || owner.email || owner.uid
        const detail = owner.email && owner.displayName ? ` (${owner.email})` : ''
        options.push({
          label: name + detail,
          value: owner.uid
        })
      })
      return options
    }
  },
  watch: {
    // The owner can also be cleared elsewhere (the analytics filter bar): the dropdown shows the store's.
    '$store.state.selectedOwnerId'(value) {
      this.selectedOwner = value
    }
  },
  mounted() {
    if (this.store.state.managedOwners.length === 0) {
      this.store.dispatch('loadResellerData')
    }
  },
  methods: {
    onOwnerChange(event) {
      this.store.commit('setSelectedOwnerId', event.value)
    }
  }
}
</script>

<style lang="less" scoped>
.owner-selector {
  margin-bottom: 1rem;
}

.owner-selector-dropdown {
  min-width: min(280px, 100%);
  max-width: 100%;
}
</style>
