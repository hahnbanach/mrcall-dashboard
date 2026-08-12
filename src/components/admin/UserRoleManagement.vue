<template>
  <Toast />
  <ConfirmDialog />
  <ProgressBar v-show="loading" mode="indeterminate" style="height: .3em" />
  <div v-if="user" class="user-role-management">
    <h1 class="page-title">{{ $t('components.admin.reseller.userRoleTitle') }}</h1>

    <!-- Search -->
    <div class="search-mode-toggle">
      <SelectButton v-model="searchMode" :options="searchModes" optionLabel="label" optionValue="value" />
    </div>
    <div class="search-form">
      <InputText
        v-model="searchQuery"
        :placeholder="searchMode === 'uid' ? $t('components.admin.reseller.uidPlaceholder') : $t('components.admin.reseller.emailPlaceholder')"
        class="search-input"
        @keyup.enter="searchUser"
      />
      <Button
        :label="$t('components.admin.reseller.search')"
        icon="pi pi-search"
        :loading="searching"
        :disabled="!searchQuery"
        @click="searchUser"
      />
    </div>

    <!-- User Info -->
    <div v-if="foundUser" class="user-card">
      <div class="profile-item">
        <span class="profile-label">UID</span>
        <span class="profile-value">{{ foundUser.uid || searchUid }}</span>
      </div>
      <div class="profile-item">
        <span class="profile-label">{{ $t('components.admin.reseller.currentRole') }}</span>
        <span class="profile-value">{{ foundUser.role || 'owner' }}</span>
      </div>

      <div class="role-change-form">
        <label>{{ $t('components.admin.reseller.newRole') }}</label>
        <div class="role-controls">
          <Dropdown
            v-model="newRole"
            :options="roleOptions"
            optionLabel="label"
            optionValue="value"
            :placeholder="$t('components.admin.reseller.selectRole')"
          />
          <Button
            :label="$t('components.admin.reseller.save')"
            icon="pi pi-check"
            :loading="savingRole"
            :disabled="!newRole || newRole === (foundUser.role || 'owner')"
            @click="saveRole"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import AdminApi from '@/utils/Admin'

export default {
  setup() {
    const store = useStore()
    const toast = useToast()
    const confirm = useConfirm()
    return {
      store,
      toast,
      confirm,
      user: computed(() => store.state.user),
    }
  },
  data() {
    return {
      loading: false,
      searching: false,
      savingRole: false,
      searchMode: 'email',
      searchModes: [
        { label: 'Email', value: 'email' },
        { label: 'UID', value: 'uid' }
      ],
      searchQuery: '',
      resolvedUid: null,
      foundUser: null,
      newRole: null,
      roleOptions: [
        { label: 'Owner', value: 'owner' },
        { label: 'Reseller', value: 'reseller' },
        { label: 'Admin', value: 'admin' }
      ]
    }
  },
  methods: {
    async searchUser() {
      this.searching = true
      this.foundUser = null
      this.newRole = null
      this.resolvedUid = null
      try {
        const res = this.searchMode === 'email'
          ? await AdminApi.getUserByEmail(this.user, this.searchQuery)
          : await AdminApi.getUser(this.user, this.searchQuery)
        this.foundUser = res.data || {}
        this.resolvedUid = this.foundUser.id || this.searchQuery
        this.newRole = this.foundUser.data?.role?.toString() || 'owner'
        this.foundUser.role = this.newRole
        this.foundUser.uid = this.resolvedUid
      } catch (error) {
        if (error.response?.status === 404 || error.response?.status === 400) {
          if (this.searchMode === 'uid') {
            this.resolvedUid = this.searchQuery
            this.foundUser = { uid: this.searchQuery, role: 'owner' }
            this.newRole = 'owner'
          } else {
            this.toast.add({ severity: 'warn', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.userNotFoundByEmail'), life: 5000 })
          }
        } else {
          console.error('Failed to search user:', error)
          this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.lookupError'), life: 5000 })
        }
      } finally {
        this.searching = false
      }
    },
    saveRole() {
      this.confirm.require({
        message: this.$t('components.admin.reseller.roleChangeConfirm', { uid: this.resolvedUid, role: this.newRole }),
        header: this.$t('components.admin.reseller.roleChangeHeader'),
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-warning',
        accept: () => this.doSaveRole()
      })
    },
    async doSaveRole() {
      this.savingRole = true
      try {
        if (this.newRole === 'owner') {
          await AdminApi.resetUserRole(this.user, [this.resolvedUid])
        } else {
          await AdminApi.setUserRole(this.user, this.resolvedUid, this.newRole)
        }
        this.foundUser.role = this.newRole
        this.toast.add({ severity: 'success', summary: this.$t('components.admin.reseller.success'), detail: this.$t('components.admin.reseller.roleUpdated'), life: 3000 })
      } catch (error) {
        console.error('Failed to save role:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.roleError'), life: 5000 })
      } finally {
        this.savingRole = false
      }
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../assets/style/colors';

.user-role-management {
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

.search-mode-toggle {
  margin-bottom: 0.75rem;
}

.search-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.search-input {
  flex: 1;
}

.user-card {
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

.role-change-form {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #6b7280;
  }
}

.role-controls {
  display: flex;
  gap: 0.5rem;
}
</style>
