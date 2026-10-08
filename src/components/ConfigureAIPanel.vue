<template>
  <div class="configure-ai-panel">
    <div class="chat-wrapper">
      <ZylchChat
          ref="chatComponent"
          :initialSessionId="configSessionId"
          :messageTransformer="agentMessageTransformer"
          :disabled="isLoading || isSaving || recoveryRequired"
          @pending-changes="onPendingChanges"
          @processing="chatProcessing = $event"
          @history-state="onHistoryState"
      />
    </div>

    <div class="quick-actions-row">
      <Button
          :label="$t('views.configureAI.quickActions')"
          icon="pi pi-bolt"
          class="p-button-outlined p-button-sm"
          :disabled="!agentReady || isSaving || recoveryRequired"
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

    <div v-if="actionMessage" class="action-message" role="status">{{ actionMessage }}</div>
    <div v-if="handoffTargets.length" class="reconciliation-actions">
      <Button v-for="target in handoffTargets" :key="target.phase + target.instanceId"
              :label="$t('widgets.agentSkills.handoff.manage', { instance: target.instanceId })"
              :disabled="actionsDisabled || recoveryRequired" @click="emitSkillTarget(target)" />
    </div>
    <div v-if="outcomes.length" class="operation-outcomes">
      <div v-for="outcome in outcomes" :key="outcome.operation_id" :data-outcome="outcome.status">
        {{ outcome.operation_id }}: {{ statusLabel(outcome.status) }}
        <span v-if="outcome.code"> · {{ outcome.code }}</span>
        <div v-for="(diagnostic, index) in outcome.diagnostics || []" :key="index">{{ diagnostic.code }} {{ diagnostic.path }}</div>
      </div>
    </div>
    <div v-if="hasPendingChanges" class="pending-preview" data-testid="pending-preview">
      <article v-for="change in pendingChanges" :key="change.operation_id || change.variable_name"
               class="pending-item" :data-operation-id="change.operation_id">
        <template v-if="change.kind === 'skill_instance'">
          <strong>{{ localized(change.preview?.skill_label) || change.skill }}</strong>
          <p>{{ $t(`views.configureAI.pending.${change.action}`) }} · {{ $t(`views.configureAI.pending.${change.phase}`) }}</p>
          <p>{{ change.instance_id || $t('views.configureAI.pending.draft') }}</p>
          <p v-if="change.execution_state !== 'pending'">{{ statusLabel(change.execution_state) }}</p>
          <p v-if="change.last_outcome">{{ statusLabel(change.last_outcome.status) }} · {{ change.last_outcome.code }}</p>
          <p v-if="change.connection_status">{{ $t('views.configureAI.pending.connectionCheck') }}</p>
          <div v-for="field in changedFields(change)" :key="field" class="field-preview">
            <strong>{{ localized(change.preview?.field_labels?.[field]) || field }}</strong>
            <div>{{ $t('views.configureAI.pending.before') }}: <pre>{{ displayValue(change.preview?.before?.[field]) }}</pre></div>
            <div>{{ $t('views.configureAI.pending.after') }}: <pre>{{ displayValue(change.preview?.after?.[field]) }}</pre></div>
          </div>
          <div class="reconciliation-actions">
            <Button v-if="change.instance_id && change.action !== 'remove'"
                    :label="$t('widgets.agentSkills.handoff.manage', { instance: change.instance_id })"
                    :disabled="actionsDisabled || recoveryRequired"
                    @click="emitSkillTarget({ phase: change.phase, instanceId: change.instance_id })" />
            <Button v-if="change.reconciliation_actions?.includes('read')"
                    :label="$t('views.configureAI.pending.read')" :disabled="actionsDisabled || recoveryRequired"
                    @click="reconcile(change)" />
            <template v-if="readOperations.has(change.operation_id)">
              <Button v-for="candidate in change.reconciliation_actions?.includes('accept_instance') ? change.candidate_ids : []"
                      :key="candidate" :label="$t('views.configureAI.pending.accept', { instance: candidate })"
                      :disabled="actionsDisabled || recoveryRequired" @click="reconcile(change, 'accept_instance', candidate)" />
              <Button v-if="change.reconciliation_actions?.includes('close_without_retry')"
                      :label="$t('views.configureAI.pending.close')" :disabled="actionsDisabled || recoveryRequired"
                      @click="reconcile(change, 'close_without_retry')" />
            </template>
          </div>
        </template>
        <template v-else>
          <strong>{{ change.variable_name }}</strong>
          <div>{{ $t('views.configureAI.pending.before') }}: <pre>{{ displayValue(change.old_value) }}</pre></div>
          <div>{{ $t('views.configureAI.pending.after') }}: <pre>{{ displayValue(change.new_value) }}</pre></div>
        </template>
      </article>
    </div>
    <div class="pending-changes-bar" v-if="hasPendingChanges || recoveryRequired">
      <Button v-if="hasPendingChanges" :label="$t('views.configureAI.pending.save', { count: saveableChanges.length })"
              icon="pi pi-check" class="p-button-success save-button" :loading="isSaving"
              :disabled="actionsDisabled || !saveableChanges.length || recoveryRequired" @click="saveChanges" />
      <Button v-if="hasPendingChanges" :label="$t('views.configureAI.pending.discard')" icon="pi pi-times"
              class="p-button-text p-button-danger discard-button" :disabled="actionsDisabled || recoveryRequired"
              @click="discardChanges" />
      <Button :label="$t('views.configureAI.pending.refresh')" icon="pi pi-refresh"
              :disabled="actionsDisabled" :loading="historyState === 'loading'" @click="refreshPending" />
    </div>
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
  emits: ['open-skill'],
  props: {
    businessId: {
      type: String,
      required: true,
    },
  },
  setup(props, { emit }) {
    const store = useStore();
    const { t, locale } = useI18n();
    const user = computed(() => store.state.user);

    const chatComponent = ref(null);
    const agentReady = ref(false);
    const isLoading = ref(true);

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

    const chatProcessing = ref(false);
    const recoveryRequired = ref(true);
    const historyState = ref('loading');
    const actionMessage = ref('');
    const outcomes = ref([]);
    const handoffTargets = ref([]);
    const emitSkillTarget = target => emit('open-skill', target);
    const readOperations = ref(new Set());
    const actionsDisabled = computed(() => isLoading.value || isSaving.value || chatProcessing.value || historyState.value === 'loading');
    const saveableChanges = computed(() => pendingChanges.value.filter(c =>
      c.kind !== 'skill_instance' || !c.execution_state || c.execution_state === 'pending'
    ));
    const localized = value => {
      if (typeof value === 'string') return value;
      const label = value?.[locale.value] || value?.[locale.value.split('-')[0]] || value?.['*'] || value?.['en-US'] || value?.en || value;
      return typeof label === 'string' ? label : typeof label?.label === 'string' ? label.label : '';
    };
    const displayValue = value => value === undefined || value === null ? '—' :
      typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    const changedFields = change => [...new Set([
      ...Object.keys(change.preview?.before || {}), ...Object.keys(change.preview?.after || {}),
    ])].filter(key => JSON.stringify(change.preview?.before?.[key]) !== JSON.stringify(change.preview?.after?.[key]));
    const statusLabel = status => t(`views.configureAI.pending.${
      ['saved', 'closed', 'conflict', 'refused', 'unconfirmed', 'in_flight', 'reconciling', 'pending'].includes(status)
        ? status : 'unconfirmed'
    }`);
    const onPendingChanges = changes => {
      pendingChanges.value = Array.isArray(changes) ? changes : [];
      readOperations.value.clear();
    };
    const ordinaryValues = changes => changes.filter(c => c.kind !== 'skill_instance').map(c => ({
      variable_name: c.variable_name, new_value: c.new_value,
    }));
    const operationIds = changes => changes.filter(c => c.kind === 'skill_instance').map(c => c.operation_id);
    const onHistoryState = state => {
      historyState.value = state;
      recoveryRequired.value = state !== 'ready';
      if (state === 'ready') {
        if ([t('views.configureAI.pending.loadingPending'), t('views.configureAI.pending.recoveryFailed')].includes(actionMessage.value)) {
          actionMessage.value = '';
        }
      } else if (!actionMessage.value || actionMessage.value === t('views.configureAI.pending.loadingPending')) {
        actionMessage.value = t(state === 'loading' ? 'views.configureAI.pending.loadingPending' : 'views.configureAI.pending.recoveryFailed');
      }
    };
    const reloadPending = async () => {
      if (!await chatComponent.value?.loadHistory()) throw new Error('pending_history_unavailable');
    };
    const refreshPending = async () => {
      if (actionsDisabled.value) return;
      isSaving.value = true;
      try {
        await reloadPending();
        actionMessage.value = t('views.configureAI.pending.refreshed');
      } catch {
        recoveryRequired.value = true;
        actionMessage.value = t('views.configureAI.pending.recoveryFailed');
      } finally {
        isSaving.value = false;
      }
    };
    const runAction = async action => {
      if (actionsDisabled.value || recoveryRequired.value) return;
      isSaving.value = true;
      outcomes.value = [];
      try {
        const result = await action();
        if (Array.isArray(result.remaining_pending)) onPendingChanges(result.remaining_pending);
        else await reloadPending();
        outcomes.value = result.skill_outcomes || (result.outcome ? [result.outcome] : []);
        actionMessage.value = t(result.success ? 'views.configureAI.pending.completed' : 'views.configureAI.pending.incomplete');
        return result;
      } catch (error) {
        actionMessage.value = t(error.response ? 'views.configureAI.pending.incomplete' : 'views.configureAI.pending.responseLost');
        try { await reloadPending(); }
        catch { recoveryRequired.value = true; }
      } finally {
        isSaving.value = false;
      }
    };
    const saveChanges = async () => {
      const selected = [...saveableChanges.value];
      const result = await runAction(() => zylchUtils.applyChanges(
        user.value, props.businessId, ordinaryValues(selected), configSessionId.value, operationIds(selected)
      ));
      if (result) handoffTargets.value = (result.skill_outcomes || []).filter(outcome => outcome.status === 'saved').flatMap(outcome => {
        const operation = selected.find(item => item.operation_id === outcome.operation_id);
        const instanceId = outcome.instance_id || operation?.instance_id;
        return operation && operation.action !== 'remove' && instanceId ? [{ phase: operation.phase, instanceId }] : [];
      });
    };
    const discardChanges = () => runAction(() => zylchUtils.discardPending(
      user.value, props.businessId, configSessionId.value, ordinaryValues(pendingChanges.value), operationIds(pendingChanges.value)
    ));
    const reconcile = async (change, resolution = null, instanceId = null) => {
      const result = await runAction(() => zylchUtils.reconcilePending(
        user.value, props.businessId, configSessionId.value, change.operation_id, resolution, instanceId
      ));
      if (!resolution && result) readOperations.value.add(change.operation_id);
      const confirmedId = result?.outcome?.instance_id || change.instance_id;
      if (result?.outcome?.status === 'saved' && change.action !== 'remove' && confirmedId) {
        handoffTargets.value = [{ phase: change.phase, instanceId: confirmedId }];
      }
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
      handoffTargets, emitSkillTarget, onHistoryState, historyState, chatProcessing, recoveryRequired, actionMessage, outcomes, readOperations, actionsDisabled, saveableChanges,
      localized, displayValue, changedFields, statusLabel, refreshPending, reconcile,
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
  flex-wrap: wrap;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.pending-preview {
  flex: 0 0 auto;
  max-height: 38vh;
  overflow: auto;
}
.pending-item { padding: 0.75rem; border: 1px solid var(--surface-border); border-radius: 6px; margin-bottom: 0.5rem; overflow-wrap: anywhere; }
.pending-item p { margin: 0.3rem 0; }
.pending-item pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0.25rem 0; font: inherit; }
.field-preview { margin-top: 0.5rem; }
.reconciliation-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.action-message, .operation-outcomes { flex-shrink: 0; overflow-wrap: anywhere; }

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
