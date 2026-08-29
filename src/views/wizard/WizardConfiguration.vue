<template>
  <div class="wizard-page">
    <div class="wizard-container">
      <!-- ASK phase: single question + [Parti] button -->
      <div v-if="phase === 'ask'" class="wizard-ask">
        <h2 class="wizard-title">{{ $t('views.wizard.autoConfigTitle') }}</h2>
        <p class="wizard-question">{{ $t('views.wizard.question') }}</p>
        <Button
          :label="$t('views.wizard.startButton')"
          icon="pi pi-play"
          class="wizard-start-btn"
          @click="startAutoConfig"
          :loading="isStarting"
        />
      </div>

      <!-- WORKING phase: spinner + status line from onProgress -->
      <div v-else-if="phase === 'working'" class="wizard-working">
        <ProgressSpinner
          style="width: 64px; height: 64px"
          strokeWidth="4"
          :pt="{
            spinner: { style: { animationDuration: '2s' } },
            circle: { style: { stroke: '#0068FF', strokeWidth: 3 } }
          }"
          fill="transparent"
          animationDuration="2.5s"
          aria-label="ProgressSpinner"
        />
        <p class="working-status">{{ progressStatus }}</p>
      </div>

      <!-- DONE phase: "Fatto." + WebcallButton ONLY -->
      <div v-else-if="phase === 'done'" class="wizard-done">
        <h2 class="done-title">{{ $t('views.wizard.doneTitle') }}</h2>
        <WebcallButton
          :businessId="businessId"
          :labelCall="$t('views.wizard.callButtonLabel')"
          :labelHangup="$t('views.wizard.hangupButtonLabel')"
          @call-ended="onCallEnded"
          @error="onCallError"
        />
        <div v-if="callErrorOccurred" class="call-error-recovery">
          <a href="#" class="continue-link" @click.prevent="onCallEnded">{{ $t('views.wizard.continueWithoutCall') }}</a>
        </div>
      </div>

      <!-- ERROR phase: short message + "Riprova" button -->
      <div v-else-if="phase === 'error'" class="wizard-error">
        <i class="pi pi-exclamation-triangle error-icon"></i>
        <p class="error-message">{{ errorMessage }}</p>
        <Button
          :label="$t('views.wizard.retryButton')"
          icon="pi pi-refresh"
          class="p-button-outlined"
          @click="startAutoConfig"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import WebcallButton from '@/components/webcall/WebcallButton.vue';
import businessUtils from '@/utils/Business';
import ZylchAPI from '@/utils/Zylch.js';

