<template>
  <OnboardingBase :current-step="2" :total-steps="3">
    <template #spinner>
      <Toast></Toast>
      <ProgressSpinner
          v-show="showSpinner"
          style="position: fixed; top: 50%; transform: translate(0%, -50%); width: 25%; height: 20%; z-index: 100;"
          strokeWidth="4"
          :pt="{
            spinner: { style: { animationDuration: '2s' } },
            circle: { style: { stroke: '#0068FF', strokeWidth: 3, animation: 'auto' } }
          }"
          fill="transparent"
          animationDuration="2.5s" aria-label="ProgressSpinner" />
    </template>
    <template #title>{{ $t('views.onboarding.searchbusinessinfo.titleText') }}</template>
    <template #subtitle>{{ showSpinner ? $t('views.onboarding.searchbusinessinfo.subtitleTextSearch') : $t('views.onboarding.searchbusinessinfo.subtitleText') }}</template>
    <template #content>
      <Dialog v-model:visible="modalDialogVisible"
              :dismissableMask="false"
              :closable="false"
              modal>
        <div class="modal_dialog_content">
          <div :class="'modal_dialog_icon' + ' ' + modalDialogIconClass">
          </div>
          <div class="modal_dialog_title">
            <div v-for="item in modalDialogTitle" :key="item">
              {{item}}
            </div>
          </div>
          <div v-if="modalDialogSubTitle" class="modal_dialog_subtitle">
            {{modalDialogSubTitle}}
          </div>
          <div class="modal_dialog_message">
            <div v-for="item in modalDialogBodyMessage" :key="item" style="line-height: 1.5em;">
              {{item}}
            </div>
          </div>
        </div>
        <template #footer>
          <div class="modal-dialog-footer">
            <div v-if="modalDialogLeftButtonLabel" class="button-left">
              <Button :label="modalDialogLeftButtonLabel" @click="resetErrorMessage(modalDialogLeftRedirectComponentName)" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
            </div>
            <div v-else class="button-left">
            </div>
            <div v-if="modalDialogRightButtonLabel" class="button-right">
              <Button :label="modalDialogRightButtonLabel" @click="resetErrorMessage(modalDialogRightRedirectComponentName)" class="p-button-text md:w-auto py-3 w-full"/>
            </div>
          </div>
        </template>
      </Dialog>

      <div class="item" v-if="!showSpinner">
        <div class="inputboxtitle">
          {{$t('views.onboarding.searchbusinessinfo.businessInformation')}}
        </div>
        <Textarea v-model="businessInformations"
                  class="w-full"
        />
        <!--        {{businessInformations}}-->
        <!--        {{onboardingData['selectedGMapsResult']}}-->
        <div class="inputboxsubtitle" style="padding: 1.5em 0 0 1em;">
          <a href="#" @click="submitSkipInfo()">{{$t('views.onboarding.searchbusinessinfo.skipInfo')}}</a>
        </div>
      </div>
    </template>
    <template #support-large>
      <div class="fun-fact-panel">
        <img src="@/assets/images/mrcall/littleman/software.svg" alt="MrCall" class="fun-fact-mascot" />
        <div class="fun-fact-title">{{ $t('views.onboarding.searchbusinessfunfact.funFactTitle') }}</div>
        <p class="fun-fact-text">{{ $t('views.onboarding.searchbusinessfunfact.funFactText') }}</p>
      </div>
    </template>
    <template #support-small>
      <div class="fun-fact-panel-small">
        <Panel toggleable collapsed>
          <template #header>
            <img src="@/assets/images/mrcall/littleman/software.svg" alt="MrCall" class="fun-fact-mascot-small" />
            <span class="fun-fact-header">{{ $t('views.onboarding.searchbusinessfunfact.funFactTitle') }}</span>
          </template>
          <p class="fun-fact-text">{{ $t('views.onboarding.searchbusinessfunfact.funFactText') }}</p>
        </Panel>
      </div>
    </template>
    <template #footer>
      <div class="button-left">
        <Button :label="$t('views.onboarding.searchbusinessinfo.moveBackward')" @click="router.push({name: 'OnboardingSearchBusiness'})" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-left">
        <Button :disabled="showSpinner" :loading="showSpinner" :label="showSpinner ? $t('views.onboarding.searchbusinessinfo.loading') : $t('views.onboarding.searchbusinessinfo.reload')" @click="searchBusinessInformation()" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-right">
        <Button :disabled="showSpinner" :label="$t('views.onboarding.searchbusinessinfo.moveForward')" @click="submit()" class="p-button-text md:w-auto py-3 w-full"/>
      </div>
    </template>
  </OnboardingBase>
</template>

<script>
import OnboardingBase from "@/components/templates/onboarding/Base";
import {computed, ref} from "vue";
import {useStore} from "vuex";
import router from "@/router";
import Autocomplete from 'primevue/autocomplete';
import axios from "axios";
import {useConfirm} from "primevue/useconfirm";
import {useToast} from "primevue/usetoast";
import {useI18n} from "vue-i18n";
import businessUtils from "@/utils/Business";
import businessVariablesUtils from "@/utils/BusinessVariables";
import Tr from "@/i18n/translation"

