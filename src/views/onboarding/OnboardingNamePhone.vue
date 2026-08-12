<template>
  <OnboardingBase :current-step="2" :total-steps="3">
    <template #title>{{ $t('views.onboarding.namephone.titleText') }}</template>
    <template #subtitle>{{ $t('views.onboarding.namephone.subtitleText') }}</template>
    <template #content>
      <div class="item">
        <div class="inputboxtitle">
          {{$t('views.onboarding.namephone.yourNameTitle')}}
        </div>
        <InputText id="userName"
                   class="text-sm"
                   :placeholder="$t('views.onboarding.namephone.yourNamePlaceholder')"
                   v-model="onboardingData.business.name"
                   :class="{'p-invalid':userNameNotValid && submitted}"/>
        <div class="inputboxerror" v-if="userNameNotValid && submitted">
          {{$t('views.onboarding.namephone.nameErrorMessage')}}
        </div>
      </div>
      <div class="item">
        <div class="inputboxtitle">
          {{$t('views.onboarding.namephone.phoneNumberTitle')}}
        </div>
        <MazPhoneNumberInput
            v-model="onboardingData.business.businessPhoneNumber"
            show-code-on-list
            color="info"
            size="sm"
            :fetch-country="false"
            :translations="{
                              countrySelector: {
                                placeholder: $t('views.onboarding.namephone.phoneNumberCountrySelectorPlaceholder'),
                                error: $t('views.onboarding.namephone.phoneNumberCountrySelectorError'),
                              },
                              phoneInput: {
                                placeholder: null, //$t('views.onboarding.namephone.phoneNumberPhoneInputPlaceholder'),
                                example: $t('views.onboarding.namephone.phoneNumberPhoneInputExample'),
                              }
                            }"
            default-phone-number=""
            :default-country-code="onboardingData.business.countryAlpha2"
            :noFlags="false"
            :noExample="false"
            :preferred-countries="countryCodesMap.map((v) => v.country_code)"
            :custom-countries-list="countryCodesMap.map((v) => v.country_code)"
            :ignored-countries="['AC']"
            @update="validatePhone"
        />
        <div class="inputboxerror" v-if="phoneNumberNotValid && submitted">
          {{$t('views.onboarding.namephone.phoneNumberErrorMessage')}}
        </div>
        <div class="inputboxsubtitle">
          {{$t('views.onboarding.namephone.phoneNumberSubtitle')}}
        </div>
      </div>
    </template>
    <template #support-large>
      <div class="fun-fact-panel">
        <img src="@/assets/images/mrcall/littleman/features.svg" alt="MrCall" class="fun-fact-mascot" />
        <div class="fun-fact-title">{{ $t('views.onboarding.business.funFactTitle') }}</div>
        <p class="fun-fact-text">{{ $t('views.onboarding.business.funFactText') }}</p>
      </div>
    </template>
    <template #support-small>
      <div class="fun-fact-panel-small">
        <Panel toggleable collapsed>
          <template #header>
            <img src="@/assets/images/mrcall/littleman/features.svg" alt="MrCall" class="fun-fact-mascot-small" />
            <span class="fun-fact-header">{{ $t('views.onboarding.business.funFactTitle') }}</span>
          </template>
          <p class="fun-fact-text">{{ $t('views.onboarding.business.funFactText') }}</p>
        </Panel>
      </div>
    </template>
    <template #footer>
      <div class="button-left">
        <Button :label="$t('views.onboarding.namephone.moveBackward')" @click="router.push({name: 'OnboardingLanguage'})" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-right">
        <Button :label="$t('views.onboarding.namephone.moveForward')" @click="submit()" class="p-button-text md:w-auto py-3 w-full"/>
      </div>
    </template>
  </OnboardingBase>
</template>

<script>
import OnboardingBase from "@/components/templates/onboarding/Base";
import {computed} from "vue";
import {useStore} from "vuex";
import router from "@/router";
import parsePhoneNumber from "libphonenumber-js";