export default {
  name: 'WizardConfiguration',
  components: { Button, ProgressSpinner, WebcallButton },
  setup() {
    const store = useStore();
    const router = useRouter();
    const route = useRoute();
    const { t, tm } = useI18n();
    const user = computed(() => store.state.user);

    const phase = ref('ask');
    const businessId = ref(route.query.id || '');
    const wizardSessionId = computed(() =>
      businessId.value ? `mrcall_wizard_${businessId.value}` : null
    );
    const isStarting = ref(false);
    const progressStatus = ref('');
    const errorMessage = ref('');
    const callErrorOccurred = ref(false);
    const pendingChanges = ref([]);
    const finalResponseText = ref('');

    const buildPlanCatalogText = () => {
      const plans = tm('views.onboarding.chooseplan.plans');
      if (!plans || !Array.isArray(plans)) return '';
      return plans.map(p => {
        const price = p.pricing ? `${p.pricing.currency}${p.pricing.number}/${p.pricing.periodicity}` : '';
        const features = p.functionalities?.items?.map(f => f.value).join(', ') || '';
        return `${p.title} (${price}): ${features}`;
      }).join(' | ');
    };

    const extractPlanRecommendation = (text) => {
      const match = text.match(/<plan-recommendation\s+plan="(essential|starter|professional)"\s*>([\s\S]*?)<\/plan-recommendation>/i);
      if (match) {
        return { plan: match[1].toLowerCase(), why: match[2].trim() };
      }
      return null;
    };

    const startAutoConfig = async () => {
      if (!businessId.value) {
        router.push({ name: 'Businesses' });
        return;
      }

      isStarting.value = true;
      phase.value = 'working';
      progressStatus.value = t('views.wizard.statusOpening');
      errorMessage.value = '';
      pendingChanges.value = [];
      finalResponseText.value = '';

      try {
        const b = await businessUtils.getBusiness(store, user.value, businessId.value);
        if (!b) {
          throw new Error('Business not found');
        }

        await new Promise((resolve, reject) => {
          let settled = false;
          const settle = (fn) => (...args) => {
            if (!settled) { settled = true; fn(...args); }
          };
          ZylchAPI.sendMessageStream(
            user.value,
            `/mrcall open ${businessId.value}`,
            {
              onDone: settle(resolve),
              onError: settle((msg) => reject(new Error(msg))),
              onTextDelta: () => {},
            },
            wizardSessionId.value
          );
          setTimeout(settle(resolve), 15000);
        });

        progressStatus.value = t('views.wizard.statusConfiguring');

        const planCatalogText = buildPlanCatalogText();
        const prompt = t('views.wizard.agentPrompt', { plans: planCatalogText });

        await new Promise((resolve, reject) => {
          let settled = false;
          const settle = (fn) => (...args) => {
            if (!settled) { settled = true; fn(...args); }
          };

          ZylchAPI.sendMessageStream(
            user.value,
            `/agent mrcall run "${prompt}"`,
            {
              onProgress: (phaseName, text) => {
                progressStatus.value = text;
              },
              onTextDelta: (text) => {
                progressStatus.value = '';
                finalResponseText.value += text;
              },
              onTextReplace: (text) => {
                progressStatus.value = '';
                finalResponseText.value = text;
              },
              onMetadata: (metadata) => {
                if (metadata.pending_changes) {
                  for (const change of metadata.pending_changes) {
                    const idx = pendingChanges.value.findIndex(c => c.variable_name === change.variable_name);
                    if (idx >= 0) {
                      pendingChanges.value[idx] = change;
                    } else {
                      pendingChanges.value.push(change);
                    }
                  }
                }
              },
              onError: settle((msg) => {
                console.error('[Wizard] Config error:', msg);
                reject(new Error(msg));
              }),
              onDone: settle(resolve),
            },
            wizardSessionId.value
          );
        });

        if (pendingChanges.value.length > 0) {
          progressStatus.value = t('views.wizard.statusApplying');
          const result = await ZylchAPI.applyChanges(
            user.value,
            businessId.value,
            pendingChanges.value.map(c => ({ variable_name: c.variable_name, new_value: c.new_value }))
          );
          if (!result.success) {
            throw new Error(t('views.wizard.applyFailed'));
          }
        }

        const recommendation = extractPlanRecommendation(finalResponseText.value);
        if (recommendation) {
          const currentRecs = store.state.onboardingData?.planRecommendation || {};
          store.commit('setOnboardingData', {
            ...store.state.onboardingData,
            planRecommendation: { ...currentRecs, [businessId.value]: recommendation },
          });
        }

        const completedMap = store.state.onboardingData?.wizardCompletedFor || {};
        store.commit('setOnboardingData', {
          ...store.state.onboardingData,
          wizardCompletedFor: { ...completedMap, [businessId.value]: true },
        });

        phase.value = 'done';
      } catch (err) {
        console.error('[Wizard] Auto-config failed:', err);
        errorMessage.value = err.message || t('views.wizard.configFailed');
        phase.value = 'error';
      } finally {
        isStarting.value = false;
      }
    };

    const onCallEnded = () => {
      router.push({ name: 'OnboardingChoosePlan', query: { id: businessId.value } });
    };

    const onCallError = () => {
      callErrorOccurred.value = true;
    };

    onMounted(() => {
      if (!businessId.value) {
        router.push({ name: 'Businesses' });
      }
    });

    return {
      phase,
      businessId,
      isStarting,
      progressStatus,
      errorMessage,
      callErrorOccurred,
      startAutoConfig,
      onCallEnded,
      onCallError,
    };
  },
};
</script>

<style scoped lang="less">
@import '../../assets/style/colors';

.wizard-page {
  min-height: 100vh;
  background: @mrcall_background;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.wizard-container {
  max-width: 520px;
  width: 100%;
  background: @mrcall_white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 2.5rem 2rem;
  text-align: center;
}

.wizard-ask {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.wizard-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: @mrcall_dark_grey_text;
  margin: 0;
}

.wizard-question {
  font-size: 1rem;
  line-height: 1.6;
  color: @mrcall_grey_text;
  margin: 0;
  white-space: pre-line;
}

.wizard-start-btn {
  align-self: center;
  min-width: 160px;
  font-weight: 600;
  font-size: 1rem;
  padding: 0.75rem 1.5rem;
}

.wizard-working {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem 0;
}

.working-status {
  font-size: 1rem;
  color: @mrcall_grey_text;
  margin: 0;
  min-height: 1.5em;
}

.wizard-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.done-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: @mrcall_dark_grey_text;
  margin: 0;
}

.call-error-recovery {
  margin-top: 0.5rem;
}

.continue-link {
  font-size: 0.9rem;
  color: @mrcall_blue;
  text-decoration: underline;
  cursor: pointer;

  &:hover {
    color: @mrcall_blue_highlight;
  }
}

.wizard-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 0;
}

.error-icon {
  font-size: 3rem;
  color: var(--red-500);
}

.error-message {
  font-size: 1rem;
  color: @mrcall_grey_text;
  margin: 0;
  text-align: center;
}

@media screen and (max-width: 640px) {
  .wizard-container {
    padding: 1.5rem 1rem;
  }

  .wizard-title {
    font-size: 1.25rem;
  }

  .wizard-question {
    font-size: 0.95rem;
  }

  .done-title {
    font-size: 1.5rem;
  }
}
</style>