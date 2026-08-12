<template>
  <BusinessFrame>
    <template #spinner>
      <ProgressBar v-show="loading" mode="indeterminate" style="height: 0.3em; border-radius: 0;" />
    </template>
    <template #messages>
      <Message v-if="message" :severity="message.severity" :sticky="message.sticky" :life="message.life"
               :key="message.id">{{ message.content }}</Message>
    </template>
    <template #beforetitle>
      <Button
        :label="t('views.aladminConfigurator.backToSettings')"
        icon="pi pi-arrow-left"
        text size="small"
        class="mb-2"
        @click="goBack()"
      />
    </template>
    <template #title>
      {{ t('views.aladminConfigurator.title') }}
    </template>
    <template #subtitle>
      {{ t('views.aladminConfigurator.subtitle') }}
    </template>
    <template #content>
      <div class="aladmin-configurator-content">
        <AiConfigureChanges
          :messages="messages"
          :loading="loading"
          @quick-reply="quickReply"
        />
        <AiConfigureForm
          :loading="loading"
          :disabled="!businessId"
          :hasMessages="messages.length > 0"
          @submit="onSubmit"
        />
      </div>
    </template>
    <template #footer>
      <div class="footer_buttonbar">
        <Button
          v-if="messages.length > 0"
          :label="t('views.aladminConfigurator.newConversation')"
          icon="pi pi-refresh"
          text size="small"
          :disabled="loading"
          @click="resetConversation()"
        />
        <div style="margin-left: auto">
          <Button
            :label="t('views.aladminConfigurator.backToSettings')"
            icon="pi pi-arrow-left"
            outlined
            @click="goBack()"
          />
        </div>
      </div>
    </template>
  </BusinessFrame>
</template>

<script>
import BusinessFrame from "@/components/templates/business/BusinessFrame"
import AiConfigureForm from "@/components/ai-configure/AiConfigureForm.vue"
import AiConfigureChanges from "@/components/ai-configure/AiConfigureChanges.vue"
import { computed } from "vue"
import { useStore } from "vuex"
import { useI18n } from "vue-i18n"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/firebase/config"
import AiConfigureApi from "@/utils/AiConfigure"
import router from "@/router"

export default {
  components: { BusinessFrame, AiConfigureForm, AiConfigureChanges },
  name: "AladminConfigurator",
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
      businessId: null,
      loading: false,
      message: undefined,
      messages: [],
      sessionId: crypto.randomUUID(),
      abortController: null,
    }
  },
  methods: {
    goBack() {
      if (this.businessId) {
        this.$router.push({
          name: 'BusinessConfiguration',
          query: { id: this.businessId }
        })
      } else {
        this.$router.push({ name: 'Businesses' })
      }
    },
    setMessage(severity, content, sticky = true, life = 0) {
      this.message = {
        id: Date.now(),
        severity,
        content,
        sticky,
        life
      }
    },
    resetConversation() {
      if (this.abortController) {
        this.abortController.abort()
        this.abortController = null
      }
      this.messages = []
      this.sessionId = crypto.randomUUID()
      this.message = undefined
      this.loading = false
    },
    async quickReply(text) {
      await this.onSubmit(text)
    },
    async onSubmit(userMessage) {
      this.loading = true
      this.message = undefined

      this.messages.push({ role: 'user', text: userMessage })

      const ac = new AbortController()
      this.abortController = ac

      try {
        const requestBody = {
          template: '_aladmin-configurator',
          userMessage,
          sessionId: this.sessionId,
          businessId: this.businessId
        }
        const response = await AiConfigureApi.agentRunWs(this.user, requestBody, {
          signal: ac.signal
        })
        this.messages.push({
          role: 'assistant',
          text: response.content,
          meta: {
            totalToolCalls: response.totalToolCalls,
            toolCallsMade: response.toolCallsMade || [],
            elapsedMs: response.elapsedMs
          }
        })
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('AladminConfigurator error:', error)
        const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message
        this.setMessage('error', this.t('views.aladminConfigurator.errorApplying') + ' (' + errorMsg + ')')
        this.messages.pop()
        if (error.response?.status === 401) {
          this.store.dispatch('logout')
          router.replace('/login')
        }
      } finally {
        this.abortController = null
        this.loading = false
      }
    },
    initializePage() {
      this.businessId = this.$route.query?.id || null
      if (!this.businessId) {
        this.setMessage('warn', this.t('views.aladminConfigurator.noBusinessSelected'))
      }
    }
  },
  beforeUnmount() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  },
  mounted() {
    if (!this.store.state.user) {
      onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified && !user.isAnonymous) {
          this.initializePage()
        }
      })
    } else {
      this.initializePage()
    }
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';

.aladmin-configurator-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.footer_buttonbar {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
}
</style>
