<template>
  <Toast />
  <ConfirmDialog />
  <ProgressBar v-show="loading" mode="indeterminate" style="height: .3em" />
  <div v-if="user" class="template-editor">
    <div class="editor-header">
      <div class="header-left">
        <Button icon="pi pi-arrow-left" text @click="goBack" />
        <h1 class="editor-title">
          {{ templateData?.name || templateName }}
          <span v-if="templateData?.version" class="version-badge">v{{ templateData.version }}</span>
        </h1>
      </div>
      <div class="header-actions">
        <Button
          :label="$t('components.admin.templates.test')"
          icon="pi pi-play"
          class="p-button-outlined"
          @click="showTestPanel = !showTestPanel"
        />
        <Button
          :label="$t('components.admin.templates.save')"
          icon="pi pi-check"
          :loading="saving"
          :disabled="!isDirty"
          @click="saveTemplate"
        />
      </div>
    </div>

    <div v-if="templateData" class="editor-description">
      <InputText
        v-model="editedDescription"
        :placeholder="$t('components.admin.templates.description')"
        class="description-input"
      />
    </div>

    <div class="editor-body" :class="{ 'with-test': showTestPanel }">
      <div class="editor-left">
        <TemplateForm
          v-model="editedConfig"
          :availableTools="availableTools"
        />
      </div>
      <div class="editor-right">
        <TemplateAIChat
          :currentPrompt="editedConfig.systemPrompt || ''"
          :currentTools="editedConfig.tools || []"
          :templateName="templateName"
          @apply-prompt="applyPrompt"
        />
      </div>
    </div>

    <div v-if="showTestPanel" class="test-panel-section">
      <TemplateTestChat :agentConfig="editedConfig" />
    </div>

    <div v-if="versions.length > 0" class="version-history">
      <h3>{{ $t('components.admin.templates.versionHistory') }}</h3>
      <div class="version-list">
        <div
          v-for="v in versions"
          :key="v.version"
          :class="['version-item', { 'version-current': v.version === templateData?.version }]"
        >
          <span class="version-label">v{{ v.version }}</span>
          <span class="version-date">{{ formatDate(v.createdAt) }}</span>
          <Button
            v-if="v.version !== templateData?.version"
            :label="$t('components.admin.templates.rollback')"
            class="p-button-outlined p-button-sm"
            @click="confirmRollback(v.version)"
          />
          <span v-else class="version-current-label">current</span>
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
import router from '@/router'
import AgentTemplatesApi from '@/utils/AgentTemplates'
import TemplateForm from './TemplateForm.vue'
import TemplateAIChat from './TemplateAIChat.vue'
import TemplateTestChat from './TemplateTestChat.vue'