export default {
  components: {OnboardingBase, Autocomplete},
  name: "OnboardingSearchBusinessInfo",
  setup: function () {
    const store = useStore();
    const user = computed(() => store.state.user)
    const confirm = useConfirm();
    const toast = useToast();
    const { t, tm } = useI18n()

    const utmSource = computed(() => store.getters['tracking/utmSource'])
    const utmMedium = computed(() => store.getters['tracking/utmMedium'])
    const utmCampaign = computed(() => store.getters['tracking/utmCampaign'])
    const utmTerm = computed(() => store.getters['tracking/utmTerm'])
    const utmContent = computed(() => store.getters['tracking/utmContent'])
    const utmHasTracking = computed(() => store.getters['tracking/hasUtmParams'])
    const trackingSessionId = computed(() => store.getters['tracking/trackingSessionId'])

    return {
      store,
      user,
      router,
      confirm,
      toast,
      t,
      tm,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      utmHasTracking,
      trackingSessionId,
      modalDialogVisible: ref(false),
      modalDialogTitle: null,
      modalDialogIconClass: 'error-icon',
      modalDialogSubTitle: null,
      modalDialogBodyMessage: null,
      modalDialogLeftButtonLabel: null,
      modalDialogRightButtonLabel: null,
      modalDialogLeftRedirectComponentName: null,
      modalDialogRightRedirectComponentName: null
    }
  },
  data: function() {
    const onboardingData = computed(() => this.store.state.onboardingData)
    return {
      showSpinner: false,
      submitted: false,
      onboardingData,
      businessInformations: ref()
    }
  },
  methods: {
    resetErrorMessage(redirectComponent) {
      this.modalDialogVisible = false;
      this.modalDialogTitle = null;
      this.modalDialogSubTitle = null;
      this.modalDialogBodyMessage = null;
      this.modalDialogLeftButtonLabel = null;
      this.modalDialogRightButtonLabel = null;
      this.modalDialogLeftRedirectComponentName = null;
      this.modalDialogRightRedirectComponentName = null;
      this.modalDialogIconClass = 'error-icon';
      if (redirectComponent) {
        this.router.push({
          name: redirectComponent
        });
      }
    },
    setDefaultsAndCreateBusiness() {
      const self = this;
      self.showSpinner = true;

      // Set defaults
      if (!self.onboardingData.business.variables.voiceGender) {
        self.onboardingData.business.variables.voiceGender = "FEMALE";
      }
      if (!self.onboardingData.business.variables.SECTOR) {
        self.onboardingData.business.variables.SECTOR = "firm";
      }
      if (self.onboardingData.business.nickname) {
        self.onboardingData.business.companyName = self.onboardingData.business.nickname;
      }

      // Set welcome message
      if (self.onboardingData.business.variables.WELCOME_PART3_NEWCALLER) {
        const welcomeMessage = self.onboardingData.business.variables.WELCOME_PART3_NEWCALLER
          .replace("{{nickname}}", self.onboardingData.business.nickname || "");
        self.onboardingData.business.variables.WELCOME_PART3_NEWCALLER = welcomeMessage;
        self.onboardingData.business.variables.WELCOME_PART3_RECURRENT = welcomeMessage;
      }

      // Add UTM tracking
      if (self.utmHasTracking) {
        if (self.utmSource) self.onboardingData.business.variables["UTM_SOURCE"] = self.utmSource;
        if (self.utmMedium) self.onboardingData.business.variables["UTM_MEDIUM"] = self.utmMedium;
        if (self.utmCampaign) self.onboardingData.business.variables["UTM_CAMPAIGN"] = self.utmCampaign;
        if (self.utmTerm) self.onboardingData.business.variables["UTM_TERM"] = self.utmTerm;
        if (self.utmContent) self.onboardingData.business.variables["UTM_CONTENT"] = self.utmContent;
      }
      if (self.trackingSessionId) {
        self.onboardingData.business.variables["TRACKING_SESSION_ID"] = self.trackingSessionId;
      }

      const inBusiness = businessVariablesUtils.businessVariablesToSerializable(self.onboardingData.business);
      let operation;
      if (self.onboardingData.business.businessId) {
        operation = businessUtils.updateBusiness(self.user, inBusiness);
      } else {
        operation = businessUtils.createBusiness(self.user, inBusiness);
      }

      operation.then((outBusiness) => {
        console.debug("Business created/saved, moving to the next step:", self.onboardingData.business, outBusiness);
        self.onboardingData.business = outBusiness;
        self.showSpinner = false;
        self.router.push({
          name: "OnboardingAssistantCreated"
        });
      }).catch((error) => {
        console.debug("Create business", error.response);
        if (error.response?.status === 409) {
          self.modalDialogTitle = self.tm('views.onboarding.configureassistant.errorDialogAlreadyExistsTitle');
          self.modalDialogSubTitle = self.onboardingData.business.businessPhoneNumber;
          self.modalDialogBodyMessage = self.tm('views.onboarding.configureassistant.errorDialogAlreadyExistsBody');
          self.modalDialogLeftButtonLabel = self.t('views.onboarding.configureassistant.alreadyExistsBusinessErrorLeftButtonLabel');
          self.modalDialogRightButtonLabel = self.t('views.onboarding.configureassistant.alreadyExistsBusinessErrorRightButtonLabel');
          self.modalDialogLeftRedirectComponentName = "OnboardingNamePhone";
          self.modalDialogRightRedirectComponentName = "Businesses";
          self.modalDialogVisible = true;
        } else {
          self.modalDialogTitle = self.tm('views.onboarding.configureassistant.errorDialogUnknownErrorTitle');
          self.modalDialogSubTitle = null;
          self.modalDialogBodyMessage = self.tm('views.onboarding.configureassistant.errorDialogUnknownErrorBody');
          self.modalDialogLeftButtonLabel = self.t('views.onboarding.configureassistant.unknownErrorBusinessErrorLeftButtonLabel');
          self.modalDialogRightButtonLabel = self.t('views.onboarding.configureassistant.unknownErrorBusinessErrorRightButtonLabel');
          self.modalDialogLeftRedirectComponentName = null;
          self.modalDialogRightRedirectComponentName = "OnboardingPreBookAppointment";
          self.modalDialogVisible = true;
        }
        self.showSpinner = false;
      });
    },
    submitSkipInfo() {
      this.clearSelection();
      this.onboardingData.business.nickname = this.onboardingData.business.name;
      this.setDefaultsAndCreateBusiness();
    },
    submit() {
      this.submitted = true;
      if(this.businessInformations) {
        this.onboardingData.business.variables.ABOUT_BUSINESS_INFORMATION = this.businessInformations;
      }
      if (!this.onboardingData.business.nickname) {
        this.onboardingData.business.nickname = this.onboardingData.selectedGMapsResult?.name || this.onboardingData.business.name;
      }
      this.setDefaultsAndCreateBusiness();
    },
    clearSelection() {
      this.businessInformations = ref();
      delete this.onboardingData['businessInformations'];
    },
    searchBusinessInformation() {
      const self = this ;
      self.clearSelection();
      this.$gtag.event("onboarding_searchbusinessinfo", {
        'user_email': self.user.email,
      })
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      const request = {
        "company name": this.onboardingData.selectedGMapsResult.name,
        "company address": this.onboardingData.selectedGMapsResult.formattedAddress,
        "company url": this.onboardingData.selectedGMapsResult.website,
        "#language": this.onboardingData.business.languageCountry
      }
      console.log("queryRequest: ", request)
      this.showSpinner = true
      axios.post(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/atom/search_business_data_onb",
          request,
          {
            headers: headers
          }
      ).then((response) => {
        console.debug("Search business info Response:", response)
        this.showSpinner = false
        if( response.data) {
          self.businessInformations = response.data?.informations
        }
        console.debug("Result: ", self.businessInformations)
      }).catch((error) => {
        self.businessInformations = ref()
        this.showSpinner = false
        console.error(error);
        if(error.response?.status === 401) {
          store.dispatch('logout')
          router.replace('/login')
        } else {
          self.toast.add({
            severity: 'warn',
            summary: self.t('views.onboarding.searchbusinessinfo.searchFailedTitle'),
            detail: self.t('views.onboarding.searchbusinessinfo.searchFailedMessage'),
            life: 5000
          });
        }
      })
    }
  },
  mounted() {
  },
  created() {
    console.log("OnboardingSearchBusinessInfo Called with: ", this.onboardingData);
    if(! this.onboardingData.business) {
      this.onboardingData.business = {
        variables: {}
      }
    }
    if(! this.onboardingData.business.languageCountry) {
      this.router.push({
        name: "OnboardingLanguage"
      });
    }
    if(this.onboardingData.selectedGMapsResult) {
      this.searchBusinessInformation()
    }
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';
@import '../../assets/style/components/templates/onboarding_modal_dialog';

.fun-fact-panel {
  margin: 0 auto auto auto;
  padding: 0;
  text-align: center;

  .fun-fact-mascot {
    width: 120px;
    height: auto;
    margin-bottom: 1.2em;
  }

  .fun-fact-title {
    font-family: 'Inter', serif;
    font-weight: 600;
    font-size: 1.1em;
    color: @mrcall_blue;
    margin-bottom: 0.8em;
  }

  .fun-fact-text {
    font-family: 'Inter', serif;
    font-weight: 400;
    font-size: 1em;
    line-height: 1.6;
    color: @mrcall_grey_text2;
  }
}

.fun-fact-panel-small {
  .p-component {
    width: 100%;
  }

  .fun-fact-mascot-small {
    width: 36px;
    height: auto;
    margin-right: 0.5em;
  }

  .fun-fact-header {
    font-weight: 600;
    color: @mrcall_blue;
  }

  .fun-fact-text {
    font-family: 'Inter', serif;
    font-weight: 400;
    font-size: 0.95em;
    line-height: 1.6;
    color: @mrcall_grey_text2;
    margin: 0;
  }
}

.flex-grow {
  flex: 1;
}

.mc-autocomplete-item {
  background: transparent;
  flex-direction: column;
}

.p-dialog-footer {
  display: flex ;
}
</style>