<template>
  <OnboardingBase :current-step="4" :total-steps="7">
    <template #spinner>
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
    <template #title>{{ t('views.onboarding.configureassistant.titleText') }}</template>
    <template #subtitle>{{ t('views.onboarding.configureassistant.subtitleText') }}</template>
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

      <div class="item" v-if="onboardingData.flattenedVariablesAnnotations?.SECTOR">
        <div class="inputboxerror" v-if="sectorNotValid && submitted">
          {{t('views.onboarding.configureassistant.mandatoryParameter')}}
        </div>
        <div class="inputboxtitle">
          {{onboardingData.flattenedVariablesAnnotations['SECTOR'].humanName}}
        </div>
        <Dropdown v-model="onboardingData.business.variables['SECTOR']" :options="onboardingData.flattenedVariablesAnnotations['SECTOR'].valuesSelection"
                  optionLabel="label"
                  optionValue="value"
                  :filter="true"
                  class="w-full"
                  v-model:placeholder="onboardingData.flattenedVariablesAnnotations['SECTOR'].humanName" :showClear="true"
        >
          <template #option="slotProps">
            <div>
              <span>{{slotProps.option.label}}</span>
            </div>
          </template>
        </Dropdown>
        <span class="inputboxsubtitle" v-html="onboardingData.flattenedVariablesAnnotations['SECTOR'].description"></span>
        <div v-if="onboardingData.flattenedVariablesAnnotations['SECTOR'].upgradeInformation" class="inputboxsubtitle" v-html="onboardingData.flattenedVariablesAnnotations['SECTOR'].upgradeInformation">
        </div>
      </div>

      <div class="item" v-for="(subsectorItem, subsectorIdx) in selectSubsector()" :key="subsectorIdx">
        <div v-if="subsectorItem">
          <div class="inputboxerror" v-if="sectorNotValid && submitted">
            {{t('views.onboarding.configureassistant.mandatoryParameter')}}
          </div>
          <div class="inputboxtitle">
            {{subsectorItem.humanName}}
          </div>
          <Dropdown v-model="onboardingData.business.variables[subsectorItem.name]" :options="subsectorItem.valuesSelection"
                    optionLabel="label"
                    optionValue="value"
                    :filter="true"
                    class="w-full"
                    v-model:placeholder="subsectorItem.humanName" :showClear="true"
          >
            <template #option="slotProps">
              <div>
                <span>{{slotProps.option.label}}</span>
              </div>
            </template>
          </Dropdown>
          <span class="inputboxsubtitle" v-html="subsectorItem.description"></span>
          <div v-if="subsectorItem.upgradeInformation" class="inputboxsubtitle" v-html="subsectorItem.upgradeInformation">
          </div>
        </div>
      </div>

      <!--
      <div class="item">
        <div class="inputboxtitle">
          {{t('views.onboarding.configureassistant.welcomeMessageTitle')}}
        </div>
        <Textarea
            v-model="onboardingData.welcomeMessage"
            rows="4"
            :class="{' p-invalid':welcomeMessageNotValid && submitted}"
        />
        <div class="inputboxerror" v-if="welcomeMessageNotValid && submitted">
          {{t('views.onboarding.configureassistant.mandatoryParameter')}}
        </div>
        <div class="inputboxsubtitle">
          {{t('views.onboarding.configureassistant.welcomeMessageSubtitle')}}
        </div>
      </div>
      -->

    </template>
    <template #footer>
      <div class="button-left">
        <Button :label="t('views.onboarding.configureassistant.moveBackward')" @click="router.push({name: 'OnboardingSearchBusiness'})" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-right">
        <Button :label="t('views.onboarding.configureassistant.moveForward')" @click="submit()" class="p-button-text md:w-auto py-3 w-full"/>
      </div>
    </template>
  </OnboardingBase>
</template>

