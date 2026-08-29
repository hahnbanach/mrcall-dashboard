<template>
  <BusinessFrame>
    <template #spinner>
      <ProgressBar v-show="loading" mode="indeterminate" style="height: 0.3em; border-radius: 0;" />
    </template>

    <template #messages>
      <Message
        v-if="message"
        :severity="message.severity"
        :sticky="message.sticky"
        :life="message.life"
        :key="message.id"
      >{{ message.content }}</Message>
    </template>

    <template #beforetitle>
      <Button
        :label="t('views.mcpConnectors.back')"
        icon="pi pi-arrow-left"
        text size="small"
        class="mb-2"
        @click="goBack()"
      />
    </template>

    <template #title>{{ t('views.mcpConnectors.title') }}</template>

    <template #subtitle>{{ t('views.mcpConnectors.subtitle') }}</template>

    <template #content>
      <div class="mcp-connectors-content">

        <!-- Reveal-once card: shown once after mint or rotate -->
        <div v-if="reveal" class="reveal-card">
          <h3 class="reveal-title">
            <i class="pi pi-exclamation-triangle" />
            {{ t('views.mcpConnectors.reveal.title') }}
          </h3>
          <p class="reveal-warning">
            <strong>{{ t('views.mcpConnectors.reveal.warningTitle') }}</strong>
            {{ t('views.mcpConnectors.reveal.warningBody') }}
          </p>

          <div class="reveal-grid">
            <span class="reveal-label">{{ t('views.mcpConnectors.reveal.mcpUrl') }}</span>
            <code class="reveal-value">{{ info && info.mcp_url || '' }}</code>
            <Button
              :label="copied.url ? t('views.mcpConnectors.reveal.copied') : t('views.mcpConnectors.reveal.copy')"
              :icon="copied.url ? 'pi pi-check' : 'pi pi-copy'"
              text size="small"
              @click="copyValue(info && info.mcp_url, 'url')"
            />

            <span class="reveal-label">{{ t('views.mcpConnectors.reveal.clientId') }}</span>
            <code class="reveal-value">{{ reveal.clientId }}</code>
            <Button
              :label="copied.id ? t('views.mcpConnectors.reveal.copied') : t('views.mcpConnectors.reveal.copy')"
              :icon="copied.id ? 'pi pi-check' : 'pi pi-copy'"
              text size="small"
              @click="copyValue(reveal.clientId, 'id')"
            />

            <span class="reveal-label">{{ t('views.mcpConnectors.reveal.clientSecret') }}</span>
            <code class="reveal-value reveal-secret">{{ reveal.clientSecret }}</code>
            <Button
              :label="copied.secret ? t('views.mcpConnectors.reveal.copied') : t('views.mcpConnectors.reveal.copy')"
              :icon="copied.secret ? 'pi pi-check' : 'pi pi-copy'"
              text size="small"
              @click="copyValue(reveal.clientSecret, 'secret')"
            />
          </div>

          <p class="reveal-howto">{{ t('views.mcpConnectors.reveal.howTo') }}</p>

          <div class="reveal-actions">
            <Button
              :label="t('views.mcpConnectors.reveal.acknowledge')"
              icon="pi pi-check"
              @click="dismissReveal"
            />
          </div>
        </div>

        <!-- Info card (always visible): MCP URL + integration hints -->
        <div class="info-card">
          <h3 class="info-title">
            <i class="pi pi-info-circle" />
            {{ t('views.mcpConnectors.info.title') }}
          </h3>
          <p>{{ t('views.mcpConnectors.info.intro') }}</p>

          <div class="info-row" v-if="info && info.mcp_url">
            <span class="info-label">{{ t('views.mcpConnectors.info.mcpUrl') }}</span>
            <code class="info-value">{{ info.mcp_url }}</code>
            <Button
              :label="copied.infoUrl ? t('views.mcpConnectors.reveal.copied') : t('views.mcpConnectors.reveal.copy')"
              :icon="copied.infoUrl ? 'pi pi-check' : 'pi pi-copy'"
              text size="small"
              @click="copyValue(info.mcp_url, 'infoUrl')"
            />
          </div>

          <p class="info-instructions" v-if="info && info.instructions">
            {{ info.instructions.claude_ai }}
          </p>

          <details class="info-advanced" v-if="info">
            <summary>{{ t('views.mcpConnectors.info.advanced') }}</summary>
            <ul class="info-meta">
              <li>
                <strong>{{ t('views.mcpConnectors.info.allowedScopes') }}:</strong>
                <code>{{ (info.allowed_scopes || []).join(' ') }}</code>
              </li>
              <li>
                <strong>{{ t('views.mcpConnectors.info.protectedResource') }}:</strong>
                <code>{{ info.well_known_protected_resource }}</code>
              </li>
              <li>
                <strong>{{ t('views.mcpConnectors.info.authServer') }}:</strong>
                <code>{{ info.well_known_auth_server }}</code>
              </li>
            </ul>
          </details>
        </div>

        <!-- Create form -->
        <div class="create-card">
          <h3>{{ t('views.mcpConnectors.create.title') }}</h3>
          <p class="muted">{{ t('views.mcpConnectors.create.help') }}</p>
          <div class="form-row">
            <label for="connector-name">{{ t('views.mcpConnectors.create.nameLabel') }}</label>
            <InputText
              id="connector-name"
              v-model="form.name"
              :placeholder="t('views.mcpConnectors.create.namePlaceholder')"
              :disabled="creating"
              maxlength="256"
            />
          </div>
          <div class="form-row">
            <label for="connector-description">{{ t('views.mcpConnectors.create.descriptionLabel') }}</label>
            <Textarea
              id="connector-description"
              v-model="form.description"
              :placeholder="t('views.mcpConnectors.create.descriptionPlaceholder')"
              :disabled="creating"
              rows="2"
              maxlength="1024"
            />
          </div>

          <!-- Per-connector permission scopes -->
          <div class="scopes-section" v-if="groupedScopes.length > 0">
            <div class="scopes-header">
              <h4>{{ t('views.mcpConnectors.scopes.title') }}</h4>
              <div class="scopes-bulk">
                <Button
                  :label="t('views.mcpConnectors.scopes.selectAll')"
                  text size="small"
                  :disabled="creating"
                  @click="selectAllScopes"
                />
                <Button
                  :label="t('views.mcpConnectors.scopes.clearAll')"
                  text size="small"
                  :disabled="creating"
                  @click="clearAllScopes"
                />
              </div>
            </div>
            <p class="muted scopes-help">{{ t('views.mcpConnectors.scopes.help') }}</p>

            <div
              v-for="grp in groupedScopes"
              :key="grp.group"
              class="scope-group"
            >
              <div class="scope-group-header">
                <span class="scope-group-name">{{ groupLabel(grp.group) }}</span>
                <div class="scope-group-bulk">
                  <Button
                    :label="t('views.mcpConnectors.scopes.selectAll')"
                    text size="small"
                    :disabled="creating"
                    @click="toggleGroup(grp.group, true)"
                  />
                  <Button
                    :label="t('views.mcpConnectors.scopes.clearAll')"
                    text size="small"
                    :disabled="creating"
                    @click="toggleGroup(grp.group, false)"
                  />
                </div>
              </div>
              <ul class="scope-list">
                <li v-for="entry in grp.entries" :key="entry.scope" class="scope-row">
                  <label class="scope-item">
                    <input
                      type="checkbox"
                      :value="entry.scope"
                      :checked="isScopeSelected(entry.scope)"
                      :disabled="creating"
                      @change="onScopeToggle(entry.scope, $event.target.checked)"
                    />
                    <span class="scope-text">
                      <code class="scope-name">{{ entry.scope }}</code>
                      <span class="scope-label">{{ entry.label }}</span>
                      <span v-if="entry.sensitive" class="scope-sensitive">
                        {{ t('views.mcpConnectors.scopes.sensitive') }}
                      </span>
                      <span class="scope-description">{{ entry.description }}</span>
                    </span>
                  </label>
                </li>
              </ul>
            </div>
          </div>

          <div class="form-actions">
            <Button
              :label="t('views.mcpConnectors.create.submit')"
              icon="pi pi-plus"
              :disabled="creating || !form.name || form.allowedScopes.length === 0"
              @click="onCreate"
            />
          </div>
        </div>

        <!-- Existing connectors list -->
        <div class="list-card">
          <h3>{{ t('views.mcpConnectors.list.title') }}</h3>
          <p v-if="!connectors || connectors.length === 0" class="muted">
            {{ t('views.mcpConnectors.list.empty') }}
          </p>
          <ul v-else class="connector-list">
            <li v-for="c in connectors" :key="c.clientId" class="connector-row">
              <div class="connector-meta">
                <span v-if="c.clientName" class="connector-name">{{ c.clientName }}</span>
                <code class="connector-id">{{ c.clientId }}</code>
                <span class="connector-date">
                  {{ t('views.mcpConnectors.list.createdAt') }}: {{ formatDate(c.createdAt) }}
                </span>
                <div class="connector-scopes" v-if="c.allowedScopes && c.allowedScopes.length > 0">
                  <span class="connector-scopes-label">
                    {{ t('views.mcpConnectors.list.permissions') }}:
                  </span>
                  <span
                    v-for="s in c.allowedScopes"
                    :key="s"
                    class="scope-tag"
                  >{{ s }}</span>
                </div>
              </div>
              <div class="connector-actions">
                <Button
                  :label="t('views.mcpConnectors.list.rotate')"
                  icon="pi pi-refresh"
                  size="small"
                  severity="warn"
                  :disabled="rotatingId === c.clientId"
                  @click="onRotate(c.clientId)"
                />
              </div>
            </li>
          </ul>
        </div>

      </div>
    </template>

    <template #footer>
      <div class="footer_buttonbar">
        <Button
          :label="t('views.mcpConnectors.back')"
          icon="pi pi-arrow-left"
          text
          @click="goBack()"
        />
      </div>
    </template>
  </BusinessFrame>
