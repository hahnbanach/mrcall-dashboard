<template>
  <Toast />
  <ProgressBar v-show="loading" mode="indeterminate" style="height: .3em" />
  <div v-if="user" class="invitation-codes">
    <h1 class="page-title">{{ $t('components.reseller.codes.title') }}</h1>

    <!-- Generate Form -->
    <div class="codes-section">
      <div class="generate-header" @click="showGenerateForm = !showGenerateForm">
        <h3 class="section-title">
          <i :class="showGenerateForm ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" style="margin-right: 0.5rem"></i>
          {{ $t('components.reseller.codes.generateTitle') }}
        </h3>
      </div>
      <div v-if="showGenerateForm" class="generate-form">
        <div class="form-row">
          <div class="form-field">
            <label>{{ $t('components.reseller.codes.label') }}</label>
            <InputText v-model="newCode.label" :placeholder="$t('components.reseller.codes.labelPlaceholder')" />
          </div>
          <div class="form-field">
            <label>{{ $t('components.reseller.codes.maxUses') }}</label>
            <InputNumber v-model="newCode.maxUses" :min="1" :placeholder="$t('components.reseller.codes.maxUsesPlaceholder')" />
          </div>
          <div class="form-field">
            <label>{{ $t('components.reseller.codes.expiresAt') }}</label>
            <Calendar v-model="newCode.expiresAt" :showIcon="true" :showButtonBar="true" :minDate="new Date()" />
          </div>
        </div>
        <Button
          :label="$t('components.reseller.codes.generate')"
          icon="pi pi-plus"
          :loading="generating"
          @click="generateCode"
        />
      </div>
    </div>

    <!-- Codes DataTable -->
    <div class="codes-section">
      <h3 class="section-title">{{ $t('components.reseller.codes.listTitle') }}</h3>
      <DataTable :value="codes" :rows="10" :paginator="codes.length > 10" stripedRows>
        <Column field="code" :header="$t('components.reseller.codes.code')" />
        <Column field="label" :header="$t('components.reseller.codes.labelHeader')" />
        <Column :header="$t('components.reseller.codes.uses')">
          <template #body="slotProps">
            {{ slotProps.data.useCount || 0 }}{{ slotProps.data.maxUses ? ' / ' + slotProps.data.maxUses : '' }}
          </template>
        </Column>
        <Column :header="$t('components.reseller.codes.status')">
          <template #body="slotProps">
            <span class="status-badge" :class="'status-' + getStatusSeverity(slotProps.data)">
              {{ getStatusLabel(slotProps.data) }}
            </span>
          </template>
        </Column>
        <Column field="createdAt" :header="$t('components.reseller.codes.created')">
          <template #body="slotProps">
            {{ formatDate(slotProps.data.createdAt) }}
          </template>
        </Column>
        <Column :header="$t('components.reseller.codes.actions')">
          <template #body="slotProps">
            <div class="code-actions">
              <Button
                icon="pi pi-copy"
                :label="$t('components.reseller.codes.copyLink')"
                text size="small"
                @click="copyLink(slotProps.data.code)"
              />
              <Button
                v-if="isCodeActive(slotProps.data)"
                icon="pi pi-ban"
                :label="$t('components.reseller.codes.deactivate')"
                text size="small" severity="danger"
                @click="confirmDeactivate(slotProps.data.code)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import ResellerApi from '@/utils/Reseller'

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
      generating: false,
      showGenerateForm: false,
      codes: [],
      newCode: {
        label: '',
        maxUses: null,
        expiresAt: null
      }
    }
  },
  mounted() {
    if (this.user) {
      this.fetchCodes()
    }
  },
  methods: {
    async fetchCodes() {
      this.loading = true
      try {
        const response = await ResellerApi.getInvitationCodes(this.user)
        this.codes = response.data || []
      } catch (error) {
        console.error('Failed to fetch codes:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.reseller.codes.error'),
          detail: this.$t('components.reseller.codes.fetchError'),
          life: 5000
        })
      } finally {
        this.loading = false
      }
    },
    async generateCode() {
      this.generating = true
      try {
        const data = { label: this.newCode.label }
        if (this.newCode.maxUses) data.maxUses = this.newCode.maxUses
        if (this.newCode.expiresAt) data.expiresAt = this.newCode.expiresAt.getTime()

        await ResellerApi.generateInvitationCode(this.user, data)
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.reseller.codes.success'),
          detail: this.$t('components.reseller.codes.generated'),
          life: 3000
        })
        this.newCode = { label: '', maxUses: null, expiresAt: null }
        this.showGenerateForm = false
        await this.fetchCodes()
      } catch (error) {
        console.error('Failed to generate code:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.reseller.codes.error'),
          detail: this.$t('components.reseller.codes.generateError'),
          life: 5000
        })
      } finally {
        this.generating = false
      }
    },
    confirmDeactivate(code) {
      this.confirm.require({
        message: this.$t('components.reseller.codes.deactivateConfirm'),
        header: this.$t('components.reseller.codes.deactivateHeader'),
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => this.deactivateCode(code)
      })
    },
    async deactivateCode(code) {
      try {
        await ResellerApi.deactivateCode(this.user, code)
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.reseller.codes.success'),
          detail: this.$t('components.reseller.codes.deactivated'),
          life: 3000
        })
        await this.fetchCodes()
      } catch (error) {
        console.error('Failed to deactivate code:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.reseller.codes.error'),
          detail: this.$t('components.reseller.codes.deactivateError'),
          life: 5000
        })
      }
    },
    copyLink(code) {
      const link = (process.env.VUE_APP_SERVICE_BASE_URL || window.location.origin) + '/signup?ref=' + code
      navigator.clipboard.writeText(link).then(() => {
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.reseller.codes.success'),
          detail: this.$t('components.reseller.codes.linkCopied'),
          life: 3000
        })
      })
    },
    isCodeActive(codeData) {
      if (!codeData.active) return false
      if (codeData.maxUses && codeData.useCount >= codeData.maxUses) return false
      if (codeData.expiresAt && new Date(codeData.expiresAt) < new Date()) return false
      return true
    },
    getStatusLabel(codeData) {
      if (!codeData.active) return this.$t('components.reseller.codes.statusInactive')
      if (codeData.maxUses && codeData.useCount >= codeData.maxUses) return this.$t('components.reseller.codes.statusFull')
      if (codeData.expiresAt && new Date(codeData.expiresAt) < new Date()) return this.$t('components.reseller.codes.statusExpired')
      return this.$t('components.reseller.codes.statusActive')
    },
    getStatusSeverity(codeData) {
      if (!codeData.active) return 'danger'
      if (codeData.maxUses && codeData.useCount >= codeData.maxUses) return 'warn'
      if (codeData.expiresAt && new Date(codeData.expiresAt) < new Date()) return 'warn'
      return 'success'
    },
    formatDate(ts) {
      if (!ts) return '-'
      return new Date(ts).toLocaleDateString()
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../assets/style/colors';

.invitation-codes {
  max-width: 960px;
  margin: 0 auto;
  padding: 1rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: @mrcall_dark_grey_text;
  margin-bottom: 1.5rem;
}

.codes-section {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: @mrcall_dark_grey_text;
}

.generate-header {
  cursor: pointer;
  user-select: none;
}

.generate-form {
  background: #fff;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-field {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #6b7280;
  }
}

.code-actions {
  display: flex;
  gap: 0.25rem;
}

.status-badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-success {
  background: #e6f7ee;
  color: #1a7d42;
}

.status-warn {
  background: #fff3e0;
  color: #b86e00;
}

.status-danger {
  background: #fde8e8;
  color: #c62828;
}

@media screen and (max-width: 640px) {
  .form-row {
    flex-direction: column;
  }
}
</style>