export default {
  components: {OnboardingBase},
  name: "OnboardingNamePhone",
  setup: function () {
    const store = useStore();

    const countryCodesMap = [
      {name: 'Italy', flag_code: 'it', country_code: 'IT', lang_code: 'it-IT'},
      {name: 'United States', flag_code: 'us', country_code: 'US', lang_code: 'en-US'},
      {name: 'United Kingdom', flag_code: 'gb', country_code: 'GB', lang_code: 'en-GB'},
      {name: 'Spain', flag_code: 'es', country_code: 'ES', lang_code: 'es-ES'},
      {name: 'France', flag_code: 'fr', country_code: 'FR', lang_code: 'fr-FR'},
      {name: 'Germany', flag_code: 'de', country_code: 'DE', lang_code: 'de-DE'},
      {name: 'Brazil', flag_code: 'br', country_code: 'BR', lang_code: 'pt-BR'},
      {name: 'Portugal', flag_code: 'pt', country_code: 'PT', lang_code: 'pt-PT'},
      {name: 'Norway', flag_code: 'no', country_code: 'NO', lang_code: 'no-NO'},
      {name: 'Switzerland', flag_code: 'ch', country_code: 'CH', lang_code: 'de-DE'},
      {name: 'Canada', flag_code: 'ca', country_code: 'CA', lang_code: 'en-US'},
      {name: 'Australia', flag_code: 'au', country_code: 'AU', lang_code: 'en-GB'},
      {name: 'Sweden', flag_code: 'se', country_code: 'SE', lang_code: 'sw-SW'},
      {name: 'Finland', flag_code: 'fi', country_code: 'FI', lang_code: 'fi-FI'},
      {name: 'Greece', flag_code: 'gr', country_code: 'GR', lang_code: 'el-GR'},
      {name: 'Turkey', flag_code: 'tr', country_code: 'TR', lang_code: 'tr-TK'},
      {name: 'Netherlands', flag_code: 'nl', country_code: 'NL', lang_code: 'nl-NL'},
      {name: 'Denmark', flag_code: 'dk', country_code: 'DK', lang_code: 'da-DK'},
      {name: 'Estonia', flag_code: 'ee', country_code: 'EE', lang_code: 'et-EE'}
    ]

    return {
      store,
      user: computed(() => store.state.user),
      router,
      countryCodesMap
    }
  },
  data: function() {
    const onboardingData = this.store.state.onboardingData

    return {
      userNameNotValid: false,
      phoneNumberNotValid: false,
      submitted: false,
      onboardingData
    }
  },
  methods: {
    telephoneNumberType(number) {
      const phoneNumber = parsePhoneNumber(number)
      const numberType = phoneNumber.getType()
      if(numberType)
        return numberType.toLowerCase()
      return 'unknown'
    },
    validatePhone(value) {
      if(value.isValid) {
        console.log("EVENT1: ", value)
        const phoneNumber = value.e164
        this.onboardingData.business.businessPhoneNumber = phoneNumber
        this.onboardingData.business.numberType = this.telephoneNumberType(phoneNumber)
        this.onboardingData.business.emailAddress = this.user.email
        this.onboardingData.business.variables.SMS_TO_NUMBER = phoneNumber
        this.onboardingData.business.variables.EMAIL_TO = this.user.email
        this.phoneNumberNotValid = false ;
      } else {
        console.log("EVENT2: ", value)
        this.phoneNumberNotValid = true ;
      }
    },
    submit() {
      console.debug("OnboardingData: ", this.onboardingData);
      this.submitted = true ;
      this.userNameNotValid = ! this.onboardingData.business.name;
      if(this.onboardingData.business.name && this.onboardingData.business.businessPhoneNumber) {
        this.router.push({
          name: "OnboardingSearchBusiness"
        });
      }
    }
  },
  created() {
    console.log("NamePhone Called with: ", this.onboardingData);
    if(! this.onboardingData.business) {
      this.onboardingData.business = {
        variables: {}
      }
    }
    if(this.onboardingData.passedName) {
      this.onboardingData.business.name = this.onboardingData.passedName
    }
    if(this.onboardingData.passedBusinessPhoneNumber) {
      this.onboardingData.business.businessPhoneNumber = this.onboardingData.passedBusinessPhoneNumber
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
@import '../../assets/style/components/templates/onboarding_fun_fact';
</style>