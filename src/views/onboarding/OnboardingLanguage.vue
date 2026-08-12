<template>
  <OnboardingBase :current-step="1" :total-steps="3">
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
    <template #title>{{ $t('views.onboarding.language.titleText') }}</template>
    <template #subtitle>{{ $t('views.onboarding.language.subtitleText') }}<br><small>{{ $t('views.onboarding.language.mainLanguageHint') }}</small></template>
    <template #content>
      <div class="item">
        <div class="inputboxtitle">
          {{$t('views.onboarding.language.pickALang')}}
        </div>
        <Dropdown
            v-model="languageCountry" :options="assistantLanguage"
            optionLabel="name"
            optionValue="value"
            :placeholder="$t('views.onboarding.language.pickALangPlaceholder')"
            :filter="true"
            :showClear="false"
            :class="'w-full'"
        >
          <template #option="slotProps">
            <div>
              <span>{{slotProps.option.name}}</span>
            </div>
          </template>
        </Dropdown>
        <div class="inputboxsubtitle">
          {{$t('views.onboarding.language.pickALangSubtitle')}}
        </div>
      </div>
      <!-- Phone number nationality removed from onboarding — now part of activation flow -->
    </template>
    <template #support-large>
      <div class="fun-fact-panel">
        <img src="@/assets/images/mrcall/littleman/testimonial.svg" alt="MrCall" class="fun-fact-mascot" />
        <div class="fun-fact-title">{{ $t('views.onboarding.language.funFactTitle') }}</div>
        <p class="fun-fact-text">{{ $t('views.onboarding.language.funFactText') }}</p>
      </div>
    </template>
    <template #support-small>
      <div class="fun-fact-panel-small">
        <Panel toggleable collapsed>
          <template #header>
            <img src="@/assets/images/mrcall/littleman/testimonial.svg" alt="MrCall" class="fun-fact-mascot-small" />
            <span class="fun-fact-header">{{ $t('views.onboarding.language.funFactTitle') }}</span>
          </template>
          <p class="fun-fact-text">{{ $t('views.onboarding.language.funFactText') }}</p>
        </Panel>
      </div>
    </template>
    <template #footer>
      <Button :label="$t('views.onboarding.language.moveForward')" @click="submit()" class="p-button-text md:w-auto py-3 w-full"/>
    </template>
  </OnboardingBase>
</template>

<script>
import OnboardingBase from "@/components/templates/onboarding/Base";
import {computed, ref} from "vue";
import router from "@/router";
import {useStore} from "vuex";
import businessUtils from "@/utils/Business";
import Tr from "@/i18n/translation";
import {useI18n} from "vue-i18n";

