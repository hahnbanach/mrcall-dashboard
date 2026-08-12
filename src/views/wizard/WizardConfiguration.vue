<template>
  <div class="wizard-page">
    <div class="wizard-container">
      <!-- Header with progress -->
      <div class="wizard-header">
        <h2>{{ $t('views.wizard.pageTitle') }}</h2>
        <div class="wizard-progress">
          <span class="wizard-step-label">
            {{ $t('views.wizard.stepOf', { current: currentStep + 1, total: steps.length }) }}
            &mdash; {{ $t(`views.wizard.steps.${steps[currentStep].key}.title`) }}
          </span>
          <div class="wizard-progress-bar">
            <div
              class="wizard-progress-fill"
              :style="{ width: ((currentStep + 1) / steps.length * 100) + '%' }"
            ></div>
          </div>
          <div class="wizard-dots">
            <span
              v-for="(step, i) in steps"
              :key="step.key"
              :class="['wizard-dot', { active: i === currentStep, done: i < currentStep, future: i > maxVisitedStep }]"
              @click="i <= maxVisitedStep ? goToStep(i) : null"
            ></span>
          </div>
        </div>
      </div>

      <!-- Loading state while opening agent -->
      <div v-if="isLoading" class="wizard-loading">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem; color: var(--primary-color);"></i>
        <p>{{ $t('views.wizard.loading') }}</p>
      </div>

      <!-- Step content -->
      <div v-else-if="agentReady" class="wizard-content">
        <WizardStep
          :key="steps[currentStep].key"
          :stepKey="steps[currentStep].key"
          :analyzePrompt="$t(`views.wizard.steps.${steps[currentStep].key}.analyzePrompt`)"
          :loadingText="$t(`views.wizard.steps.${steps[currentStep].key}.loading`)"
          :businessId="businessId"
          :sessionId="wizardSessionId"
          :readOnly="steps[currentStep].readOnly || false"
          :isLastStep="currentStep === steps.length - 1"
          @skip="nextStep"
          @pending-changes="onPendingChanges"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import { useRouter, useRoute } from 'vue-router';
import WizardStep from '@/components/wizard/WizardStep.vue';
import businessUtils from '@/utils/Business';
import ZylchAPI from '@/utils/Zylch.js';

const STEPS = [
  { key: 'welcome', readOnly: false },
  { key: 'knowledge', readOnly: false },
  { key: 'booking', readOnly: false },
  { key: 'transfer', readOnly: true },
  { key: 'notifications_biz', readOnly: false },
  { key: 'notifications_caller', readOnly: false },
  { key: 'integrations', readOnly: false },
  { key: 'summary', readOnly: true },
];

export default {
  name: 'WizardConfiguration',
  components: { WizardStep },
  setup() {
    const store = useStore();
    const router = useRouter();
    const route = useRoute();
    const user = computed(() => store.state.user);

    const steps = ref(STEPS);
    const currentStep = ref(0);
    const maxVisitedStep = ref(0);
    const business = ref(null);
    const agentReady = ref(false);
    const isLoading = ref(true);

    const businessId = computed(() => route.query.id || '');

    const wizardSessionId = computed(() =>
      businessId.value ? `mrcall_wizard_${businessId.value}` : null
    );

    // Sync step with URL query
    watch(() => route.query.step, (val) => {
      if (val !== undefined) {
        const n = parseInt(val);
        if (!isNaN(n) && n >= 0 && n < STEPS.length) {
          currentStep.value = n;
        }
      }
    }, { immediate: true });

    const goToStep = (index) => {
      if (index >= 0 && index < STEPS.length && index <= maxVisitedStep.value) {
        currentStep.value = index;
        if (index > maxVisitedStep.value) maxVisitedStep.value = index;
        router.replace({
          query: { ...route.query, step: index.toString() }
        });
      }
    };

    const nextStep = () => {
      if (currentStep.value < STEPS.length - 1) {
        const next = currentStep.value + 1;
        if (next > maxVisitedStep.value) maxVisitedStep.value = next;
        currentStep.value = next;
        router.replace({
          query: { ...route.query, step: next.toString() }
        });
      } else {
        // Wizard complete — flag per-business
        const completedMap = store.state.onboardingData?.wizardCompletedFor || {};
        store.commit('setOnboardingData', {
          ...store.state.onboardingData,
          wizardCompletedFor: { ...completedMap, [businessId.value]: true },
        });
        router.push({ name: 'Businesses' });
      }
    };

    const onPendingChanges = (changes) => {
      // Could track per-step changes if needed
      console.debug('[Wizard] Pending changes:', changes);
    };

    const initWizard = async () => {
      if (!businessId.value) {
        console.error('[Wizard] No businessId — redirecting');
        router.push({ name: 'Businesses' });
        return;
      }

      isLoading.value = true;

      try {
        // Load business data
        const b = await businessUtils.getBusiness(store, user.value, businessId.value);
        if (b) business.value = b;

        // Open agent config mode via SSE (silent, no UI)
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

        agentReady.value = true;
      } catch (err) {
        console.error('[Wizard] Init failed:', err);
        // Still allow to proceed — analysis may work anyway
        agentReady.value = true;
      } finally {
        isLoading.value = false;
      }
    };

    onMounted(() => {
      initWizard();
    });

    return {
      steps,
      currentStep,
      maxVisitedStep,
      business,
      businessId,
      wizardSessionId,
      agentReady,
      isLoading,
      goToStep,
      nextStep,
      onPendingChanges,
    };
  },
};
</script>

<style scoped lang="less">
@import '../../assets/style/colors';

.wizard-page {
  min-height: 100vh;
  background: @mrcall_background;
  padding: 2rem 1rem;
}

.wizard-container {
  max-width: 720px;
  margin: 0 auto;
  background: @mrcall_white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 2rem;
}

.wizard-header {
  margin-bottom: 2rem;
}

.wizard-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: @mrcall_dark_grey_text;
  margin: 0 0 1rem 0;
}

.wizard-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.wizard-step-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: @mrcall_grey_text;
}

.wizard-progress-bar {
  height: 4px;
  background: @mrcall_light_grey_2;
  border-radius: 2px;
  overflow: hidden;
}

.wizard-progress-fill {
  height: 100%;
  background: @mrcall_blue;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.wizard-dots {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.wizard-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: @mrcall_light_grey_2;
  cursor: pointer;
  transition: background 0.2s;
}

.wizard-dot.active {
  background: @mrcall_blue;
}

.wizard-dot.done {
  background: @mrcall_teal;
}

.wizard-dot.future {
  cursor: default;
  opacity: 0.5;
}

.wizard-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 0;
  color: var(--text-color-secondary);
}

.wizard-content {
  /* Step component renders here */
}

@media screen and (max-width: 768px) {
  .wizard-page {
    padding: 1rem 0.5rem;
  }

  .wizard-container {
    padding: 1.25rem;
    border-radius: 8px;
  }

  .wizard-header h2 {
    font-size: 1.25rem;
  }
}
</style>
