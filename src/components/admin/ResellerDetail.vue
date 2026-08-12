<template>
  <div>
    <Toast />
    <ConfirmDialog />
    <ProgressBar v-show="loading" mode="indeterminate" style="height: .3em" />
    <div v-if="user" class="reseller-detail">
    <Button
      :label="$t('components.admin.reseller.backToList')"
      icon="pi pi-arrow-left"
      text
      @click="router.push('/admin/resellers')"
      class="back-button"
    />

    <!-- Profile Section -->
    <div v-if="profile" class="detail-section">
      <div class="section-header">
        <h2 class="section-title">{{ $t('components.admin.reseller.profileTitle') }}</h2>
        <Button
          :label="$t('components.admin.reseller.editProfile')"
          icon="pi pi-pencil"
          text size="small"
          @click="showEditDialog = true"
        />
      </div>
      <div class="profile-card">
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.admin.reseller.resellerId') }}</span>
          <span class="profile-value">{{ profile.resellerId }}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.admin.reseller.displayName') }}</span>
          <span class="profile-value">{{ profile.displayName }}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.admin.reseller.email') }}</span>
          <span class="profile-value">{{ profile.email }}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.admin.reseller.feeRate') }}</span>
          <span class="profile-value">{{ profile.feeRate != null ? (profile.feeRate * 100).toFixed(1) + '%' : '-' }}</span>
        </div>
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.admin.reseller.canGenerateCodes') }}</span>
          <span class="profile-value">
            <i :class="profile.canGenerateCodes ? 'pi pi-check' : 'pi pi-times'"
               :style="{ color: profile.canGenerateCodes ? '#22C55E' : '#EF4444' }"></i>
          </span>
        </div>
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.admin.reseller.canAcceptExistingOwners') }}</span>
          <span class="profile-value">
            <i :class="profile.canAcceptExistingOwners ? 'pi pi-check' : 'pi pi-times'"
               :style="{ color: profile.canAcceptExistingOwners ? '#22C55E' : '#EF4444' }"></i>
          </span>
        </div>
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.admin.reseller.protected') }}</span>
          <span class="profile-value">
            <i :class="profile.protected ? 'pi pi-shield' : 'pi pi-times'"
               :style="{ color: profile.protected ? '#22C55E' : '#EF4444' }"></i>
          </span>
        </div>
        <div class="profile-item">
          <span class="profile-label">{{ $t('components.admin.reseller.stripeConnectAccountId') }}</span>
          <span class="profile-value">{{ profile.stripeConnectAccountId || '-' }}</span>
        </div>
      </div>
    </div>

    <!-- Fee Rates Section -->
    <div class="detail-section">
      <div class="section-header">
        <h2 class="section-title">{{ $t('components.admin.reseller.feeRates') }}</h2>
      </div>

      <div class="add-mapping-form">
        <Dropdown v-model="newFeeRate.targetType" :options="targetTypes" optionLabel="label" optionValue="value" :placeholder="$t('components.admin.reseller.targetType')" style="width: 140px" />
        <InputText v-model="newFeeRate.targetName" :placeholder="$t('components.admin.reseller.targetName')" />
        <InputNumber v-model="newFeeRate.feeRatePercent" :min="0" :max="100" :minFractionDigits="1" suffix="%" :placeholder="$t('components.admin.reseller.feeRate')" style="width: 120px" />
        <Button
          :label="$t('components.admin.reseller.addFeeRate')"
          icon="pi pi-plus"
          :loading="addingFeeRate"
          :disabled="!newFeeRate.targetType || !newFeeRate.targetName || newFeeRate.feeRatePercent == null"
          @click="addFeeRate"
        />
      </div>

      <DataTable :value="feeRates" :rows="10" :paginator="feeRates.length > 10" stripedRows>
        <Column field="targetType" :header="$t('components.admin.reseller.targetType')" />
        <Column field="targetName" :header="$t('components.admin.reseller.targetName')" />
        <Column :header="$t('components.admin.reseller.feeRate')">
          <template #body="slotProps">
            {{ (slotProps.data.feeRate * 100).toFixed(1) }}%
          </template>
        </Column>
        <Column :header="$t('components.admin.reseller.actions')">
          <template #body="slotProps">
            <Button
              icon="pi pi-trash"
              text size="small" severity="danger"
              :loading="removingFeeRateKey === (slotProps.data.targetType + ':' + slotProps.data.targetName)"
              @click="confirmRemoveFeeRate(slotProps.data)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Managed Owners Section -->
    <div class="detail-section">
      <h2 class="section-title">{{ $t('components.admin.reseller.managedOwners') }}</h2>

      <!-- Add Mapping Form -->
      <div class="add-mapping-form">
        <InputText
          v-model="newOwnerUid"
          :placeholder="$t('components.admin.reseller.ownerUidPlaceholder')"
        />
        <Button
          :label="$t('components.admin.reseller.addMapping')"
          icon="pi pi-plus"
          :loading="addingMapping"
          :disabled="!newOwnerUid"
          @click="addMapping"
        />
      </div>

      <DataTable :value="mappings" :rows="10" :paginator="mappings.length > 10" stripedRows>
        <Column field="ownerId" :header="$t('components.admin.reseller.ownerId')" />
        <Column field="ownerEmail" :header="$t('components.admin.reseller.ownerEmail')" />
        <Column field="source" :header="$t('components.admin.reseller.source')" />
        <Column field="invitationCode" :header="$t('components.admin.reseller.invitationCode')">
          <template #body="slotProps">
            {{ slotProps.data.invitationCode || '-' }}
          </template>
        </Column>
        <Column :header="$t('components.admin.reseller.actions')">
          <template #body="slotProps">
            <Button
              icon="pi pi-arrow-right-arrow-left"
              text size="small" severity="info"
              v-tooltip="$t('components.admin.reseller.transferOwner')"
              @click="openTransferDialog(slotProps.data.ownerId)"
            />
            <Button
              icon="pi pi-trash"
              text size="small" severity="danger"
              :loading="removingMappingId === slotProps.data.ownerId"
              @click="confirmRemoveMapping(slotProps.data.ownerId)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Danger Zone -->
    <div class="detail-section danger-zone">
      <h2 class="section-title danger-title">{{ $t('components.admin.reseller.dangerZone') }}</h2>
      <div class="danger-actions">
        <div class="danger-description">
          <p>{{ $t('components.admin.reseller.revokeDescription') }}</p>
        </div>
        <Button
          :label="$t('components.admin.reseller.revokeReseller')"
          icon="pi pi-ban"
          severity="danger"
          @click="showRevokeDialog = true"
        />
      </div>
    </div>

    <!-- Edit Profile Dialog -->
    <Dialog v-model:visible="showEditDialog" :header="$t('components.admin.reseller.editProfile')" :modal="true" :style="{ width: '500px' }">
      <div class="dialog-form">
        <div class="dialog-field">
          <label>{{ $t('components.admin.reseller.displayName') }}</label>
          <InputText v-model="editForm.displayName" class="w-full" />
        </div>
        <div class="dialog-field">
          <label>{{ $t('components.admin.reseller.email') }}</label>
          <InputText v-model="editForm.email" class="w-full" />
        </div>
        <div class="dialog-field">
          <label>{{ $t('components.admin.reseller.feeRate') }} (%)</label>
          <InputNumber v-model="editForm.feeRatePercent" :min="0" :max="100" :minFractionDigits="1" suffix="%" class="w-full" />
        </div>
        <div class="dialog-field">
          <div class="checkbox-field">
            <ToggleSwitch v-model="editForm.canGenerateCodes" />
            <label>{{ $t('components.admin.reseller.canGenerateCodes') }}</label>
          </div>
        </div>
        <div class="dialog-field">
          <div class="checkbox-field">
            <ToggleSwitch v-model="editForm.canAcceptExistingOwners" />
            <label>{{ $t('components.admin.reseller.canAcceptExistingOwners') }}</label>
          </div>
        </div>
        <div class="dialog-field">
          <div class="checkbox-field">
            <ToggleSwitch v-model="editForm.protected" />
            <label>{{ $t('components.admin.reseller.protected') }}</label>
          </div>
        </div>
        <div class="dialog-field">
          <label>{{ $t('components.admin.reseller.stripeConnectAccountId') }}</label>
          <InputText v-model="editForm.stripeConnectAccountId" class="w-full" :placeholder="$t('components.admin.reseller.stripeConnectPlaceholder')" />
        </div>
      </div>
      <template #footer>
        <Button :label="$t('components.admin.reseller.cancel')" text @click="showEditDialog = false" />
        <Button :label="$t('components.admin.reseller.save')" :loading="saving" @click="saveProfile" />
      </template>
    </Dialog>

    <!-- Revoke Dialog -->
    <Dialog v-model:visible="showRevokeDialog" :header="$t('components.admin.reseller.revokeReseller')" :modal="true" :style="{ width: '450px' }">
      <div class="revoke-dialog-content">
        <p v-if="profile && !profile.protected">{{ $t('components.admin.reseller.revokeConfirmTextUnprotected', { name: profile?.displayName }) }}</p>
        <p v-else>{{ $t('components.admin.reseller.revokeConfirmTextProtected', { name: profile?.displayName }) }}</p>
        <div class="dialog-field">
          <label>{{ $t('components.admin.reseller.typeNameToConfirm') }}</label>
          <InputText v-model="revokeConfirmName" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button :label="$t('components.admin.reseller.cancel')" text @click="showRevokeDialog = false" />
        <Button
          :label="$t('components.admin.reseller.revokeReseller')"
          severity="danger"
          :loading="revoking"
          :disabled="revokeConfirmName.trim().toLowerCase() !== (profile?.displayName || '').trim().toLowerCase()"
          @click="revokeReseller"
        />
      </template>
    </Dialog>

    <!-- Transfer Owner Dialog -->
    <Dialog v-model:visible="showTransferDialog" :header="$t('components.admin.reseller.transferOwner')" :modal="true" :style="{ width: '450px' }">
      <div class="dialog-form">
        <div class="dialog-field">
          <label>{{ $t('components.admin.reseller.ownerId') }}</label>
          <InputText :modelValue="transferOwnerId" disabled class="w-full" />
        </div>
        <div class="dialog-field">
          <label>{{ $t('components.admin.reseller.transferToReseller') }}</label>
          <InputText v-model="transferToResellerId" :placeholder="$t('components.admin.reseller.transferToResellerPlaceholder')" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button :label="$t('components.admin.reseller.cancel')" text @click="showTransferDialog = false" />
        <Button
          :label="$t('components.admin.reseller.transferOwner')"
          :loading="transferring"
          :disabled="!transferToResellerId"
          @click="transferOwner"
        />
      </template>
    </Dialog>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import router from '@/router'
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
      router,
      loading: false,
      saving: false,
      revoking: false,
      addingMapping: false,
      addingFeeRate: false,
      profile: null,
      mappings: [],
      feeRates: [],
      newOwnerUid: '',
      showEditDialog: false,
      showRevokeDialog: false,
      showTransferDialog: false,
      transferOwnerId: '',
      transferToResellerId: '',
      transferring: false,
      revokeConfirmName: '',
      targetTypes: [
        { label: 'Template', value: 'template' },
        { label: 'Product', value: 'product' }
      ],
      removingMappingId: null,
      removingFeeRateKey: null,
      newFeeRate: {
        targetType: null,
        targetName: '',
        feeRatePercent: null
      },
      editForm: {
        displayName: '',
        email: '',
        feeRatePercent: 0,
        canGenerateCodes: false,
        canAcceptExistingOwners: false,
        protected: false,
        stripeConnectAccountId: ''
      }
    }
  },
  computed: {
    resellerId() {
      return this.$route.params.resellerId
    }
  },
  watch: {
    showEditDialog(val) {
      if (val && this.profile) {
        this.editForm = {
          displayName: this.profile.displayName || '',
          email: this.profile.email || '',
          feeRatePercent: this.profile.feeRate != null ? this.profile.feeRate * 100 : 0,
          canGenerateCodes: this.profile.canGenerateCodes || false,
          canAcceptExistingOwners: this.profile.canAcceptExistingOwners || false,
          protected: this.profile.protected || false,
          stripeConnectAccountId: this.profile.stripeConnectAccountId || ''
        }
      }
    },
    showRevokeDialog(val) {
      if (!val) this.revokeConfirmName = ''
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
        const [profilesRes, mappingsRes, feeRatesRes] = await Promise.all([
          AdminApi.getResellerProfiles(this.user, this.resellerId),
          AdminApi.getResellerMappings(this.user, { resellerId: this.resellerId }),
          AdminApi.getFeeRates(this.user, { resellerId: this.resellerId })
        ])
        const profiles = profilesRes.data || []
        this.profile = Array.isArray(profiles) ? profiles[0] : profiles
        this.mappings = mappingsRes.data || []
        this.feeRates = feeRatesRes.data || []
      } catch (error) {
        console.error('Failed to fetch reseller detail:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.fetchError'), life: 5000 })
      } finally {
        this.loading = false
      }
    },
    async saveProfile() {
      this.saving = true
      try {
        const payload = {
          resellerId: this.resellerId,
          displayName: this.editForm.displayName,
          email: this.editForm.email,
          feeRate: this.editForm.feeRatePercent / 100,
          canGenerateCodes: this.editForm.canGenerateCodes,
          canAcceptExistingOwners: this.editForm.canAcceptExistingOwners,
          protected: this.editForm.protected
        }
        if (this.editForm.stripeConnectAccountId) {
          payload.stripeConnectAccountId = this.editForm.stripeConnectAccountId
        }
        await AdminApi.updateResellerProfile(this.user, payload)
        this.toast.add({ severity: 'success', summary: this.$t('components.admin.reseller.success'), detail: this.$t('components.admin.reseller.profileUpdated'), life: 3000 })
        this.showEditDialog = false
        await this.fetchData()
      } catch (error) {
        console.error('Failed to save profile:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.saveError'), life: 5000 })
      } finally {
        this.saving = false
      }
    },
    async addMapping() {
      this.addingMapping = true
      try {
        let ownerId = this.newOwnerUid.trim()
        if (ownerId.includes('@')) {
          try {
            const res = await AdminApi.getUserByEmail(this.user, ownerId)
            ownerId = res.data?.id
            if (!ownerId) throw new Error('NOT_FOUND')
          } catch (lookupErr) {
            const status = lookupErr?.response?.status
            if (status === 404 || status === 400 || lookupErr?.message === 'NOT_FOUND') {
              this.toast.add({ severity: 'warn', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.userNotFoundByEmail'), life: 5000 })
              return
            }
            throw lookupErr
          }
        }
        await AdminApi.createResellerMapping(this.user, {
          resellerId: this.resellerId,
          ownerId: ownerId
        })
        this.toast.add({ severity: 'success', summary: this.$t('components.admin.reseller.success'), detail: this.$t('components.admin.reseller.mappingAdded'), life: 3000 })
        this.newOwnerUid = ''
        await this.fetchData()
      } catch (error) {
        console.error('Failed to add mapping:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.mappingError'), life: 5000 })
      } finally {
        this.addingMapping = false
      }
    },
    confirmRemoveMapping(ownerId) {
      this.confirm.require({
        message: this.$t('components.admin.reseller.removeMappingConfirm'),
        header: this.$t('components.admin.reseller.removeMappingHeader'),
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => this.removeMapping(ownerId)
      })
    },
    async removeMapping(ownerId) {
      this.removingMappingId = ownerId
      try {
        await AdminApi.deleteResellerMapping(this.user, {
          resellerId: this.resellerId,
          ownerId: ownerId
        })
        this.toast.add({ severity: 'success', summary: this.$t('components.admin.reseller.success'), detail: this.$t('components.admin.reseller.mappingRemoved'), life: 3000 })
        await this.fetchData()
      } catch (error) {
        console.error('Failed to remove mapping:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.mappingError'), life: 5000 })
      } finally {
        this.removingMappingId = null
      }
    },
    async addFeeRate() {
      this.addingFeeRate = true
      try {
        await AdminApi.createFeeRate(this.user, {
          resellerId: this.resellerId,
          targetType: this.newFeeRate.targetType,
          targetName: this.newFeeRate.targetName,
          feeRate: this.newFeeRate.feeRatePercent / 100
        })
        this.toast.add({ severity: 'success', summary: this.$t('components.admin.reseller.success'), detail: this.$t('components.admin.reseller.feeRateAdded'), life: 3000 })
        this.newFeeRate = { targetType: null, targetName: '', feeRatePercent: null }
        await this.fetchData()
      } catch (error) {
        console.error('Failed to add fee rate:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.feeRateError'), life: 5000 })
      } finally {
        this.addingFeeRate = false
      }
    },
    confirmRemoveFeeRate(feeRate) {
      this.confirm.require({
        message: this.$t('components.admin.reseller.removeFeeRateConfirm'),
        header: this.$t('components.admin.reseller.removeFeeRateHeader'),
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => this.removeFeeRate(feeRate)
      })
    },
    async removeFeeRate(feeRate) {
      this.removingFeeRateKey = feeRate.targetType + ':' + feeRate.targetName
      try {
        await AdminApi.deleteFeeRate(this.user, {
          resellerId: this.resellerId,
          targetType: feeRate.targetType,
          targetName: feeRate.targetName
        })
        this.toast.add({ severity: 'success', summary: this.$t('components.admin.reseller.success'), detail: this.$t('components.admin.reseller.feeRateRemoved'), life: 3000 })
        await this.fetchData()
      } catch (error) {
        console.error('Failed to remove fee rate:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.feeRateError'), life: 5000 })
      } finally {
        this.removingFeeRateKey = null
      }
    },
    async revokeReseller() {
      this.revoking = true
      try {
        const res = await AdminApi.removeReseller(this.user, this.resellerId)
        const result = res.data || {}
        const detail = this.$t('components.admin.reseller.revokedDetail', {
          owners: result.ownersAffected || 0,
          businesses: result.businessesCanceled || 0
        })
        this.toast.add({ severity: 'success', summary: this.$t('components.admin.reseller.success'), detail, life: 5000 })
        this.showRevokeDialog = false
        router.push('/admin/resellers')
      } catch (error) {
        console.error('Failed to revoke reseller:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.revokeError'), life: 5000 })
      } finally {
        this.revoking = false
      }
    },
    openTransferDialog(ownerId) {
      this.transferOwnerId = ownerId
      this.transferToResellerId = ''
      this.showTransferDialog = true
    },
    async transferOwner() {
      this.transferring = true
      try {
        await AdminApi.transferOwner(this.user, {
          ownerId: this.transferOwnerId,
          fromResellerId: this.resellerId,
          toResellerId: this.transferToResellerId
        })
        this.toast.add({ severity: 'success', summary: this.$t('components.admin.reseller.success'), detail: this.$t('components.admin.reseller.ownerTransferred'), life: 3000 })
        this.showTransferDialog = false
        await this.fetchData()
      } catch (error) {
        console.error('Failed to transfer owner:', error)
        this.toast.add({ severity: 'error', summary: this.$t('components.admin.reseller.error'), detail: this.$t('components.admin.reseller.transferError'), life: 5000 })
      } finally {
        this.transferring = false
      }
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../assets/style/colors';

.reseller-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.back-button {
  margin-bottom: 1rem;
}

.detail-section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: @mrcall_dark_grey_text;
  margin: 0 0 1rem;
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

.add-mapping-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.danger-zone {
  border: 1px solid #fca5a5;
  border-radius: 12px;
  padding: 1.25rem;
  background: #fef2f2;
}

.danger-title {
  color: #c62828;
}

.danger-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.danger-description p {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dialog-field {
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

.revoke-dialog-content p {
  margin-bottom: 1rem;
  color: #6b7280;
}
</style>