export default {
  components: {OnboardingBase},
  name: "OnboardingLanguage",
  setup: function () {
    const store = useStore();
    const { t, tm } = useI18n()

    const isoAlpha2Selection = computed(() => [
          {name: t('isoAlpha2Country.IT'), value: 'IT'},
          {name: t('isoAlpha2Country.US'), value: 'US'},
          {name: t('isoAlpha2Country.FR'), value: 'FR'},
          {name: t('isoAlpha2Country.ES'), value: 'ES'},
          {name: t('isoAlpha2Country.GB'), value: 'GB'},
          {name: t('isoAlpha2Country.DE'), value: 'DE'},
          {name: t('isoAlpha2Country.BR'), value: 'BR'},
          {name: t('isoAlpha2Country.PT'), value: 'PT'},
          {name: t('isoAlpha2Country.NO'), value: 'NO'},
          {name: t('isoAlpha2Country.CH'), value: 'CH'},
          {name: t('isoAlpha2Country.CA'), value: 'CA'},
          {name: t('isoAlpha2Country.AU'), value: 'AU'},
          {name: t('isoAlpha2Country.SW'), value: 'SW'},
          {name: t('isoAlpha2Country.FI'), value: 'FI'},
          {name: t('isoAlpha2Country.GR'), value: 'GR'},
          {name: t('isoAlpha2Country.TK'), value: 'TK'},
          {name: t('isoAlpha2Country.NL'), value: 'NL'},
          {name: t('isoAlpha2Country.DK'), value: 'DK'},
          {name: t('isoAlpha2Country.EE'), value: 'EE'}
        ]
    )

    const assistantLanguage = computed(() => [
          {name: t('languages.italian'), value: 'it-IT'},
          {name: t('languages.englishGB'), value: 'en-GB'},
          {name: t('languages.englishUS'), value: 'en-US'},
          {name: t('languages.spanishES'), value: 'es-ES'},
          {name: t('languages.spanishUS'), value: 'es-US'},
          {name: t('languages.frenchFR'), value: 'fr-FR'},
          {name: t('languages.germanDE'), value: 'de-DE'},
          {name: t('languages.portuguesePT'), value: 'pt-PT'},
          {name: t('languages.portugueseBR'), value: 'pt-BR'},
          {name: t('languages.norwegianNO'), value: 'no-NO'},
          {name: t('languages.swedishSW'), value: 'sw-SW'},
          {name: t('languages.finnishFI'), value: 'fi-FI'},
          {name: t('languages.greekGR'), value: 'el-GR'},
          {name: t('languages.turkeyTK'), value: 'tr-TK'},
          {name: t('languages.dutchNL'), value: 'nl-NL'},
          {name: t('languages.danishDK'), value: 'da-DK'},
          {name: t('languages.estonianEE'), value: 'et-EE'}
        ]
    )

    return {
      t,
      store,
      user: computed(() => store.state.user),
      router,
      assistantLanguage,
      isoAlpha2Selection,
      businessUtils
    }
  },
  data: function() {
    const onboardingData = this.store.state.onboardingData
    console.log("Onboarding: ", onboardingData);
    if(! onboardingData.business) {
      onboardingData.business = {
        variables: {
        }
      }
    }

    const langCode = computed(() => Tr.getLocale()) ;
    let isoAlpha2Selected = false ;
    const setCountryAlpha2 = (v) => {
      const e = this.isoAlpha2Selection.find((a) => {return a.value === v})
      if(e !== undefined) {
        onboardingData.business.countryAlpha2 = v
      } else {
        onboardingData.business.countryAlpha2 = 'US' //default
      }
    }

    const countryAlpha2 = computed({
      get: () => {
        console.debug("Called get countryAlpha2 with value:", onboardingData.business.countryAlpha2);
        return onboardingData.business.countryAlpha2;
      },
      set: (val) => {
        console.debug("Called set countryAlpha2 with value:", val, onboardingData.business.countryAlpha2);
        if(val !== onboardingData.business.countryAlpha2) {
          isoAlpha2Selected = true ;
          setCountryAlpha2(val) ;
        }
      }
    });

    const languageCountry = computed({
      get: () => {
        console.debug("Called get languageCountry with value:", onboardingData.business.languageCountry);
        return onboardingData.business.languageCountry;
      },
      set: (val) => {
        console.debug("Called set languageCountry with value:", val, onboardingData.business.languageCountry);
        if(val !== onboardingData.business.languageCountry) {
          onboardingData.business.languageCountry = val;
          if(! isoAlpha2Selected) {
            setCountryAlpha2(onboardingData.business.languageCountry
                .replace("_", "-").split("-")[1])
          }
        }
      }
    });
    if(! onboardingData.business.languageCountry) {
      languageCountry.value = langCode.value; //default
    }
    return {
      langCode,
      onboardingData,
      languageCountry,
      countryAlpha2,
      showSpinner: false
    }
  },
  methods: {
    async submit() {
      const self = this;
      self.showSpinner = true ;
      console.log("Submit with: ", self.onboardingData, self.showSpinner);
      this.$gtag.event("onboarding_chooselang_submit", {
        'user_email': self.user.email,
        'language': self.onboardingData.language
      })
      await self.refreshVariables();
      self.showSpinner = false ;
      this.router.push({
        name: "OnboardingNamePhone"
      })
    },
    async refreshVariables() {
      const self = this;
      console.debug("Selecting variables for: ",  this.languageCountry, this.langCode)
      await businessUtils.selectVariables(self.store.state.user,  this.languageCountry, this.langCode, "generic_onboarding")
          .then((result) => {
            console.debug("TemplateVariablesResult: ", result);
            self.onboardingData.variablesSpec = result ;
            return result;
          })
          .then((result) => {
            self.onboardingData.business = {
              languageCountry: this.languageCountry,
              countryAlpha2: this.countryAlpha2,
              timezoneStr: Intl.DateTimeFormat().resolvedOptions().timeZone,
              tested: "1970-01-01T00:00:00",
              onboarding: true,
              useDataForAi: false,
              variables: {
                EMAIL_BCC: ""
              }
            } ;
            businessUtils.setBusinessDefaultValues(self.onboardingData.business,
                "generic_onboarding",
                self.user.email,
                result
            );
            console.debug("DefaultBusiness:", this.onboardingData.business)
          });
    }
  },
  mounted() {
    const name = this.$route.query?.name;
    const businessPhoneNumber = this.$route.query?.businessPhoneNumber;
    console.debug(`passed data: name(${name}) businessPhoneNumber(${businessPhoneNumber})`)
    if(name) {
      this.onboardingData.passedName = name
    }
    if(businessPhoneNumber) {
      this.onboardingData.passedBusinessPhoneNumber = businessPhoneNumber
    }
  },
  created() {
    console.log("Language Called with: ", this.onboardingData);
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';
@import '../../assets/style/components/templates/onboarding_fun_fact';
</style>
