<template>
  <OnboardingBase :current-step="2" :total-steps="3">
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
    <template #title>{{ $t('views.onboarding.searchbusiness.titleText') }}</template>
    <template #subtitle>{{ $t('views.onboarding.searchbusiness.subtitleText') }}</template>
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

      <Dialog v-model:visible="warningDialogVisible"
              :dismissableMask="true"
              :closable="false"
              modal>
        <div class="modal_dialog_content">
          <div class="modal_dialog_icon warning-icon">
          </div>
          <div class="modal_dialog_title">
            {{$t('views.onboarding.searchbusiness.noBusinessSelectedTitle')}}
          </div>
          <div class="modal_dialog_message">
            {{$t('views.onboarding.searchbusiness.noBusinessSelectedMessage')}}
          </div>
        </div>
        <template #footer>
          <div class="modal-dialog-footer">
            <div class="button-left">
              <Button :label="$t('views.onboarding.searchbusiness.moveBackward')" @click="warningDialogVisible = false" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
            </div>
            <div class="button-right">
              <Button :label="$t('views.onboarding.searchbusiness.continueButtonLabel')" @click="submitNoCompany()" class="p-button-text md:w-auto py-3 w-full"/>
            </div>
          </div>
        </template>
      </Dialog>
      <div class="item">
        <div class="inputboxtitle">
          {{$t('views.onboarding.searchbusiness.searchYourBusiness')}}
        </div>
        <Autocomplete v-model="searchString"
                      inputClass="w-full"
                      :suggestions="items"
                      :completeOnFocus="false"
                      dataKey="placeId"
                      optionLabel="name"
                      dropdownMode="blank"
                      @item-select="selected"
                      @complete="searchBusiness"
        >
          <template #option="slotProps">
            <div v-if="slotProps.option.isValid" class="mc-autocomplete-item flex align-options-center">
              <div class="inputboxtitle">{{ slotProps.option.name }}</div>
              <div class="inputboxsubtitle">{{ slotProps.option.formattedAddress }}</div>
              <div class="inputboxsubtitle" v-if="slotProps.option.phoneNumber">{{ slotProps.option.phoneNumber }}</div>
            </div>
            <div v-else class="mc-autocomplete-item flex align-options-center">
              <div class="inputboxtitle">{{ slotProps.option.notFoundTitle }}</div>
              <div class="inputboxsubtitle">{{ slotProps.option.notFoundSubtitle }}</div>
            </div>
          </template>
        </Autocomplete>
        <div class="inputboxerror" v-if="noSearchInputTextProvided && submitted">
          {{$t('views.onboarding.searchbusiness.searchParametersEmptyMessage')}}
        </div>
        <div class="inputboxsubtitle" style="padding: 1.5em 0 0 1em;">
          <a href="#" @click="submitNoCompany()">{{$t('views.onboarding.searchbusiness.doNotOwnABusiness')}}</a>
        </div>
        <div id="selection_item">
          <div id="selected_result" v-if="selectedGMapsResult">
            <div id="left-size">
              <div class="inputboxtitle">{{ selectedGMapsResult.name }}</div>
              <div class="inputboxsubtitle">{{ selectedGMapsResult.formattedAddress }}</div>
              <div class="inputboxsubtitle" v-if="selectedGMapsResult.phoneNumber">{{ selectedGMapsResult.phoneNumber }}</div>
            </div>
            <div id="right-side">
              <Button :label="$t('views.onboarding.searchbusiness.removeSelection')" @click="clearSelection()" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
            </div>
          </div>
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
        <Button :label="$t('views.onboarding.searchbusiness.moveBackward')" @click="router.push({name: 'OnboardingNamePhone'})" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-right">
        <Button :label="$t('views.onboarding.searchbusiness.moveForward')" @click="submit()" class="p-button-text md:w-auto py-3 w-full"/>
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
import {useI18n} from "vue-i18n";
import businessUtils from "@/utils/Business";
import businessVariablesUtils from "@/utils/BusinessVariables";

