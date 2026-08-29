<template>
  <OnboardingBase :current-step="7" :total-steps="7">
    <template #title>
      <div id="heading-icon">
      </div>
      {{ $t('views.onboarding.notificationpreview.titleText') }}
    </template>
    <template #subtitle>{{ $t('views.onboarding.notificationpreview.subtitleText') }}</template>
    <template #content>
      <div class="item">
        <div class="audio-player">
          <audio controls>
            <source :src="'data:audio/mpeg;base64,' + onboardingData.lastConversation.audio">
            {{ $t('views.onboarding.notificationpreview.audioNotSupported') }}
          </audio>
        </div>
      </div>
      <div class="item">
        <div class="transcription-box">
          <div class="transcription-box-title">
            {{$t('views.onboarding.notificationpreview.transcriptionBoxTitle')}}
          </div>
          <div v-html="onboardingData.lastConversation.subject"></div>
          <br>
          <div v-html="onboardingData.lastConversation.body"></div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="button-left">
        <Button :label="$t('views.onboarding.notificationpreview.moveBackward')"
                @click="router.push({name: 'OnboardingMakeATestCall'})"
                class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-right">
        <Button :label="$t('views.onboarding.notificationpreview.moveForward')" @click="router.push({name: 'OnboardingChoosePlan'})" class="p-button-text md:w-auto py-3 w-full"/>
      </div>
    </template>
  </OnboardingBase>
</template>

<script>
import OnboardingBase from "@/components/templates/onboarding/Base";
import {computed, ref} from "vue";
import {useStore} from "vuex";
import router from "@/router";
import {useConfirm} from "primevue/useconfirm";

export default {
  components: {OnboardingBase},
  name: "OnboardingNotificationPreview",
  setup: function () {
    const store = useStore();
    const user = computed(() => store.state.user)
    const confirm = useConfirm();
    const onboardingData = computed(() => store.state.onboardingData)

    return {
      store,
      user,
      router,
      confirm,
      onboardingData
    }
  },
  data: function() {
    return {
      assistantHasBeenTested: false,
      modalDialogVisible: ref(false),

      modalDialogTitle: null,
      modalDialogIconClass: null,
      modalDialogSubTitle: null,
      modalDialogBodyMessage: null,
      modalDialogLeftButtonLabel: null,
      modalDialogRightButtonLabel: null,
      modalDialogLeftRedirectComponentName: null,
      modalDialogRightRedirectComponentName: null,

      modalDialogNoTestCallMessage: false,
    }
  },
  methods: {
    resetErrorMessage(redirectComponent) {
      console.debug("ResetErrorMessage: ", redirectComponent);
      this.modalDialogVisible = false ;
      this.modalDialogTitle = null ;
      this.modalDialogSubTitle = null ;
      this.modalDialogBodyMessage = null ;
      this.modalDialogLeftButtonLabel = null ;
      this.modalDialogRightButtonLabel = null ;
      this.modalDialogLeftRedirectComponentName = null ;
      this.modalDialogRightRedirectComponentName = null ;
      this.modalDialogNoTestCallMessage = false ;
      this.modalDialogIconClass = 'error-icon' ;
      this.router.push({
        name: redirectComponent
      });
    }
  },
  mounted() {
  },
  created() {
    console.log("MakeATestCall Called with: ", this.onboardingData);
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';
@import '../../assets/style/components/templates/onboarding_modal_dialog';

#heading-icon {
  background: url('../../assets/images/mrcall/icons/play_notification_icon.svg') no-repeat;
  width: 5em;
  height: 5em;
  margin: 0 auto 0 auto;
}

.modal_dialog_no_testcall_title {
  margin: 0 0 1em 0 ;
  font-family: 'Inter', serif;
  font-style: normal;
  font-weight: 700;
  font-size: 1.1em;
}

ul {
  display: block;
  li {
    font-family: 'Inter', serif;
    font-style: normal;
    font-weight: 700;
    font-size: 0.8em;
    margin: 1em 0 1em 0;
  }
}

.audio-player {
  margin: 0 auto 0 auto;
}

.transcription-box {
  border: none;
  border-radius: 6px;
  padding: 0.5em 1em 0.5em 1em;
  background: @mrcall_light_grey_2;
  .transcription-box-title {
    font-size: large;
    font-weight: bold;
    color: @mrcall_blue;
    margin-bottom: 1em;

  }
}
</style>