</template>

<script>
import BusinessFrame from "@/components/templates/business/BusinessFrame"
import { computed } from "vue"
import { useStore } from "vuex"
import { useI18n } from "vue-i18n"
import McpConnectorsApi from "@/utils/McpConnectors"

export default {
  components: { BusinessFrame },
  name: "McpConnectors",
  setup() {
    const store = useStore()
    return {
      store,
      user: computed(() => store.state.user),
      authIsReady: computed(() => store.state.authIsReady),
    }
  },
  data() {
    const { t } = useI18n()
    return {
      t,
      loading: false,
      creating: false,
      rotatingId: null,
      message: undefined,
      info: null,
      connectors: [],
      form: {
        name: "",
        description: "",
        allowedScopes: []
      },
      reveal: null, // { clientId, clientSecret } shown after mint or rotate
      copied: {
        url: false,
        id: false,
        secret: false,
        infoUrl: false
      }
    }
  },
  methods: {
    goBack() {
      this.$router.push({ name: "Businesses" })
    },

    setMessage(severity, content, sticky = false, life = 4000) {
      this.message = { id: Date.now(), severity, content, sticky, life }
    },

    async loadAll() {
      if (!this.user) return
      this.loading = true
      try {
        const [info, list] = await Promise.all([
          McpConnectorsApi.info(this.user),
          McpConnectorsApi.list(this.user)
        ])
        this.info = info
        this.connectors = Array.isArray(list) ? list : []
        // Default: pre-select the full customer surface (back-compat with the
        // server's default when allowed_scopes is omitted). The user can
        // narrow by unchecking; the submit button is disabled if zero scopes.
        const catalog = (info && info.scope_catalog) || []
        this.form.allowedScopes = catalog.map(e => e.scope)
      } catch (e) {
        const status = e && e.response && e.response.status
        if (status === 503) {
          // MCP not enabled on this environment
          this.setMessage("warn", this.t('views.mcpConnectors.errors.serviceDisabled'), true)
        } else {
          this.setMessage("error", this.t('views.mcpConnectors.errors.loadFailed') + (status ? ` (${status})` : ""), true)
        }
      } finally {
        this.loading = false
      }
    },

    async onCreate() {
      if (!this.user || !this.form.name) return
      if (!this.form.allowedScopes || this.form.allowedScopes.length === 0) return
      this.creating = true
      this.message = undefined
      try {
        const minted = await McpConnectorsApi.create(this.user, {
          name: this.form.name,
          description: this.form.description || undefined,
          allowedScopes: this.form.allowedScopes.slice()
        })
        this.reveal = {
          clientId: minted.clientId,
          clientSecret: minted.clientSecret
        }
        // Reset form, keep default full-surface scopes pre-selected for the
        // next mint operation.
        const catalog = (this.info && this.info.scope_catalog) || []
        this.form = {
          name: "",
          description: "",
          allowedScopes: catalog.map(e => e.scope)
        }
        // refresh list
        const list = await McpConnectorsApi.list(this.user)
        this.connectors = Array.isArray(list) ? list : []
      } catch (e) {
        const status = e && e.response && e.response.status
        this.setMessage("error", this.t('views.mcpConnectors.errors.createFailed') + (status ? ` (${status})` : ""), true)
      } finally {
        this.creating = false
      }
    },

    // ─── Scope picker helpers ────────────────────────────────────────────

    isScopeSelected(scope) {
      return this.form.allowedScopes.includes(scope)
    },

    onScopeToggle(scope, checked) {
      const cur = this.form.allowedScopes
      if (checked) {
        if (!cur.includes(scope)) this.form.allowedScopes = cur.concat(scope)
      } else {
        this.form.allowedScopes = cur.filter(s => s !== scope)
      }
    },

    toggleGroup(group, select) {
      const inGroup = (this.info && this.info.scope_catalog || [])
        .filter(e => e.group === group)
        .map(e => e.scope)
      const cur = this.form.allowedScopes
      if (select) {
        const set = new Set(cur)
        inGroup.forEach(s => set.add(s))
        this.form.allowedScopes = Array.from(set)
      } else {
        const drop = new Set(inGroup)
        this.form.allowedScopes = cur.filter(s => !drop.has(s))
      }
    },

    selectAllScopes() {
      const catalog = (this.info && this.info.scope_catalog) || []
      this.form.allowedScopes = catalog.map(e => e.scope)
    },

    clearAllScopes() {
      this.form.allowedScopes = []
    },

    groupLabel(group) {
      const key = `views.mcpConnectors.scopes.groups.${group}`
      const translated = this.t(key)
      // vue-i18n returns the key itself when not found; fall back to the raw
      // group name capitalized so unknown groups still render readably.
      if (translated && translated !== key) return translated
      return group.charAt(0).toUpperCase() + group.slice(1)
    },

    async onRotate(clientId) {
      if (!this.user) return
      const ok = window.confirm(this.t('views.mcpConnectors.list.rotateConfirm'))
      if (!ok) return
      this.rotatingId = clientId
      this.message = undefined
      try {
        const r = await McpConnectorsApi.rotateSecret(this.user, clientId)
        this.reveal = {
          clientId: clientId,
          clientSecret: r.clientSecret
        }
      } catch (e) {
        const status = e && e.response && e.response.status
        this.setMessage("error", this.t('views.mcpConnectors.errors.rotateFailed') + (status ? ` (${status})` : ""), true)
      } finally {
        this.rotatingId = null
      }
    },

    dismissReveal() {
      this.reveal = null
      this.copied = { url: false, id: false, secret: false, infoUrl: false }
    },

    async copyValue(value, key) {
      if (!value) return
      try {
        await navigator.clipboard.writeText(value)
        this.copied[key] = true
        setTimeout(() => { this.copied[key] = false }, 2000)
      } catch {
        this.setMessage("warn", this.t('views.mcpConnectors.errors.clipboardFailed'))
      }
    },

    formatDate(epochMs) {
      if (!epochMs) return ""
      const d = new Date(typeof epochMs === "string" ? parseInt(epochMs, 10) : epochMs)
      if (isNaN(d.getTime())) return ""
      return d.toLocaleString()
    }
  },
  computed: {
    // Server-provided scope catalog, grouped by `group` field in a stable
    // order (insertion order from server). Each entry: { group, entries: [...] }
    groupedScopes() {
      const catalog = (this.info && this.info.scope_catalog) || []
      const seen = new Map()
      catalog.forEach(e => {
        if (!seen.has(e.group)) seen.set(e.group, [])
        seen.get(e.group).push(e)
      })
      return Array.from(seen.entries()).map(([group, entries]) => ({ group, entries }))
    }
  },
  watch: {
    user: {
      immediate: true,
      handler(u) {
        if (u && this.authIsReady) this.loadAll()
      }
    },
    authIsReady(ready) {
      if (ready && this.user) this.loadAll()
    }
  }
}
</script>

