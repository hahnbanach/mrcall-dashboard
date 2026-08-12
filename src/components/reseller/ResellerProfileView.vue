<template>
  <Toast />
  <ProgressBar v-show="loading" mode="indeterminate" style="height: .3em" />
  <div v-if="user" class="reseller-profile">
    <h1 class="page-title">{{ $t('components.reseller.profile.title') }}</h1>

    <div v-if="resellerProfile" class="profile-card">
      <div class="profile-item">
        <span class="profile-label">{{ $t('components.reseller.profile.displayName') }}</span>
        <span class="profile-value">{{ resellerProfile.displayName }}</span>
      </div>
      <div class="profile-item">
        <span class="profile-label">{{ $t('components.reseller.profile.email') }}</span>
        <span class="profile-value">{{ resellerProfile.email }}</span>
      </div>
      <div v-if="resellerProfile.feeRate != null" class="profile-item">
        <span class="profile-label">{{ $t('components.reseller.profile.feeRate') }}</span>
        <span class="profile-value">{{ (resellerProfile.feeRate * 100).toFixed(1) }}%</span>
      </div>
      <div class="profile-item">
        <span class="profile-label">{{ $t('components.reseller.profile.canGenerateCodes') }}</span>
        <span class="profile-value">
          <i :class="resellerProfile.canGenerateCodes ? 'pi pi-check' : 'pi pi-times'"
             :style="{ color: resellerProfile.canGenerateCodes ? '#22C55E' : '#EF4444' }"></i>
        </span>
      </div>
      <div class="profile-item">
        <span class="profile-label">{{ $t('components.reseller.profile.canAcceptExistingOwners') }}</span>
        <span class="profile-value">
          <i :class="resellerProfile.canAcceptExistingOwners ? 'pi pi-check' : 'pi pi-times'"
             :style="{ color: resellerProfile.canAcceptExistingOwners ? '#22C55E' : '#EF4444' }"></i>
        </span>
      </div>
      <div v-if="resellerProfile.stripeConnectAccountId" class="profile-item">
        <span class="profile-label">{{ $t('components.reseller.profile.stripeConnect') }}</span>
        <span class="profile-value"><i class="pi pi-check" style="color: #22C55E"></i></span>
      </div>
      <div v-if="resellerProfile.createdAt" class="profile-item">
        <span class="profile-label">{{ $t('components.reseller.profile.createdAt') }}</span>
        <span class="profile-value">{{ formatDate(resellerProfile.createdAt) }}</span>
      </div>
      <div v-if="resellerProfile.updatedAt" class="profile-item">
        <span class="profile-label">{{ $t('components.reseller.profile.updatedAt') }}</span>
        <span class="profile-value">{{ formatDate(resellerProfile.updatedAt) }}</span>
      </div>
    </div>

    <div v-else-if="!loading" class="empty-state">
      <i class="pi pi-user empty-state-icon"></i>
      <p>{{ $t('components.reseller.profile.noProfile') }}</p>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useToast } from 'primevue/usetoast'

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
      loading: false
    }
  },
  computed: {
    resellerProfile() {
      return this.store.state.resellerProfile
    }
  },
  mounted() {
    if (this.user && !this.resellerProfile) {
      this.loading = true
      this.store.dispatch('loadResellerData').finally(() => {
        this.loading = false
      })
    }
  },
  methods: {
    formatDate(ts) {
      if (!ts) return '-'
      return new Date(ts).toLocaleString()
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../assets/style/colors';

.reseller-profile {
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: @mrcall_dark_grey_text;
  margin-bottom: 1.5rem;
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
  align-items: center;
  padding: 0.75rem 0;
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

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.empty-state-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: #d1d5db;
}
</style>
