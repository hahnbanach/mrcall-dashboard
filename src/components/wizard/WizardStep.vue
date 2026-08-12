<template>
  <div class="wizard-step">
    <!-- Analyzing phase: streaming summary from agent -->
    <div v-if="phase === 'analyzing'" class="wizard-analyzing">
      <div class="analyzing-indicator">
        <i class="pi pi-spin pi-spinner"></i>
        <span>{{ loadingText }}</span>
      </div>
      <!-- Liveness line: swapped for real text as soon as the model streams -->
      <div v-if="!streamedSummary && progressText" class="wizard-progress-line">
        <i class="pi pi-spin pi-spinner"></i>
        <span>{{ progressText }}</span>
      </div>
      <div v-if="streamedSummary" class="wizard-summary-preview" v-html="formatMessage(streamedSummary)"></div>
    </div>

    <!-- Summary phase: frozen-chat UI -->
    <div v-if="phase === 'summary'" class="wizard-summary-phase">
      <!-- Frozen text box: shows latest agent response, updates in-place -->
      <div class="wizard-summary-box" :class="{ 'summary-updating': isModifying }" v-html="formatMessage(streamedSummary)"></div>
      <!-- Liveness line shown while user sent an instruction and the agent is thinking / tool-calling -->
      <div v-if="isModifying && progressText && !streamedSummary" class="wizard-progress-line">
        <i class="pi pi-spin pi-spinner"></i>
        <span>{{ progressText }}</span>
      </div>

      <!-- Special content slot (ConnectCalendar, info panels, etc.) -->
      <slot name="special-content"></slot>

      <!-- Modification area (hidden for read-only steps) -->
      <div v-if="!readOnly" class="wizard-modify-section">
        <!-- Input area: always visible -->
        <div class="modify-input-area">
          <textarea
            ref="modifyInput"
            v-model="userInstruction"
            :placeholder="$t('views.wizard.inputPlaceholder')"
            class="wizard-textarea"
            rows="2"
            :disabled="isModifying"
            @keydown="handleKeydown"
          ></textarea>
          <Button
            :label="$t('views.wizard.sendInstructions')"
            icon="pi pi-send"
            class="p-button-outlined wizard-send-btn"
            :disabled="!userInstruction.trim() || isModifying"
            @click="sendInstruction"
          />
        </div>

        <!-- Pending changes diff: admin-only debugging view (shows raw variable names) -->
        <transition name="fade">
          <div v-if="hasModified && isAdmin" class="wizard-pending-changes">
            <div class="pending-changes-title">
              <i class="pi pi-pencil"></i>
              {{ $t('views.wizard.pendingChangesTitle') }} ({{ pendingChanges.length }})
            </div>
            <ul class="pending-changes-list">
              <li v-for="c in pendingChanges" :key="c.variable_name">
                <span class="pc-var">{{ c.variable_name }}</span>
                <span class="pc-arrow">→</span>
                <span class="pc-value">{{ formatValue(c.new_value) }}</span>
              </li>
            </ul>
          </div>
        </transition>

        <!-- Accept: appears once there are staged changes -->
        <transition name="fade">
          <div v-if="hasModified" class="wizard-action-bar">
            <Button
              :label="isSaving ? $t('views.wizard.saving') : $t('views.wizard.accept') + ` (${pendingChanges.length})`"
              icon="pi pi-check"
              class="attention-pulse wizard-accept-btn"
              :loading="isSaving"
              :disabled="isModifying"
              @click="acceptChanges"
            />
          </div>
        </transition>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="phase === 'error'" class="wizard-error">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ $t('views.wizard.analyzeError') }}</span>
      <Button :label="$t('common.retry') || 'Retry'" icon="pi pi-refresh" class="p-button-text" @click="startAnalysis" />
    </div>

    <!-- Navigation buttons -->
    <div class="wizard-nav">
      <div class="wizard-nav-separator">
        <span>{{ $t('views.wizard.orSeparator') }}</span>
      </div>
      <Button
        :label="isLastStep ? $t('views.wizard.goToDashboard') : $t('views.wizard.skipStep')"
        :icon="isLastStep ? 'pi pi-home' : 'pi pi-arrow-right'"
        iconPos="right"
        class="p-button-text wizard-skip-btn"
        :disabled="phase === 'analyzing'"
        @click="$emit('skip')"
      />
    </div>
  </div>
</template>

<script>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue';
import { useStore } from 'vuex';
import Button from 'primevue/button';
import ZylchAPI from '@/utils/Zylch.js';

