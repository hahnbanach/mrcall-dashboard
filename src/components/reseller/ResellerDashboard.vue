<template>
  <Toast />
  <ProgressBar v-show="loading" mode="indeterminate" style="height: .3em" />
  <div v-if="user" class="reseller-dashboard">
    <h1 class="dashboard-title">{{ $t('components.reseller.dashboard.title') }}</h1>

    <!-- Owner Selector -->
    <OwnerSelector />

    <!-- Profile Card -->
    <div v-if="resellerProfile" class="dashboard-section">
      <h3 class="section-title">{{ $t('components.reseller.dashboard.profile') }}</h3>
      <div class="profile-card">
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.reseller.dashboard.displayName') }}</span>
          <span class="profile-value">{{ resellerProfile.displayName }}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.reseller.dashboard.email') }}</span>
          <span class="profile-value">{{ resellerProfile.email }}</span>
        </div>
        <div v-if="resellerProfile.feeRate != null" class="profile-item">
          <span class="profile-label">{{ $t('components.reseller.dashboard.feeRate') }}</span>
          <span class="profile-value">{{ (resellerProfile.feeRate * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <!-- Stats Overview -->
    <div v-if="dashboardData" class="dashboard-section">
      <h3 class="section-title">{{ $t('components.reseller.dashboard.stats') }}</h3>
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">{{ $t('components.reseller.dashboard.totalCalls') }}</div>
          <div class="kpi-value">{{ formatNumber(dashboardData.totalCalls) }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">{{ $t('components.reseller.dashboard.managedAccounts') }}</div>
          <div class="kpi-value">{{ managedOwners.length }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">{{ $t('components.reseller.dashboard.avgDuration') }}</div>
          <div class="kpi-value">{{ formatDuration(dashboardData.avgCallDurationMs) }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">{{ $t('components.reseller.dashboard.uniqueCallers') }}</div>
          <div class="kpi-value">{{ formatNumber(dashboardData.uniqueCallers) }}</div>
        </div>
      </div>
    </div>

    <!-- Managed Owners List -->
    <div class="dashboard-section">
      <h3 class="section-title">{{ $t('components.reseller.dashboard.managedOwnersList') }}</h3>
      <DataTable :value="managedOwners" :rows="10" :paginator="managedOwners.length > 10" stripedRows>
        <Column field="displayName" :header="$t('components.reseller.dashboard.ownerName')" />
        <Column field="email" :header="$t('components.reseller.dashboard.ownerEmail')" />
        <Column field="uid" :header="$t('components.reseller.dashboard.ownerUid')" />
        <Column field="source" :header="$t('components.reseller.dashboard.source')" />
        <Column :header="$t('components.reseller.dashboard.invitationCode')">
          <template #body="slotProps">
            {{ slotProps.data.invitationCode || '-' }}
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Quick Actions -->
    <div class="dashboard-section">
      <h3 class="section-title">{{ $t('components.reseller.dashboard.quickActions') }}</h3>
      <div class="quick-actions">
        <Button
          :label="$t('components.reseller.dashboard.manageCodes')"
          icon="pi pi-key"
          @click="router.push('/reseller/codes')"
        />
        <Button
          :label="$t('components.reseller.dashboard.viewBusinesses')"
          icon="pi pi-box"
          outlined
          @click="router.push('/businesses')"
        />
        <Button
          :label="$t('components.reseller.dashboard.viewAnalytics')"
          icon="pi pi-chart-bar"
          outlined
          @click="router.push('/analytics')"
        />
        <Button
          :label="$t('components.reseller.dashboard.viewProfile')"
          icon="pi pi-user"
          outlined
          @click="router.push('/reseller/profile')"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useToast } from 'primevue/usetoast'
import router from '@/router'
import AnalyticsApi from '@/utils/Analytics'
import OwnerSelector from '@/components/reseller/OwnerSelector.vue'

export default {
  components: { OwnerSelector },
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
      dashboardData: null,
    }
  },
  computed: {
    resellerProfile() {
      return this.store.state.resellerProfile
    },
    managedOwners() {
      return this.store.state.managedOwners || []
    }
  },
  mounted() {
    if (this.user) {
      this.store.dispatch('loadResellerData')
      this.fetchDashboard()
    }
  },
  methods: {
    formatNumber(n) {
      if (n == null) return '-'
      return n.toLocaleString()
    },
    formatDuration(ms) {
      if (ms == null) return '-'
      const secs = Math.round(ms / 1000)
      if (secs < 60) return secs + 's'
      const mins = Math.floor(secs / 60)
      const remainSecs = secs % 60
      if (mins < 60) return mins + 'm ' + remainSecs + 's'
      const hours = Math.floor(mins / 60)
      const remainMins = mins % 60
      return hours + 'h ' + remainMins + 'm'
    },
    fetchDashboard() {
      this.loading = true
      const now = new Date()
      const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
      const request = {
        timestampGte: start.getTime(),
        timestampLte: now.getTime()
      }
      AnalyticsApi.dashboard(this.user, request)
        .then(response => {
          this.dashboardData = response.data
        })
        .catch(error => {
          console.error('Failed to fetch dashboard:', error)
          this.toast.add({ severity: 'error', summary: this.$t('components.reseller.dashboard.error'), detail: error.response?.data?.message || error.message, life: 5000 })
        })
        .finally(() => {
          this.loading = false
        })
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../assets/style/colors';

.reseller-dashboard {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

.dashboard-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: @mrcall_dark_grey_text;
  margin-bottom: 1.5rem;
}

.dashboard-section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: @mrcall_dark_grey_text;
}

.profile-card {
  background: #fff;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  padding: 1.25rem;
}

.profile-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid @mrcall_borders;

  &:last-child {
    border-bottom: none;
  }
}

.profile-label {
  font-size: 0.85rem;
  color: #6b7280;
}

.profile-value {
  font-weight: 600;
  color: @mrcall_dark_grey_text;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 1rem;
}

.kpi-card {
  background: #fff;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
}

.kpi-label {
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.kpi-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #111827;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

@media screen and (max-width: 640px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .quick-actions {
    flex-direction: column;
  }
}
</style>