export default {
  components: { TemplateForm, TemplateAIChat, TemplateTestChat },
  props: {
    templateName: { type: String, required: true }
  },
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
      loading: false,
      saving: false,
      templateData: null,
      editedConfig: {},
      editedDescription: '',
      savedConfigJson: '',
      savedDescription: '',
      availableTools: [],
      versions: [],
      showTestPanel: false
    }
  },
  computed: {
    isDirty() {
      return JSON.stringify(this.editedConfig) !== this.savedConfigJson ||
             this.editedDescription !== this.savedDescription
    }
  },
  mounted() {
    if (this.user) {
      this.loadTemplate()
      this.loadTools()
    }
  },
  methods: {
    async loadTemplate() {
      this.loading = true
      try {
        const res = await AgentTemplatesApi.getTemplate(this.user, this.templateName)
        this.templateData = res.data
        this.editedConfig = JSON.parse(JSON.stringify(res.data.agentConfig || {}))
        this.editedDescription = res.data.description || ''
        this.savedConfigJson = JSON.stringify(this.editedConfig)
        this.savedDescription = this.editedDescription
        this.loadVersions()
      } catch (error) {
        console.error('Failed to load template:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.admin.reseller.error'),
          detail: error.response?.data?.message || 'Failed to load template',
          life: 5000
        })
      } finally {
        this.loading = false
      }
    },
    async loadTools() {
      try {
        const res = await AgentTemplatesApi.listTools(this.user)
        const data = res.data
        const toolsArray = Array.isArray(data) ? data : (data && Array.isArray(data.tools) ? data.tools : [])
        this.availableTools = toolsArray.map(t => typeof t === 'string' ? t : t.name || t.id || '')
      } catch (error) {
        console.error('Failed to load tools:', error)
      }
    },
    async loadVersions() {
      try {
        const res = await AgentTemplatesApi.getVersions(this.user, this.templateName)
        this.versions = res.data || []
      } catch (error) {
        console.error('Failed to load versions:', error)
      }
    },
    async saveTemplate() {
      this.saving = true
      try {
        const updateData = {}
        if (this.editedDescription !== this.savedDescription) {
          updateData.description = this.editedDescription
        }
        if (JSON.stringify(this.editedConfig) !== this.savedConfigJson) {
          updateData.agentConfig = this.editedConfig
        }
        await AgentTemplatesApi.updateTemplate(this.user, this.templateName, updateData)
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.admin.reseller.success'),
          detail: this.$t('components.admin.templates.saved'),
          life: 3000
        })
        await this.loadTemplate()
      } catch (error) {
        console.error('Failed to save template:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.admin.reseller.error'),
          detail: error.response?.data?.message || 'Failed to save template',
          life: 5000
        })
      } finally {
        this.saving = false
      }
    },
    applyPrompt(newPrompt) {
      this.editedConfig = { ...this.editedConfig, systemPrompt: newPrompt }
      this.toast.add({
        severity: 'info',
        summary: this.$t('components.admin.templates.applyToPrompt'),
        detail: 'Prompt updated in form. Save to persist.',
        life: 3000
      })
    },
    confirmRollback(version) {
      this.confirm.require({
        message: this.$t('components.admin.templates.rollbackConfirm', { version }),
        header: this.$t('components.admin.templates.rollback'),
        icon: 'pi pi-exclamation-triangle',
        accept: () => this.doRollback(version)
      })
    },
    async doRollback(version) {
      this.loading = true
      try {
        await AgentTemplatesApi.rollbackVersion(this.user, this.templateName, version)
        this.toast.add({
          severity: 'success',
          summary: this.$t('components.admin.reseller.success'),
          detail: this.$t('components.admin.templates.rolledBack', { version }),
          life: 3000
        })
        await this.loadTemplate()
      } catch (error) {
        console.error('Failed to rollback:', error)
        this.toast.add({
          severity: 'error',
          summary: this.$t('components.admin.reseller.error'),
          detail: error.response?.data?.message || 'Failed to rollback',
          life: 5000
        })
      } finally {
        this.loading = false
      }
    },
    formatDate(ts) {
      if (!ts) return ''
      return new Date(ts).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    },
    goBack() {
      if (this.isDirty) {
        this.confirm.require({
          message: this.$t('components.admin.templates.unsavedChanges'),
          header: this.$t('common.confirm'),
          icon: 'pi pi-exclamation-triangle',
          accept: () => router.push('/admin/templates')
        })
      } else {
        router.push('/admin/templates')
      }
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../../assets/style/colors';

.template-editor {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.editor-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: @mrcall_dark_grey_text;
  margin: 0;
}

.version-badge {
  font-size: 0.75rem;
  font-weight: 600;
  background: @mrcall_blue;
  color: @mrcall_white;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  vertical-align: middle;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.editor-description {
  margin-bottom: 1rem;

  .description-input {
    width: 100%;
  }
}

.editor-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.editor-left {
  min-width: 0;
}

.editor-right {
  min-width: 0;
}

.test-panel-section {
  margin-bottom: 1.5rem;
}

.version-history {
  border-top: 1px solid @mrcall_borders;
  padding-top: 1rem;

  h3 {
    font-size: 1rem;
    font-weight: 600;
    color: @mrcall_dark_grey_text;
    margin: 0 0 0.75rem 0;
  }
}

.version-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.version-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid @mrcall_borders;
  border-radius: 8px;
  background: #fff;
}

.version-current {
  border-color: @mrcall_blue;
  background: #f0f7ff;
}

.version-label {
  font-weight: 600;
  font-size: 0.85rem;
  color: @mrcall_dark_grey_text;
}

.version-date {
  font-size: 0.8rem;
  color: @mrcall_grey_text;
}

.version-current-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: @mrcall_blue;
  text-transform: uppercase;
}

@media screen and (max-width: 768px) {
  .editor-body {
    grid-template-columns: 1fr;
  }
}
</style>