export default {
  components: {OnboardingBase, Autocomplete},
  name: "OnboardingSearchBusiness",
  setup: function () {
    const store = useStore();
    const user = computed(() => store.state.user)
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
      warningDialogVisible: ref(false),
      noSearchInputTextProvided: false,
      submitted: false,
      onboardingData,
      searchString: "",
      items: ref(),
      selectedGMapsResult: ref()
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
    submitNoCompany() {
      this.clearSelection();
      this.onboardingData.business.nickname = this.onboardingData.business.name;
      this.warningDialogVisible = false;
      this.setDefaultsAndCreateBusiness();
    },
    async submit() {
      this.submitted = true ;
      if(this.selectedGMapsResult) {
        this.onboardingData.selectedGMapsResult = this.selectedGMapsResult;
        this.onboardingData.business.nickname = this.selectedGMapsResult.name || this.onboardingData.business.name;
        this.showSpinner = true;

        // Try to fetch business info from the web (best-effort)
        await this.fetchAndStoreBusinessInfo();

        // Now create the business and navigate to AssistantCreated
        this.setDefaultsAndCreateBusiness();
      } else {
        this.warningDialogVisible = true;
      }
      this.noSearchInputTextProvided = !this.searchString;
    },
    async fetchAndStoreBusinessInfo() {
      const self = this;
      try {
        self.$gtag.event("onboarding_searchbusinessinfo", {
          'user_email': self.user.email,
        });
        const headers = {
          "Content-type": "application/json; charset=UTF-8",
          "auth": self.user.accessToken
        };
        const request = {
          "company name": self.selectedGMapsResult.name,
          "company address": self.selectedGMapsResult.formattedAddress,
          "company url": self.selectedGMapsResult.website,
          "#language": self.onboardingData.business.languageCountry
        };
        console.log("Fetching business info: ", request);
        const response = await axios.post(
            process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/atom/search_business_data_onb",
            request,
            { headers }
        );
        console.debug("Search business info Response:", response);
        if (response.data?.informations) {
          self.onboardingData.business.variables.ABOUT_BUSINESS_INFORMATION = response.data.informations;
        }
      } catch (error) {
        console.warn("Could not fetch business info (continuing without it):", error);
        // Best-effort: if it fails, we just proceed without business info
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
          name: "OnboardingAssistantCreated",
          query: { id: outBusiness.businessId }
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
    clearSelection() {
      this.selectedGMapsResult = ref();
      delete this.onboardingData['selectedGMapsResult'];
      this.onboardingData['welcomeMessage'] = "" ;
      this.onboardingData.business.companyName = "" ;
      this.onboardingData.business.nickname = "" ;
      this.onboardingData.business.address = "" ;
      this.onboardingData.business.variables.SYNC_GOOGLE_BUSINESS = false ;
      this.onboardingData.business.variables.GOOGLE_PLACE_ID = "";
    },
    selected(event) {
      console.log("Selected: ", event);
      const self = this;
      this.clearSelection() ;
      if(event.value.isValid) {
        this.selectedGMapsResult = event.value ;
        this.$gtag.event("onboarding_searchbusiness_select", {
          'user_email': self.user.email,
          'companyName': this.onboardingData.business.companyName,
          'nickname': this.onboardingData.business.nickname
        })
        this.onboardingData.business.companyName = this.selectedGMapsResult.name ;
        this.onboardingData.business.nickname = this.selectedGMapsResult.name ;
        this.onboardingData.business.address = this.selectedGMapsResult.formattedAddress ;
        this.onboardingData.business.variables.SYNC_GOOGLE_BUSINESS = true;
        this.onboardingData.business.variables.GOOGLE_PLACE_ID = this.selectedGMapsResult.placeId;
      }
    },
    searchBusiness(event) {
      const self = this ;
      this.$gtag.event("onboarding_searchbusiness", {
        'user_email': self.user.email,
        'query': event.query
      })
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      const request = {
        query: event.query,
        language: this.onboardingData.business.languageCountry
      }
      console.log("queryRequest: ", request)
      this.showSpinner = true
      axios.post(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/place/search",
          request,
          {
            headers: headers
          }
      ).then((response) => {
        console.debug("Search Response:", response)
        this.showSpinner = false
        const items = []
        const responseData = response.data
        if(responseData) {
          if(responseData.length > 0) {
            responseData.forEach(function (item) {
              items.push({
                isValid: true,
                placeId: item.main.place.placeId,
                name: item.main.place.name,
                formattedAddress: item.main.place.formattedAddress,
                types: item.main.place.types,
                businessStatus: item.main.place.businessStatus,
                phoneNumber: item.main.details.internationalPhoneNumber,
                website: item.main.details.website
              });
            })
          } else {
            items.push({
              isValid: false,
              placeId: "invalid",
              name: self.searchString,
              notFoundTitle: `${self.t('views.onboarding.searchbusiness.yourSearchOf')} "${self.searchString}" ${self.t('views.onboarding.searchbusiness.didNotProduceResults')}.`,
            });
          }
        }
        self.items = items
        console.debug("Result: ", self.items)
      }).catch((error) => {
        self.items = ref()
        this.showSpinner = false
        console.error(error);
        if(error.response?.status === 401) {
          store.dispatch('logout')
          router.replace('/login')
        }
      })
    }
  },
  created() {
    console.log("SearchBusiness Called with: ", this.onboardingData);
    if(! this.onboardingData.business) {
      this.onboardingData.business = {
        variables: {}
      }
    } else if(this.onboardingData.selectedGMapsResult) {
      this.selectedGMapsResult = this.onboardingData.selectedGMapsResult;
    }
    if(! this.onboardingData.business.languageCountry) {
      this.router.push({
        name: "OnboardingLanguage"
      });
    }
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';
@import '../../assets/style/components/templates/onboarding_modal_dialog';
@import '../../assets/style/components/templates/onboarding_fun_fact';

.mc-autocomplete-item {
  background: transparent;
  flex-direction: column;
}

#selection_item {
  width: 100%;
  padding: 1em 0 0 0;
}

.p-dialog-footer {
  display: flex ;
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