<style scoped>
.mcp-connectors-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto;
  padding: 0.5rem;
}

.info-card,
.create-card,
.list-card,
.reveal-card {
  padding: 1rem 1.25rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--surface-card);
}

.reveal-card {
  border-color: #16a34a;
  background: rgba(22, 163, 74, 0.06);
}

.reveal-title {
  margin-top: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #16a34a;
}

.reveal-warning {
  margin: 0.5rem 0 0.75rem;
  color: var(--text-color-secondary);
}

.reveal-grid {
  display: grid;
  grid-template-columns: minmax(120px, auto) 1fr auto;
  gap: 0.4rem 0.75rem;
  align-items: center;
  margin: 0.75rem 0;
}

.reveal-label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.reveal-value {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  padding: 0.3rem 0.5rem;
  background: var(--surface-section);
  border-radius: 4px;
  overflow-wrap: anywhere;
}

.reveal-secret {
  letter-spacing: 0.02em;
}

.reveal-howto {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
  margin: 0.75rem 0 0;
}

.reveal-actions {
  margin-top: 0.75rem;
  display: flex;
  justify-content: flex-end;
}

.info-title {
  margin-top: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-row {
  display: grid;
  grid-template-columns: minmax(120px, auto) 1fr auto;
  gap: 0.4rem 0.75rem;
  align-items: center;
  margin: 0.75rem 0;
}

.info-label {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.info-value {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  padding: 0.3rem 0.5rem;
  background: var(--surface-section);
  border-radius: 4px;
  overflow-wrap: anywhere;
}

.info-instructions {
  margin: 0.5rem 0;
}

.info-advanced summary {
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-color-secondary);
  margin-top: 0.5rem;
}

.info-meta {
  list-style: none;
  padding-left: 0;
  font-size: 0.85rem;
}

.info-meta li {
  margin-bottom: 0.3rem;
}

.info-meta code {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  padding: 0.1rem 0.3rem;
  background: var(--surface-section);
  border-radius: 3px;
}

.create-card h3,
.list-card h3 {
  margin-top: 0;
}

.muted {
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.75rem;
}

.form-row label {
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
  color: var(--text-color-secondary);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.connector-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.connector-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--surface-border);
}