export default {
  name: 'WizardStep',
  components: { Button },
  props: {
    stepKey: { type: String, required: true },
    analyzePrompt: { type: String, required: true },
    loadingText: { type: String, required: true },
    businessId: { type: String, required: true },
    sessionId: { type: String, required: true },
    readOnly: { type: Boolean, default: false },
    isLastStep: { type: Boolean, default: false },
  },
  emits: ['skip', 'pending-changes'],
  setup(props, { emit }) {
    const store = useStore();
    const user = computed(() => store.state.user);
    const isAdmin = computed(() => store.state.role === 'admin');

    const phase = ref('analyzing'); // analyzing | summary | error
    const streamedSummary = ref('');
    const userInstruction = ref('');
    const isModifying = ref(false);
    const pendingChanges = ref([]);
    const isSaving = ref(false);
    const modifyInput = ref(null);
    // Progress line: shown between "user sent a message" and "first text_delta".
    // Driven by backend SSE events of type=progress (phase: thinking|tool:X|heartbeat).
    const progressText = ref('');
    let abortFn = null;

    // hasModified derives from actual staged changes — not from "user sent a message"
    const hasModified = computed(() => pendingChanges.value.length > 0);

    const abortCurrentStream = () => {
      if (abortFn) {
        try { abortFn(); } catch (_) { /* noop */ }
        abortFn = null;
      }
    };

    const sendAgentMessage = (prompt, callbacks) => {
      const message = `/agent mrcall run "${prompt}"`;
      return ZylchAPI.sendMessageStream(user.value, message, callbacks, props.sessionId);
    };

    const startAnalysis = () => {
      abortCurrentStream();
      phase.value = 'analyzing';
      streamedSummary.value = '';
      progressText.value = '';
      pendingChanges.value = [];

      abortFn = sendAgentMessage(props.analyzePrompt, {
        onProgress: (phaseName, text) => {
          progressText.value = text;
        },
        onTextDelta: (text) => {
          progressText.value = '';
          streamedSummary.value += text;
        },
        onTextReplace: (text) => {
          progressText.value = '';
          streamedSummary.value = text;
        },
        onError: (msg) => {
          console.error('[WizardStep] Analysis error:', msg);
          progressText.value = '';
          phase.value = 'error';
          abortFn = null;
        },
        onDone: () => {
          progressText.value = '';
          phase.value = 'summary';
          abortFn = null;
        },
      });
    };

    const sendInstruction = () => {
      const instruction = userInstruction.value.trim();
      if (!instruction || isModifying.value || isSaving.value) return;

      // Guard against overlapping streams
      abortCurrentStream();

      isModifying.value = true;
      streamedSummary.value = '';
      progressText.value = '';
      userInstruction.value = '';

      abortFn = sendAgentMessage(instruction, {
        onProgress: (phaseName, text) => {
          progressText.value = text;
        },
        onTextDelta: (text) => {
          progressText.value = '';
          streamedSummary.value += text;
        },
        onTextReplace: (text) => {
          progressText.value = '';
          streamedSummary.value = text;
        },
        onMetadata: (metadata) => {
          if (metadata.pending_changes) {
            for (const change of metadata.pending_changes) {
              const idx = pendingChanges.value.findIndex(
                c => c.variable_name === change.variable_name
              );
              if (idx >= 0) {
                pendingChanges.value[idx] = change;
              } else {
                pendingChanges.value.push(change);
              }
            }
            emit('pending-changes', pendingChanges.value);
          }
        },
        onError: (msg) => {
          console.error('[WizardStep] Modification error:', msg);
          progressText.value = '';
          isModifying.value = false;
          abortFn = null;
        },
        onDone: () => {
          progressText.value = '';
          isModifying.value = false;
          abortFn = null;
          nextTick(() => {
            modifyInput.value?.focus();
          });
        },
      });
    };

    const handleKeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendInstruction();
      }
    };

    const acceptChanges = async () => {
      if (isSaving.value || isModifying.value) return;

      if (pendingChanges.value.length > 0) {
        isSaving.value = true;
        try {
          const result = await ZylchAPI.applyChanges(
            user.value,
            props.businessId,
            pendingChanges.value.map(c => ({
              variable_name: c.variable_name,
              new_value: c.new_value,
            }))
          );
          if (!result.success) {
            console.error('[WizardStep] Save failed:', result);
            isSaving.value = false;
            return;
          }
          pendingChanges.value = [];
        } catch (err) {
          console.error('[WizardStep] Save error:', err);
          isSaving.value = false;
          return;
        }
        isSaving.value = false;
      }

      emit('skip');
    };

    const formatValue = (v) => {
      if (v === null || v === undefined) return '—';
      if (typeof v === 'string') return v;
      try {
        return JSON.stringify(v, null, 2);
      } catch (_) {
        return String(v);
      }
    };

    const escapeHtml = (str) => {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const formatMessage = (content) => {
      if (!content) return '';
      const codeBlocks = [];
      let formatted = content.replace(/`([^`]+)`/g, (match, code) => {
        codeBlocks.push(escapeHtml(code));
        return `CODEBLOCK_${codeBlocks.length - 1}_ENDBLOCK`;
      });
      formatted = escapeHtml(formatted);
      formatted = formatted.replace(/\n/g, '<br>');
      formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
      formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      formatted = formatted.replace(/CODEBLOCK_(\d+)_ENDBLOCK/g, (match, index) => {
        return `<code>${codeBlocks[parseInt(index)]}</code>`;
      });
      formatted = formatted.replace(/✅/g, '<span class="success-icon">✅</span>');
      formatted = formatted.replace(/❌/g, '<span class="error-icon">❌</span>');
      return formatted;
    };

    onMounted(() => {
      startAnalysis();
    });

    onBeforeUnmount(() => {
      abortCurrentStream();
    });

    watch(() => props.stepKey, () => {
      abortCurrentStream();
      isModifying.value = false;
      pendingChanges.value = [];
      userInstruction.value = '';
      startAnalysis();
    });

    return {
      phase,
      streamedSummary,
      userInstruction,
      isModifying,
      hasModified,
      pendingChanges,
      isSaving,
      modifyInput,
      progressText,
      startAnalysis,
      sendInstruction,
      handleKeydown,
      acceptChanges,
      formatMessage,
      formatValue,
      isAdmin,
    };
  },
};
</script>

<style scoped lang="less">
@import '../../assets/style/colors';

.wizard-step {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.wizard-analyzing {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.analyzing-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: @mrcall_light_grey_2;
  border-radius: 8px;
  border-left: 3px solid @mrcall_orange;
  font-style: italic;
  color: @mrcall_grey_text;
}

// Liveness line shown between "user sent" and "first text_delta".
// Minimal — the intent is "something is happening", not a full message.
.wizard-progress-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-top: 0.5rem;
  font-size: 0.9em;
  font-style: italic;
  color: @mrcall_grey_text;
  opacity: 0.85;

  i.pi-spinner {
    font-size: 0.85em;
  }
}

.wizard-summary-preview,
.wizard-summary-box {
  background: @mrcall_bluette;
  padding: 1.25rem 1.25rem 1.25rem 1.5rem;
  border-radius: 8px;
  line-height: 1.6;
  color: @mrcall_dark_grey_text;
  border-left: 4px solid @mrcall_blue;
}

.wizard-modify-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modify-prompt {
  font-weight: 600;
  font-size: 1rem;
  margin: 0;
  color: var(--text-color);
}

.modify-hint {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
  margin: 0;
}

.modify-input-area {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.wizard-textarea {
  resize: vertical;
  border: 2px solid @mrcall_light_grey_1;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.5;
  background: @mrcall_white;
  color: @mrcall_dark_grey_text;
  outline: none;
  min-height: 72px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.wizard-textarea::placeholder {
  color: @mrcall_grey_text2;
}

.wizard-textarea:hover {
  border-color: @mrcall_blue_highlight;
}

.wizard-textarea:focus {
  border-color: @mrcall_blue;
  box-shadow: 0 0 0 3px fade(@mrcall_blue, 15%);
}

.wizard-textarea:disabled {
  background: @mrcall_light_grey_2;
  color: @mrcall_grey_text;
  cursor: not-allowed;
}

.wizard-send-btn {
  align-self: flex-start;
}

.summary-updating {
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.wizard-action-bar {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.wizard-accept-btn {
  min-width: 180px;
  font-weight: 600;
}

.wizard-pending-changes {
  background: @mrcall_light_grey_2;
  border: 1px solid @mrcall_borders;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.pending-changes-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: @mrcall_dark_grey_text;
  margin-bottom: 0.5rem;
}

.pending-changes-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pending-changes-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.875rem;
  min-width: 0;
}

.pc-var {
  font-family: monospace;
  color: var(--text-color-secondary);
  word-break: break-all;
  flex-shrink: 0;
}

.pc-arrow {
  color: var(--primary-color);
  flex-shrink: 0;
}

.pc-value {
  color: var(--text-color);
  font-weight: 500;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  flex: 1 1 100%;
  min-width: 0;
}

@media screen and (max-width: 480px) {
  .pending-changes-list li {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }
  .pc-arrow { display: none; }
  .pc-value { padding-left: 0.5rem; }
}

.wizard-error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--red-100);
  color: var(--red-900);
  border-radius: 8px;
}

.wizard-error i {
  font-size: 1.5rem;
}

.wizard-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.wizard-nav-separator {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 1rem;
  color: var(--text-color-secondary);
  font-size: 0.85rem;
}

.wizard-nav-separator::before,
.wizard-nav-separator::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--surface-border);
}

.wizard-skip-btn {
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.success-icon {
  color: var(--green-500);
}
.error-icon {
  color: var(--red-500);
}
</style>
