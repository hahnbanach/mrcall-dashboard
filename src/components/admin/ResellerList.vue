<template>
  <Toast />
  <ProgressBar v-show="loading" mode="indeterminate" style="height: .3em" />
  <div v-if="user" class="reseller-list">
    <div class="page-header">
      <h1 class="page-title">{{ $t('components.admin.reseller.listTitle') }}</h1>
      <Button
        :label="$t('components.admin.reseller.newReseller')"
        icon="pi pi-plus"
        @click="router.push('/admin/resellers/new')"
      />
    </div>

    <DataTable
      :value="resellers"
      :rows="20"
      :paginator="resellers.length > 20"
      stripedRows
      selectionMode="single"
      @rowSelect="onRowSelect"
    >
      <Column field="displayName" :header="$t('components.admin.reseller.displayName')" sortable />
      <Column field="email" :header="$t('components.admin.reseller.email')" sortable />
      <Column :header="$t('components.admin.reseller.feeRate')">
        <template #body="slotProps">
          {{ slotProps.data.feeRate != null ? (slotProps.data.feeRate * 100).toFixed(1) + '%' : '-' }}
        </template>
      </Column>
      <Column :header="$t('components.admin.reseller.stripeConnect')">
        <template #body="slotProps">
          <i :class="slotProps.data.stripeConnectAccountId ? 'pi pi-check' : 'pi pi-times'"
             :style="{ color: slotProps.data.stripeConnectAccountId ? '#22C55E' : '#9CA3AF' }"></i>
        </template>
      </Column>
      <Column :header="$t('components.admin.reseller.ownerCount')">
        <template #body="slotProps">
          {{ getOwnerCount(slotProps.data.resellerId) }}
        </template>
      </Column>
      <Column :header="$t('components.admin.reseller.actions')">
        <template #body="slotProps">
          <Button
            icon="pi pi-eye"
            text size="small"
            @click="router.push('/admin/resellers/' + slotProps.data.resellerId)"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useToast } from 'primevue/usetoast'
import router from '@/router'
import AdminApi from '@/utils/Admin'

export default {
  setup() {
    const store = useStore()
    const toast = useToast()
    return {
      store,
      toast,
      user: computed(() => store.state.user),
    }
  },
  data() {
    return {
      router,
      loading: false,
      resellers: [],
      mappings: []
    }
  },
  mounted() {
    if (this.user) {
      this.fetchData()
    }
  },
  methods: {
    async fetchData() {
      this.loading = true
      try {
        const profilesRes = await AdminApi.getResellerProfiles(this.user)
        this.resellers = profilesRes.data || []
      } catch (error) {
        console.error('Failed to fetch reseller profiles:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.admin.reseller.error'),
          detail: this.formatErrorDetail(error, this.$t('components.admin.reseller.fetchError')),
          life: 8000
        })
      }
      try {
        const mappingsRes = await AdminApi.getResellerMappings(this.user, {})
        this.mappings = mappingsRes.data || []
      } catch (error) {
        console.error('Failed to fetch reseller mappings:', error)
      }
      this.loading = false
    },
    formatErrorDetail(error, fallback) {
      const status = error?.response?.status
      const body = error?.response?.data
      const bodyMsg = typeof body === 'string' ? body : body?.message
      if (status && bodyMsg) return `${fallback} [${status}]: ${bodyMsg}`
      if (status) return `${fallback} [HTTP ${status}]`
      if (error?.message) return `${fallback}: ${error.message}`
      return fallback
    },
    getOwnerCount(resellerId) {
      return this.mappings.filter(m => m.resellerId === resellerId).length
    },
    onRowSelect(event) {
      router.push('/admin/resellers/' + event.data.resellerId)
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../assets/style/colors';

.reseller-list {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: @mrcall_dark_grey_text;
  margin: 0;
}
</style>
