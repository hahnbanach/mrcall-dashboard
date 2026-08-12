<template>
  <Toast />
  <ProgressBar v-show="loading" mode="indeterminate" style="height: .3em" />
  <div v-if="user" class="provision-reseller">
    <Button
      :label="$t('components.admin.reseller.backToList')"
      icon="pi pi-arrow-left"
      text
      @click="router.push('/admin/resellers')"
      class="back-button"
    />

    <h1 class="page-title">{{ $t('components.admin.reseller.provisionTitle') }}</h1>

    <!-- Step 1: Look up user -->
    <div class="provision-section">
      <h3 class="section-title">{{ $t('components.admin.reseller.step1Title') }}</h3>
      <div class="search-mode-toggle">
        <SelectButton v-model="lookupMode" :options="lookupModes" optionLabel="label" optionValue="value" />
      </div>
      <div class="lookup-form">
        <InputText
          v-model="lookupQuery"
          :placeholder="lookupMode === 'uid' ? $t('components.admin.reseller.uidPlaceholder') : $t('components.admin.reseller.emailPlaceholder')"
          class="lookup-input"
          @keyup.enter="lookupUser"
        />
        <Button
          :label="$t('components.admin.reseller.lookupUser')"
          icon="pi pi-search"
          :loading="lookingUp"
          :disabled="!lookupQuery"
          @click="lookupUser"
        />
      </div>

      <div v-if="lookedUpUser" class="user-info-card">
        <div class="profile-item">
          <span class="profile-label">UID</span>
          <span class="profile-value">{{ lookedUpUser.uid || resolvedUid }}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.admin.reseller.currentRole') }}</span>
          <span class="profile-value">{{ lookedUpUser.role || 'owner' }}</span>
        </div>
        <div v-if="lookedUpUser.role !== 'reseller'" style="margin-top: 1rem">
          <Button
            :label="$t('components.admin.reseller.setRoleReseller')"
            icon="pi pi-user-edit"
            :loading="settingRole"
            @click="setRoleToReseller"
          />
        </div>
        <div v-else style="margin-top: 0.5rem; color: #22C55E; font-weight: 600;">
          <i class="pi pi-check"></i> {{ $t('components.admin.reseller.alreadyReseller') }}
        </div>
      </div>
    </div>

    <!-- Step 2: Create Profile -->
    <div v-if="roleIsSet" class="provision-section">
      <h3 class="section-title">{{ $t('components.admin.reseller.step2Title') }}</h3>
      <div class="profile-form">
        <div class="form-field">
          <label>{{ $t('components.admin.reseller.displayName') }}</label>
          <InputText v-model="profileForm.displayName" class="w-full" />
        </div>
        <div class="form-field">
          <label>{{ $t('components.admin.reseller.email') }}</label>
          <InputText v-model="profileForm.email" class="w-full" />
        </div>
        <div class="form-field">
          <label>{{ $t('components.admin.reseller.feeRate') }} (%)</label>
          <InputNumber v-model="profileForm.feeRatePercent" :min="0" :max="100" :minFractionDigits="1" suffix="%" />
        </div>
        <div class="form-field">
          <div class="checkbox-field">
            <ToggleSwitch v-model="profileForm.canGenerateCodes" />
            <label>{{ $t('components.admin.reseller.canGenerateCodes') }}</label>
          </div>
        </div>
        <div class="form-field">
          <div class="checkbox-field">
            <ToggleSwitch v-model="profileForm.canAcceptExistingOwners" />
            <label>{{ $t('components.admin.reseller.canAcceptExistingOwners') }}</label>
          </div>
        </div>
        <div class="form-field">
          <div class="checkbox-field">
            <ToggleSwitch v-model="profileForm.protected" />
            <label>{{ $t('components.admin.reseller.protected') }}</label>
          </div>
        </div>
        <div class="form-field">
          <label>{{ $t('components.admin.reseller.stripeConnectAccountId') }}</label>
          <InputText v-model="profileForm.stripeConnectAccountId" :placeholder="$t('components.admin.reseller.stripeConnectPlaceholder')" />
        </div>
        <Button
          :label="$t('components.admin.reseller.createProfile')"
          icon="pi pi-check"
          :loading="creatingProfile"
          :disabled="!profileForm.displayName.trim() || !profileForm.email.trim()"
          @click="createProfile"
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
      lookingUp: false,
      settingRole: false,
      creatingProfile: false,
      lookupMode: 'email',
      lookupModes: [
        { label: 'Email', value: 'email' },
        { label: 'UID', value: 'uid' }
      ],
      lookupQuery: '',
      resolvedUid: null,
      lookedUpUser: null,
      roleIsSet: false,
      profileForm: {
        displayName: '',
        email: '',
        feeRatePercent: 0,
        canGenerateCodes: true,
        canAcceptExistingOwners: false,
        protected: false,
        stripeConnectAccountId: ''
      }
    }
  },
  methods: {
    async lookupUser() {
      this.lookingUp = true
      this.lookedUpUser = null
      this.roleIsSet = false
      this.resolvedUid = null
      try {
        const res = this.lookupMode === 'email'
          ? await AdminApi.getUserByEmail(this.user, this.lookupQuery)
          : await AdminApi.getUser(this.user, this.lookupQuery)
        const data = res.data || {}
        this.resolvedUid = data.id || this.lookupQuery
        const role = data.data?.role?.toString() || 'owner'
        this.lookedUpUser = { uid: this.resolvedUid, role }
        if (role === 'reseller') {
          this.roleIsSet = true
        }
      } catch (error) {
        if (error.response?.status === 404 || error.response?.status === 400) {
          if (this.lookupMode === 'uid') {
            this.resolvedUid = this.lookupQuery
            this.lookedUpUser = { uid: this.lookupQuery, role: 'owner' }
          } else {
            this.toast.add({ severity: 'warn', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.userNotFoundByEmail'), life: 5000 })
          }
        } else {
          console.error('Failed to look up user:', error)
          this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.lookupError'), life: 5000 })
        }
      } finally {
        this.lookingUp = false
      }
    },
    async setRoleToReseller() {
      this.settingRole = true
      try {
        await AdminApi.setUserRole(this.user, this.resolvedUid, 'reseller')
        this.lookedUpUser.role = 'reseller'
        this.roleIsSet = true
        this.toast.add({ severity: 'success', summary: this.$t('components.admin.reseller.success'), detail: this.$t('components.admin.reseller.roleSet'), life: 3000 })
      } catch (error) {
        console.error('Failed to set role:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.roleError'), life: 5000 })
      } finally {
        this.settingRole = false
      }
    },
    async createProfile() {
      this.creatingProfile = true
      try {
        const payload = {
          resellerId: this.resolvedUid,
          displayName: this.profileForm.displayName,
          email: this.profileForm.email,
          feeRate: this.profileForm.feeRatePercent / 100,
          canGenerateCodes: this.profileForm.canGenerateCodes,
          canAcceptExistingOwners: this.profileForm.canAcceptExistingOwners,
          protected: this.profileForm.protected
        }
        if (this.profileForm.stripeConnectAccountId) {
          payload.stripeConnectAccountId = this.profileForm.stripeConnectAccountId
        }
        await AdminApi.createResellerProfile(this.user, payload)
        this.toast.add({ severity: 'success', summary: this.$t('components.admin.reseller.success'), detail: this.$t('components.admin.reseller.profileCreated'), life: 3000 })
        router.push('/admin/resellers/' + this.resolvedUid)
      } catch (error) {
        console.error('Failed to create profile:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.createError'), life: 5000 })
      } finally {
        this.creatingProfile = false
      }
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../assets/style/colors';

.provision-reseller {
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem;
}

.back-button {
  margin-bottom: 1rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: @mrcall_dark_grey_text;
  margin-bottom: 1.5rem;
}

.provision-section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: @mrcall_dark_grey_text;
}

.search-mode-toggle {
  margin-bottom: 0.75rem;
}

.lookup-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.lookup-input {
  flex: 1;
}

.user-info-card {
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

.profile-form {
  background: #fff;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #6b7280;
  }
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
