<template>
  <div class="configure-ai-panel">
    <div class="chat-wrapper">
      <ZylchChat
          ref="chatComponent"
          :initialSessionId="configSessionId"
          :messageTransformer="agentMessageTransformer"
          :disabled="isLoading"
          @pending-changes="onPendingChanges"
      />
    </div>

    <div class="quick-actions-row">
      <Button
          :label="$t('views.configureAI.quickActions')"
          icon="pi pi-bolt"
          class="p-button-outlined p-button-sm"
          :disabled="!agentReady"
          aria-haspopup="true"
          aria-controls="quick-actions-menu"
          @click="toggleQuickMenu"
      />
      <Menu
          id="quick-actions-menu"
          ref="quickMenu"
          :model="quickMenuItems"
          :popup="true"
      />
    </div>

    <transition name="fade">
      <div v-if="hasPendingChanges" class="pending-changes-bar">
        <Button
            :label="`Save changes (${pendingChanges.length})`"
            icon="pi pi-check"
            class="p-button-success save-button"
            :loading="isSaving"
            @click="saveChanges"
        />
        <Button
            label="Discard"
            icon="pi pi-times"
            class="p-button-text p-button-danger discard-button"
            :disabled="isSaving"
            @click="discardChanges"
        />
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import ZylchChat from '@/components/ZylchChat.vue';
import zylchUtils from '@/utils/Zylch';

const QUICK_ACTION_ICONS = [
  "pi pi-megaphone",
  "pi pi-pencil",
  "pi pi-sitemap",
  "pi pi-cog",
  "pi pi-book",
  "pi pi-plus",
];

export default {
  name: 'ConfigureAIPanel',
  components: { Button, ZylchChat },
  props: {
    businessId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const store = useStore();
    const { t } = useI18n();
    const user = computed(() => store.state.user);

    const chatComponent = ref(null);
    const agentReady = ref(false);
    const isLoading = ref(false);

    const pendingChanges = ref([]);
    const isSaving = ref(false);
    const hasPendingChanges = computed(() => pendingChanges.value.length > 0);

    // Scoped per (owner, business). `session_id` is the primary key of
    // mrcall_chat_sessions, so an id keyed on the business alone let the first
    // owner who opened the chat keep the row: every other owner with write
    // access to the same assistant read back an empty history and wrote into
    // throwaway sessions nobody ever read. Each owner gets their own thread.
    const configSessionId = computed(() =>
        props.businessId && user.value?.uid
            ? `mrcall_config_${user.value.uid}_${props.businessId}`
            : null
    );

    const agentMessageTransformer = computed(() =>
        agentReady.value ? (text) => `/agent mrcall run "${text}"` : null
    );

    const quickActions = computed(() =>
        QUICK_ACTION_ICONS.map((icon, i) => ({
          label: t(`views.configureAI.quickAction${i + 1}Label`),
          command: t(`views.configureAI.quickAction${i + 1}Command`),
          icon,
        }))
    );

    const quickMenu = ref(null);
    const toggleQuickMenu = (event) => {
      quickMenu.value?.toggle(event);
    };

    const sendQuickAction = (command) => {
      if (!chatComponent.value || !agentReady.value) return;
      chatComponent.value.currentMessage = command;
      const inputEl = chatComponent.value.$el?.querySelector('.message-input');
      if (inputEl) inputEl.focus();
    };

    const quickMenuItems = computed(() =>
        quickActions.value.map(a => ({
          label: a.label,
          icon: a.icon,
          disabled: !agentReady.value,
          command: () => sendQuickAction(a.command),
        }))
    );

    const onPendingChanges = (newChanges) => {
      for (const change of newChanges) {
        const idx = pendingChanges.value.findIndex(
            c => c.variable_name === change.variable_name
        );
        if (idx >= 0) {
          pendingChanges.value[idx] = change;
        } else {
          pendingChanges.value.push(change);
        }
      }
    };

    const saveChanges = async () => {
      if (!hasPendingChanges.value || isSaving.value) return;
      isSaving.value = true;
      try {
        // Pass session_id so the backend clears mrcall_chat_sessions.pending_changes
        // on success — otherwise the Save bar would reappear after a remount
        // even though the changes are already live in StarChat.
        const result = await zylchUtils.applyChanges(
            user.value,
            props.businessId,
            pendingChanges.value.map(c => ({
              variable_name: c.variable_name,
              new_value: c.new_value,
            })),
            configSessionId.value,
        );
        if (result.success) {
          pendingChanges.value = [];
          if (chatComponent.value?.addSystemMessage) {
            const msgId = chatComponent.value.addSystemMessage(`✅ ${result.applied} change(s) saved.`);
            setTimeout(() => chatComponent.value?.removeSystemMessage(msgId), 5000);
          }
        } else {
          const errMsg = result.errors?.join(', ') || 'Unknown error';
          if (chatComponent.value?.addSystemMessage) {
            chatComponent.value.addSystemMessage(`⚠️ Save failed: ${errMsg}`);
          }
        }
      } catch (err) {
        console.error('Failed to save changes:', err);
        if (chatComponent.value?.addSystemMessage) {
          chatComponent.value.addSystemMessage('⚠️ Failed to save changes. Please try again.');
        }
      } finally {
        isSaving.value = false;
      }
    };

    const discardChanges = () => {
      pendingChanges.value = [];
    };

    onMounted(async () => {
      if (!props.businessId || !chatComponent.value) return;
      await nextTick();
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!chatComponent.value) return;

      isLoading.value = true;
      try {
        await chatComponent.value.sendSilent(`/mrcall open ${props.businessId}`, { hideResponse: true });
        agentReady.value = true;
      } catch (err) {
        console.error('Failed to open mrcall config mode:', err);
      } finally {
        isLoading.value = false;
        if (chatComponent.value) chatComponent.value.currentMessage = '';
      }
    });

    return {
      chatComponent,
      agentReady,
      isLoading,
      configSessionId,
      agentMessageTransformer,
      quickActions,
      quickMenu,
      quickMenuItems,
      toggleQuickMenu,
      sendQuickAction,
      pendingChanges,
      isSaving,
      hasPendingChanges,
      onPendingChanges,
      saveChanges,
      discardChanges,
    };
  },
};
</script>

<style scoped lang="less">
.configure-ai-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.5rem;

  :deep(.session-info) {
    display: none;
  }

  :deep(.zylch-chat-container) {
    height: auto;
    max-height: none;
    flex: 1 1 auto;
    min-height: 0;
    box-shadow: none;
    border-radius: 0;
    margin: 0;
  }

  :deep(.chat-messages) {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  // Move the attachment button to the left of the textarea
  :deep(.input-actions) {
    display: contents;
  }
  :deep(.attach-button) {
    order: -1;
    align-self: center;
  }
  :deep(.send-button) {
    align-self: center;
  }
}

.chat-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.quick-actions-row,
.pending-changes-bar {
  flex-shrink: 0;
}

.quick-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pending-changes-bar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
