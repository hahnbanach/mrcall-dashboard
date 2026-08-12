<script setup>
import router from "../../../router";
</script>

<template>
  <div id="onboarding-support-section">
    <div id="header">
      <div id="icon">
      </div>
      <div id="title">
        {{$t('components.templates.onboarding.supportsection.doYouNeedAssistance')}}
      </div>
    </div>
    <div id="content">
      <div id="first-part">
        {{$t('components.templates.onboarding.supportsection.callUs')}} {{$t('components.templates.onboarding.supportsection.callUsNumber')}}
        <br>
        <br>
        {{$t('components.templates.onboarding.supportsection.writeUs', {param: 'support@mrcall.ai'})}}
      </div>
      <div id="second-part">
        {{$t('components.templates.onboarding.supportsection.bookAnAppointment')}}
        <br>
        <Button @click="router.push('/callbooking')" :label="$t('components.templates.onboarding.supportsection.bookAppointmentButtonLabel')" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../../../assets/style/colors';

#onboarding-support-section {
  display: flex;
  flex-direction: column;
  margin: 0 auto auto auto;
  padding: 0;

  #header {
    width: 100%;
    #icon {
      width: 80px;
      height: 80px;
      mix-blend-mode: multiply;

      /* Inside auto layout */

      flex: none;
      order: 0;
      flex-grow: 0;

      background: url(../../../assets/images/mrcall/littleman/assistance_transparent_bg.svg) no-repeat;
    }

    #title {
      font-family: 'Inter',serif;
      font-style: normal;
      font-weight: 600;
      font-size: 1em;
      line-height: 1em;
    }
  }

  @media screen and (max-width: 640px) {
    padding: 0 0 0 0;
    #header {
      display: none;
    }
  }

  #content {
    width: 100%;

    /* h5/regular-400/line-height-auto */

    font-family: 'Inter',serif;
    font-style: normal;
    font-weight: 400;
    font-size: 1.2em;
    line-height: 1em;
    /* or 120% */

    /* Lara/Global/textSecondaryColor */

    color: @mrcall_grey_text2;


    /* Inside auto layout */

    flex: none;
    order: 0;
    align-self: stretch;
    flex-grow: 0;

    #first-part {
      padding-top: 2em;
      padding-bottom: 2em;
    }

    #second-part {
      .p-button {
        font-family: 'Inter',serif;
        font-style: normal;
        font-weight: 700;
        font-size: 0.8em;
        line-height: 1em;

        color: @mrcall_grey_text2;
        background: transparent;
        border: 1px solid @mrcall_grey_text2;
        padding: 0.5rem 1em;
        margin: 0.2em 0.2em 0.2em auto;
        border-radius: 33px;
      }

      .p-button:hover {
        background: @mrcall_grey_text2;
        color: @mrcall_white;
      }
    }

    @media screen and (max-width: 640px) {
      #second-part {
        .p-button {
          width: 100% !important;
        }
      }
    }
  }
}
</style>