<script>
import OnboardingBase from "@/components/templates/onboarding/Base";
import {computed, ref} from "vue";
import {useStore} from "vuex";
import router from "@/router";
import businessUtils from "@/utils/Business";
import businessVariablesUtils from "@/utils/BusinessVariables";
import {useI18n} from "vue-i18n";
import Tr from "@/i18n/translation"
import { applyUtmVariablesToBusiness } from "@/utils/UtmTracking"

export default {
  components: {OnboardingBase},
  name: "OnboardingConfigureAssistant",
  setup: function () {
    const store = useStore();
    const user = computed(() => store.state.user)
    const onboardingData = store.state.onboardingData
    const { t, tm } = useI18n()
    const langCode = computed(() => Tr.getLocale()) ; //UI language
    const variablesLangCode = computed(() => { // business variables language
      if(onboardingData.business?.languageCountry) {
        return onboardingData.business?.languageCountry
      } else {
        return Tr.getLocale()
      }
    }) ;

    const utmSource = computed(() => store.getters['tracking/utmSource'])
    const utmMedium = computed(() => store.getters['tracking/utmMedium'])
    const utmCampaign = computed(() => store.getters['tracking/utmCampaign'])
    const utmTerm = computed(() => store.getters['tracking/utmTerm'])
    const utmContent = computed(() => store.getters['tracking/utmContent'])
    const allParams = computed(() => store.getters['tracking/utmParams'])
    const utmHasTracking = computed(() => store.getters['tracking/hasUtmParams'])
    const trackingSessionId = computed(() => store.getters['tracking/trackingSessionId'])

    return {
      t,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
      allParams,
      utmHasTracking,
      trackingSessionId,
      tm,
      store,
      user,
      router,
      langCode,
      variablesLangCode,
      onboardingData,
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
    return {
      showSpinner: false,
      noBusinessDialogVisible: false,
      nicknameNotValid: false,
      sectorNotValid: false,
      welcomeMessageNotValid: false,
      submitted: false,
      searchString: "",
      items: ref()
    }
  },
  methods: {
    resetErrorMessage(redirectComponent) {
      console.debug("ResetErrorMessage: ", redirectComponent);
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
    selectSubsector() {
      const sector = this.onboardingData.business.variables.SECTOR?.toUpperCase()
      if(sector) {
        const name = `SUBSECTOR_${sector}`
        return [
          this.onboardingData
            .flattenedVariablesAnnotations?.[name]
        ]
      } else {
        return undefined
      }
    },
    submit() {
      const self = this;
      self.submitted = true;
      let preventSubmit = false;
      self.showSpinner = true;

      if (!self.onboardingData.business.nickname) {
        self.nicknameNotValid = true;
        preventSubmit ||= true;
      } else {
        self.onboardingData.business.companyName = self.onboardingData.business.nickname;
      }
      if (self.onboardingData.welcomeMessage) {
        self.onboardingData.business.variables.WELCOME_PART3_NEWCALLER = self.onboardingData.welcomeMessage;
        self.onboardingData.business.variables.WELCOME_PART3_RECURRENT = self.onboardingData.welcomeMessage;
      }

      //create or update the assistant
      if (!preventSubmit) {
        // Add UTM tracking data to the business object
        if (self.utmHasTracking) {
          applyUtmVariablesToBusiness(self.store, this.onboardingData.business)
        }
        if (self.trackingSessionId) {
          this.onboardingData.business.variables["TRACKING_SESSION_ID"] = self.trackingSessionId
        }

        const inBusiness = businessVariablesUtils.businessVariablesToSerializable(this.onboardingData.business)
        console.debug("UTM Source: ", self.utmSource);
        console.debug("UTM Medium: ", self.utmMedium);
        console.debug("UTM Campaign: ", self.utmCampaign);
        console.debug("UTM Term: ", self.utmTerm);
        console.debug("UTM Content: ", self.utmContent);
        console.debug("All UTM Params: ", self.allParams);
        console.debug("Has Tracking: ", self.utmHasTracking);
        console.debug("Business with tracking: ", inBusiness);
        let operation
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
            console.debug("Already Exists");
            self.modalDialogTitle = self.tm('views.onboarding.configureassistant.errorDialogAlreadyExistsTitle');
            self.modalDialogSubTitle = self.onboardingData.business.businessPhoneNumber;
            self.modalDialogBodyMessage = self.tm('views.onboarding.configureassistant.errorDialogAlreadyExistsBody');
            self.modalDialogLeftButtonLabel = self.t('views.onboarding.configureassistant.alreadyExistsBusinessErrorLeftButtonLabel');
            self.modalDialogRightButtonLabel = self.t('views.onboarding.configureassistant.alreadyExistsBusinessErrorRightButtonLabel');
            self.modalDialogLeftRedirectComponentName = "OnboardingNamePhone";
            self.modalDialogRightRedirectComponentName = "Businesses";
            self.modalDialogVisible = true;
          } else {
            console.debug("Not handled error creating business");
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
        })
      } else {
        self.showSpinner = false;
      }
    },
    async initializePage() {
      console.debug("Called Initialization of OnboardingConfigureAssistant");
      const self = this
      self.showSpinner = true
      if (!self.onboardingData.variablesSpec || !self.onboardingData.flattenedVariablesAnnotations) {
        businessUtils.selectVariables(self.user, self.variablesLangCode, self.langCode, self.onboardingData.business.template)
          .catch((error) => {
            self.showSpinner = false
            console.error(error)
          }).then(async (variablesAnnotations) => { //3- populate local business
          const flattenedVariablesAnnotations = {}
          variablesAnnotations.map((collection) => {
            collection.variables.flat().map((description) => {
              flattenedVariablesAnnotations[description.name] = description
            })
          })
          self.onboardingData.variablesSpec = variablesAnnotations
          self.onboardingData.flattenedVariablesAnnotations = flattenedVariablesAnnotations
          self.showSpinner = false
        })
      } else {
        self.showSpinner = false
      }
    }
  },
  async mounted() {
    this.initializePage()
  },
  async created() {
    console.log("ConfigureAssistant Called with: ", this.onboardingData);
    if(! this.onboardingData.business?.languageCountry) {
      this.router.push({
        name: "OnboardingLanguage"
      });
    }
    if(! this.onboardingData.business.variables.voiceGender) {
      this.onboardingData.business.variables.voiceGender = "FEMALE"
    }
    if(!this.onboardingData.business.variables.SECTOR) {
      this.onboardingData.business.variables.SECTOR = "firm"
    }
    if(!this.onboardingData.welcomeMessage) {
      if(this.onboardingData.business.nickname) {
        this.onboardingData.welcomeMessage =
          this.onboardingData.business.variables.WELCOME_PART3_NEWCALLER
            .replace("{{nickname}}", this.onboardingData.business.nickname)
      } else {
        this.onboardingData.welcomeMessage = this.onboardingData.business.variables.WELCOME_PART3_NEWCALLER
          .replace("{{nickname}}", this.t('views.onboarding.configureassistant.nickNamePlaceHolder'))
      }
    }
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';
@import '../../assets/style/components/templates/onboarding_modal_dialog';

.mc-autocomplete-item {
  background: transparent;
  flex-direction: column;
}

#selection_item {
  width: 100%;
  padding: 1em 0 0 0;
}

#selected_result {
  .inputboxtitle {
    padding: 0 ;
  }
  border: 1px;
  border-color: @mrcall_grey_text2;
  border-radius: 6px;
  border-style: solid;
  padding: 1em;

  display: flex;
  flex-direction: row;

  #left-size {
    display: flex;
    flex-direction: column;
    width: 65%;
  }

  #right-side {
    width: 35%;
    margin-left: auto;
    margin-top: auto;
    margin-bottom: auto;
    display: flex;
    flex-direction: column;
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

    .p-button-left.p-button:hover {
      background: @mrcall_grey_text2;
      color: @mrcall_white;
    }
  }
}
</style>
