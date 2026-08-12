<template>
  <Toast />
  <ConfirmDialog />
  <ProgressBar v-show="loading" mode="indeterminate" style="height: .3em" />
  <div v-if="user" class="template-list">
    <div class="page-header">
      <h1 class="page-title">{{ $t('components.admin.templates.title') }}</h1>
      <Button
        :label="$t('components.admin.templates.createTemplate')"
        icon="pi pi-plus"
        @click="showCreateDialog = true"
      />
    </div>

    <DataTable
      :value="templates"
      :rows="20"
      :paginator="templates.length > 20"
      stripedRows
      selectionMode="single"
      @rowSelect="onRowSelect"
    >
      <Column field="name" :header="$t('components.admin.templates.name')" sortable />
      <Column :header="$t('components.admin.templates.scope')" sortable>
        <template #body="slotProps">
          <Tag :value="slotProps.data.businessId === '_global' ? 'Global' : 'Business'" :severity="slotProps.data.businessId === '_global' ? 'info' : 'secondary'" />
        </template>
      </Column>
      <Column field="description" :header="$t('components.admin.templates.description')" />
      <Column :header="$t('components.admin.templates.provider')">
        <template #body="slotProps">
          {{ slotProps.data.agentConfig?.llmConfig?.provider || '-' }}
        </template>
      </Column>
      <Column :header="$t('components.admin.templates.model')">
        <template #body="slotProps">
          {{ slotProps.data.agentConfig?.llmConfig?.model || '-' }}
        </template>
      </Column>
      <Column field="version" :header="$t('components.admin.templates.version')" sortable />
      <Column :header="$t('components.admin.templates.enabled')">
        <template #body="slotProps">
          <i :class="slotProps.data.enabled !== false ? 'pi pi-check' : 'pi pi-times'"
             :style="{ color: slotProps.data.enabled !== false ? '#22C55E' : '#9CA3AF' }"></i>
        </template>
      </Column>
      <Column :header="$t('components.admin.reseller.actions')">
        <template #body="slotProps">
          <div class="action-buttons">
            <Button
              icon="pi pi-pencil"
              text size="small"
              @click.stop="router.push('/admin/templates/' + encodeURIComponent(slotProps.data.name))"
            />
            <Button
              icon="pi pi-trash"
              text size="small"
              severity="danger"
              @click.stop="confirmDelete(slotProps.data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="showCreateDialog" :header="$t('components.admin.templates.createTemplate')" modal :style="{ width: '28rem' }">
      <div class="create-form">
        <div class="create-field">
          <label>{{ $t('components.admin.templates.name') }}</label>
          <InputText v-model="newName" :placeholder="$t('components.admin.templates.name')" />
        </div>
        <div class="create-field">
          <label>{{ $t('components.admin.templates.description') }}</label>
          <InputText v-model="newDescription" :placeholder="$t('components.admin.templates.description')" />
        </div>
        <div class="create-field">
          <label>{{ $t('components.admin.templates.scope') }}</label>
          <Dropdown
            v-model="newScope"
            :options="scopeOptions"
            optionLabel="label"
            optionValue="value"
          />
        </div>
      </div>
      <template #footer>
        <Button :label="$t('common.cancel')" text @click="showCreateDialog = false" />
        <Button :label="$t('components.admin.templates.createTemplate')" icon="pi pi-check" :disabled="!newName.trim()" :loading="creating" @click="createTemplate" />
      </template>
    </Dialog>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import router from '@/router'
import AgentTemplatesApi from '@/utils/AgentTemplates'

export default {
  setup() {
    const store = useStore()
    const toast = useToast()
    const confirm = useConfirm()
    return {
      store,
      toast,
      confirm,
      user: computed(() => store.state.user)
    }
  },
  data() {
    return {
      router,
      loading: false,
      creating: false,
      templates: [],
      showCreateDialog: false,
      newName: '',
      newDescription: '',
      newScope: '_global',
      scopeOptions: [
        { label: 'Global', value: '_global' },
        { label: 'Business', value: '' }
      ]
    }
  },
  mounted() {
    if (this.user) {
      this.fetchTemplates()
    }
  },
  methods: {
    async fetchTemplates() {
      this.loading = true
      try {
        const res = await AgentTemplatesApi.listTemplates(this.user)
        this.templates = res.data || []
      } catch (error) {
        console.error('Failed to fetch templates:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.admin.reseller.error'),
          detail: error.response?.data?.message || 'Failed to load templates',
          life: 5000
        })
      } finally {
        this.loading = false
      }
    },
    async createTemplate() {
      if (!this.newName.trim()) return
      this.creating = true
      try {
        await AgentTemplatesApi.createTemplate(this.user, {
          name: this.newName.trim(),
          description: this.newDescription.trim(),
          scope: this.newScope || undefined,
          agentConfig: {
            name: this.newName.trim(),
            systemPrompt: "You are a helpful assistant.",
            llmConfig: {
              provider: "openai",
              model: "gpt-4o",
              temperature: 0.7,
              maxTokens: 4096,
              timeoutSeconds: 60
            },
            tools: [],
            maxToolIterations: 10,
            maxHistoryMessages: 200,
            enableMemory: false,
            requestTimeoutSeconds: 60
          }
        })
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.admin.reseller.success'),
          detail: this.$t('components.admin.templates.created'),
          life: 3000
        })
        this.showCreateDialog = false
        const createdName = this.newName.trim()
        this.newName = ''
        this.newDescription = ''
        this.newScope = '_global'
        router.push('/admin/templates/' + encodeURIComponent(createdName))
      } catch (error) {
        console.error('Failed to create template:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.admin.reseller.error'),
          detail: error.response?.data?.message || 'Failed to create template',
          life: 5000
        })
      } finally {
        this.creating = false
      }
    },
    confirmDelete(template) {
      this.confirm.require({
        message: this.$t('components.admin.templates.deleteConfirm', { name: template.name }),
        header: this.$t('common.confirm'),
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: () => this.deleteTemplate(template.name)
      })
    },
    async deleteTemplate(name) {
      this.loading = true
      try {
        await AgentTemplatesApi.deleteTemplate(this.user, name)
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.admin.reseller.success'),
          detail: this.$t('components.admin.templates.deleted'),
          life: 3000
        })
        await this.fetchTemplates()
      } catch (error) {
        console.error('Failed to delete template:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.admin.reseller.error'),
          detail: error.response?.data?.message || 'Failed to delete template',
          life: 5000
        })
      } finally {
        this.loading = false
      }
    },
    onRowSelect(event) {
      router.push('/admin/templates/' + encodeURIComponent(event.data.name))
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../../assets/style/colors';

.template-list {
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

.action-buttons {
  display: flex;
  gap: 0.25rem;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.5rem;
}

.create-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: @mrcall_dark_grey_text;
  }
}
</style>
