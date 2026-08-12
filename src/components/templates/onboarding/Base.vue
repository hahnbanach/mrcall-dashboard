<script setup>
import SupportSection from "../support/SupportSection.vue";
import { computed } from "vue";

const props = defineProps({
  currentStep: { type: Number, default: 0 },
  totalSteps: { type: Number, default: 7 },
  wide: { type: Boolean, default: false }
});

const progressPercent = computed(() => {
  if (props.currentStep <= 0 || props.totalSteps <= 0) return 0;
  return Math.round((props.currentStep / props.totalSteps) * 100);
});
</script>

<template>
  <div id="onboarding-page">
    <div id="support-small">
      <slot name="support-small">
        <Panel  toggleable collapsed>
          <template #header>
            <div id="header-assistance-icon">
            </div>
            {{$t('components.templates.onboarding.doYouNeedAssistance')}}
          </template>
          <SupportSection></SupportSection>
        </Panel>
      </slot>
    </div>
    <div id="mrcall-onboarding-content">
      <slot name="before-central"></slot>
      <div id="onboarding-central-section" :class="{ 'wide': wide }">
        <slot name="spinner"></slot>
        <div v-if="currentStep > 0" id="onboarding-progress">
          <ProgressBar :value="progressPercent" :showValue="false" style="height: 6px; width: 100%;" />
          <div id="onboarding-step-label">{{ currentStep }} / {{ totalSteps }}</div>
        </div>
        <div id="central-header-section">
          <slot name="beforetitle"></slot>
          <div id="title">
            <slot name="title"></slot>
          </div>
          <div id="subtitle">
            <slot name="subtitle"></slot>
          </div>
        </div>
        <div id="content">
          <slot name="content"></slot>
        </div>
        <div id="footer">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
    <div id="divider"></div>
    <div id="support-large">
      <slot name="support-large">
        <SupportSection></SupportSection>
      </slot>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../../../assets/style/colors';

#onboarding-page {
  padding: 4em 2em 4em 2em ;
  display: flex ;
  flex-direction: row;
  height: 100%;

  .p-divider-vertical.p-divider-center {
    /* align-items: center; */
    /* border-color: black; */
    background: @mrcall_dark_grey;
    /* border: none; */
    width: 1px;
    /* clear: none; */
    /* height: 22px; */
    margin: 0;
    /* box-shadow: none; */
    padding: 0 ;
    //padding: 0 1em 0 1em;
  }

  #mrcall-onboarding-content {
    height: max-content;
    width: 100%;
    display: flex;
    flex-direction: column;
    position: initial;

    @media screen and (max-width: 640px) {
      background: @mrcall_white;

      #onboarding-central-section {
        /* Auto layout */
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1em;
        margin-bottom: auto;
        //gap: 24px;

        position: relative;
        width: 100%;
        height: 100%;
        //height: 764px;
        left: 0;
        //top: calc(60% - 764px / 2 + 40px);

        /* Lara/Root/surface-card */
        background: @mrcall_white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        border-radius: 12px;

        #central-header-section {
          text-align: center;
          #title {
            font-family: 'Inter', serif;
            font-style: normal;
            font-weight: 700;
            font-size: 1.5em;
            line-height: 1em;
            padding-bottom: 0.5em;
            color: @mrcall_dark_grey_text;
          }

          #subtitle {
            font-family: 'Inter',serif;
            font-style: normal;
            font-weight: 400;
            font-size: 1.0em;
            line-height: 1.0em;
            color: @mrcall_grey_text;
          }
        }

        #content {
          width: 100%;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }
      }
    }

    @media screen and (min-width: 640px) {
      background: @mrcall_background;

      #onboarding-central-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 2em;
        //gap: 24px;

        margin-top: auto;
        margin-bottom: auto;

        position: relative;
        width: 556px;
        min-height: 510px;
        height: auto;
        left: calc(50% - 556px / 2 - 0.32px);

        &.wide {
          width: 960px;
          left: calc(50% - 960px / 2);
        }

        // top: calc(50% - 510px / 2);

        /* Lara/Root/surface-card */
        background: @mrcall_white;
        /* cardShadow */
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.14), 0 2px 1px -1px rgba(0, 0, 0, 0.02);
        border-radius: 12px;

        #central-header-section {
          text-align: center;
          #title {
            font-family: 'Inter', serif;
            font-style: normal;
            font-weight: 700;
            font-size: 1.5em;
            line-height: 1em;
            padding-bottom: 0.5em;
            color: @mrcall_dark_grey_text;
          }

          #subtitle {
            font-family: 'Inter',serif;
            font-style: normal;
            font-weight: 400;
            font-size: 1em;
            line-height: 1.5em;
            color: @mrcall_grey_text;
          }
        }

        #content {
          width: 100%;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }
      }
    }
  }

  #onboarding-progress {
    width: 100%;
    margin-bottom: 1.5em;
    #onboarding-step-label {
      font-family: 'Inter', serif;
      font-size: 0.75em;
      color: @mrcall_grey_text;
      text-align: right;
      margin-top: 0.3em;
    }
  }

  #divider {
    padding-left: 1em;
    border-right-width: 1px;
    border-right-style: solid;
    border-right-color: @mrcall_grey_text2;
  }

  #footer {
    width: 100%;
    display: flex;
    @media screen and (max-width: 640px) {
      flex-direction: column;
    }

    @media screen and (min-width: 640px) {
      flex-direction: row;
    }
  }

  #support-large {
    padding: 0 0 0 2em;
    display: flex ;
    flex-direction: row;
    max-width: 400px;
  }

  #support-small {
    #header-assistance-icon {
      background: url(../../../assets/images/mrcall/littleman/assistance_transparent_bg.svg) no-repeat;

      width: 48px;
      height: 48px;
      mix-blend-mode: multiply;

      /* Inside auto layout */

      flex: none;
      order: 0;
      flex-grow: 0;
    }

    .p-component {
      width: 100%;
    }
  }

  @media screen and (max-width: 640px) {
    #support-large {
      display: none;
    }
    #support-small{
      display: flex;
    }
  }
  @media screen and (min-width: 640px) {
    #support-large {
      display: flex;
    }
    #support-small{
      display: none;
    }
  }
}

@media screen and (max-width: 640px) {
  #onboarding-page {
    height: 100% ;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
}
</style>