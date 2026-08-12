<template>
  <div class="action-panel">
    <div class="action-panel-intro">
      {{ t('components.business.actionPanelIntro') }}
    </div>
    <div v-if="businessId" class="action-panel-voice">
      <DirectVoiceButton
          :business-id="businessId"
          encoding="pcm16"
          class="w-full"
      />
    </div>
    <div class="action-panel-cards">
      <Carousel :value="howToCards" :numVisible="1" :numScroll="1" :showNavigators="true" :showIndicators="false" :circular="true">
        <template #item="slotProps">
          <div class="action-panel-card">
            <div class="action-panel-card-title">{{ slotProps.data.title }}</div>
            <div class="action-panel-card-text">{{ slotProps.data.text }}</div>
          </div>
        </template>
      </Carousel>
    </div>
    <div class="action-panel-bottom">
      <div v-if="isOnboarding" class="action-panel-cta">
        <Button
            :label="t('components.business.activateMrCallCta')"
            @click="goToChoosePlan()"
            class="w-full activate-cta-button"
            icon="pi pi-bolt"
            iconPos="left"
        />
      </div>
      <div class="action-panel-help">
        <Button
            :label="t('components.business.needHelp')"
            icon="pi pi-question-circle"
            iconPos="left"
            class="p-button-outlined action-panel-help-btn"
            @click="openHelp()"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Carousel from 'primevue/carousel';
import DirectVoiceButton from '@/components/webcall/DirectVoiceButton.vue';
import { bookingUrl } from '@/utils/BookingUrl';

const props = defineProps({
  businessId: { type: String, default: '' },
  business: { type: Object, default: () => ({}) },
});

const router = useRouter();
const { t } = useI18n();

const isOnboarding = computed(() => {
  if (!props.business) return false;
  if (props.business.onboarding) return true;
  const template = props.business.template || '';
  return template.endsWith('_onboarding');
});

const howToCards = computed(() => [
  { title: t('components.business.howToCard1Title'), text: t('components.business.howToCard1Text') },
  { title: t('components.business.howToCard2Title'), text: t('components.business.howToCard2Text') },
  { title: t('components.business.howToCard3Title'), text: t('components.business.howToCard3Text') },
  { title: t('components.business.howToCard4Title'), text: t('components.business.howToCard4Text') },
  { title: t('components.business.howToCard5Title'), text: t('components.business.howToCard5Text') },
  { title: t('components.business.howToCard6Title'), text: t('components.business.howToCard6Text') },
  { title: t('components.business.howToCard7Title'), text: t('components.business.howToCard7Text') },
  { title: t('components.business.howToCard8Title'), text: t('components.business.howToCard8Text') }
]);

const goToChoosePlan = () => {
  const query = { id: props.businessId };
  if (props.business?.variables?.MULTILINGUAL_ENABLED === true || props.business?.variables?.MULTILINGUAL_ENABLED === 'true') {
    query.multilingual = 'true';
  }
  if (props.business?.variables?.START_BOOKING_PROCESS === true || props.business?.variables?.START_BOOKING_PROCESS === 'true') {
    query.booking = 'true';
  }
  router.push({ name: 'OnboardingChoosePlan', query });
};

const openHelp = () => {
  window.open(bookingUrl(), '_blank');
};
</script>

<style scoped lang="less">
@import '../assets/style/colors';

.action-panel {
  display: flex;
  flex-direction: column;
  gap: 1.2em;
  padding: 0;
  max-width: 280px;

  @media screen and (max-width: 840px) {
    max-width: 100%;
    padding-bottom: 5em;
  }

  .action-panel-intro {
    font-family: 'Inter', serif;
    font-weight: 500;
    font-size: 0.95em;
    line-height: 1.5;
    color: @mrcall_grey_text;

    @media screen and (max-width: 840px) {
      display: none;
    }
  }

  .action-panel-voice {
    margin-bottom: 0.5em;

    :deep(.p-button .pi) {
      animation: phone-ring 3s ease-in-out infinite;
    }
  }
}

.action-panel-cards {
  display: flex;
  flex-direction: column;
  gap: 1em;
}

.action-panel-card {
  padding: 1em;
  background: @mrcall_background;
  border-radius: 10px;
  border: 1px solid @mrcall_borders;

  .action-panel-card-title {
    font-family: 'Inter', serif;
    font-weight: 700;
    font-size: 0.95em;
    color: @mrcall_dark_grey_text;
    margin-bottom: 0.5em;
  }

  .action-panel-card-text {
    font-family: 'Inter', serif;
    font-weight: 400;
    font-size: 0.85em;
    line-height: 1.6;
    color: @mrcall_grey_text;
  }
}

.action-panel-bottom {
  display: flex;
  flex-direction: column;
  gap: 0.5em;

  @media screen and (max-width: 840px) {
    flex-direction: row;
    align-items: stretch;
    gap: 0.5em;

    .action-panel-cta {
      flex: 1;
      padding-top: 0;

      .activate-cta-button {
        height: 100%;
        font-size: 0.85em;
        padding: 0.6em 0.8em;
      }
    }

    .action-panel-help {
      flex: 1;

      .action-panel-help-btn {
        width: 100%;
        height: 100%;
        font-size: 0.85em;
        padding: 0.6em 0.8em;
      }
    }
  }
}

.action-panel-cta {
  text-align: center;
  padding-top: 0.5em;
}

.action-panel .action-panel-cta .activate-cta-button {
  font-family: 'Inter', serif;
  font-weight: 700;
  background: @mrcall_orange;
  border-color: @mrcall_orange;
  color: white;
  border-radius: 33px;
  animation: cta-pulse 2.5s ease-in-out infinite;

  &:hover {
    background: darken(@mrcall_orange, 8%);
    border-color: darken(@mrcall_orange, 8%);
    animation: none;
  }
}

.action-panel .action-panel-help {
  text-align: center;

  .action-panel-help-btn.p-button {
    font-family: 'Inter', serif;
    font-weight: 600;
    font-size: 0.95em;
    color: @mrcall_blue;
    background: transparent;
    border: 1px solid @mrcall_blue;
    border-radius: 33px;
    padding: 0.75em 1.2em;

    &:hover {
      background: fade(@mrcall_blue, 8%);
    }
  }
}

@keyframes phone-ring {
  0%, 80%, 100% { transform: rotate(0deg); }
  84% { transform: rotate(15deg); }
  88% { transform: rotate(-15deg); }
  92% { transform: rotate(10deg); }
  96% { transform: rotate(-10deg); }
}

@keyframes cta-pulse {
  0%, 100% { box-shadow: 0 0 0 0 fade(@mrcall_orange, 40%); }
  50% { box-shadow: 0 0 0 10px fade(@mrcall_orange, 0%); }
}

@media (prefers-reduced-motion: reduce) {
  .activate-cta-button {
    animation: none;
  }
  .action-panel-voice :deep(.p-button .pi) {
    animation: none;
  }
}
</style>