.connector-row:last-child {
  border-bottom: none;
}

.connector-meta {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.connector-id {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.connector-date {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.connector-actions {
  flex-shrink: 0;
}

.connector-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.connector-scopes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
  margin-top: 0.25rem;
}

.connector-scopes-label {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.scope-tag {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  background: var(--surface-section);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
}

.scopes-section {
  margin: 1rem 0 0.75rem;
  padding: 0.75rem 0.9rem;
  background: var(--surface-section);
  border-radius: 6px;
  border: 1px solid var(--surface-border);
}

.scopes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.scopes-header h4 {
  margin: 0;
  font-size: 0.95rem;
}

.scopes-bulk,
.scope-group-bulk {
  display: flex;
  gap: 0.25rem;
}

.scopes-help {
  margin: 0.25rem 0 0.75rem;
}

.scope-group {
  border-top: 1px solid var(--surface-border);
  padding-top: 0.5rem;
  margin-top: 0.5rem;
}

.scope-group:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

.scope-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.scope-group-name {
  font-weight: 600;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-color-secondary);
}

.scope-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
}

.scope-row {
  padding: 0.3rem 0;
}

.scope-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 0.6rem;
  align-items: start;
  cursor: pointer;
}

.scope-item input[type="checkbox"] {
  margin-top: 0.25rem;
}

.scope-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.scope-name {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.8rem;
  color: var(--text-color);
}

.scope-label {
  font-size: 0.9rem;
}

.scope-description {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.scope-sensitive {
  display: inline-block;
  width: fit-content;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.05rem 0.35rem;
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
  border-radius: 3px;
}

.footer_buttonbar {
  display: flex;
  justify-content: flex-start;
  padding: 0.5rem;
}
</style>
