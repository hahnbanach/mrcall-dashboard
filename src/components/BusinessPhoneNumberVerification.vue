<template>
  <transition-group name="p-message" tag="div">
    <Message v-if="message" :severity="message.severity" :life="10000" :sticky="false" :key="message.id">{{message.content}}</Message>
  </transition-group>
  <div v-if='business.businessId' class="business-phone-verification formrow text-center mx-auto">
    <div v-if="! businessVerified">
      <p class="title">{{t('components.businessphonenumberverification.assistantWasCreated')}}</p>
      <!--
      <p class="subtitle underline">{{t('components.businessphonenumberverification.callTheNumberInstructions1')}}</p>
      -->
      <p class="text-lg mt-6">{{t('components.businessphonenumberverification.callTheNumberInstructions2a')}} ({{businessPhoneNumberValue}}) {{t('components.businessphonenumberverification.callTheNumberInstructions2b')}}:</p>
      <div v-if="isWebView" class="my-4">
        <div class="title text-lg font-bold">{{serviceNumber}}</div>
      </div>
      <div v-else class="my-4">
        <a :href="'tel:' + serviceNumber" class="title text-lg font-bold">{{serviceNumber}}</a>
      </div>
      <p class="text-lg">{{t('components.businessphonenumberverification.callTheNumberInstructions3')}}</p>
      <Button @click="justTested()" class="mt-4" icon="pi pi-check-circle" :label="t('components.businessphonenumberverification.justVerifiedTheNumberButton')" />
      <div>
        <br>
        <p class="title text-lg">{{t('components.businessphonenumberverification.businessPhoneNumberTitle')}}</p>
        <MazPhoneNumberInput
            v-model="businessPhoneNumber"
            show-code-on-list
            color="info"
            :fetch-country="true"
            :translations="{
                        countrySelector: {
                          placeholder: t('components.businessphonenumberverification.phoneNumberCountrySelectorPlaceholder'),
                          error: t('components.businessphonenumberverification.phoneNumberCountrySelectorError'),
                        },
                        phoneInput: {
                          placeholder: t('components.businessphonenumberverification.phoneNumberPhoneInputPlaceholder'),
                          example: t('components.businessphonenumberverification.phoneNumberPhoneInputExample'),
                        }
                      }"
            :default-phone-number="business.businessPhoneNumber"
            :preferred-countries="countryCodesMap.map((v) => v.country_code)"
            :ignored-countries="['AC']"
            @update="businessPhoneNumberResults = $event"
            :success="businessPhoneNumberResults?.isValid"
        />
        <Button @click="saveBusiness()" class="mt-4" icon="pi pi-check-circle" :label="t('components.businessphonenumberverification.changeBusinessPhoneNumberButtonLabel')" />
      </div>
    </div>
    <div v-else>
      <p class="title">{{t('components.businessphonenumberverification.afterNumberVerificationTitle1')}}</p>
      <p class="text-lg mt-6" v-html="t('components.businessphonenumberverification.afterNumberVerificationTitle2')">
      </p>
      <Button class="mt-4" @click="personalizeBusiness()" icon="pi pi-check-circle" :label="t('components.businessphonenumberverification.gotoBusinessesCustomize')" />
    </div>
  </div>
</template>

<script>
import {computed, ref} from "vue";
import axios from "axios";
import router from "@/router";
import {useStore} from "vuex";
import parsePhoneNumber from "libphonenumber-js";
import {useI18n} from "vue-i18n";

export default {
  name: "BusinessPhoneNumberVerification",
  data: function () {
    const store = useStore()
    const user = computed(() => store.state.user)
    const business = computed(() => store.state.selectedBusiness)
    const { t, tm } = useI18n()

    const pageTexts = {
      it: {
        businessPhoneNumberTitle: "Hai inserito un numero errato? Puoi cambiarlo",
        phoneNumberCountrySelectorPlaceholder: "Codice paese",
        phoneNumberCountrySelectorError: "Errore",
        phoneNumberPhoneInputPlaceholder: "Numero di telefono",
        phoneNumberPhoneInputExample: "Esempio: ",
        businessPhoneNumberIsNotValid: "Controlla di aver inserito correttamente il tuo numero di telefono",
        settingsSuccessfullySaved: "Impostazioni salvate correttamente",
        errorSavingSettings: "Ci sono stati dei problemi nel salvataggio",
        changeBusinessPhoneNumberButtonLabel: "Cambia",
        gotoBusinessesCustomize: "Personalizza",
        justVerifiedTheNumberButton: "Ho chiamato",
        assistantWasCreated: "Verifica il tuo telefono e lascia un messaggio.",
        callTheNumberInstructions1: "Questo è solo un assistente di test, nulla deve essere installato o configurato sul tuo telefono.",
        callTheNumberInstructions2a: "Chiama questo numero dal tuo numero",
        callTheNumberInstructions2b: "e ricevi la notifica via mail",
        callTheNumberInstructions3: "Clicca ‘Ho chiamato’ e comincia a configurare il tuo assistente.",
        afterNumberVerificationTitle1: "Ben fatto!",
        afterNumberVerificationTitle2: "Ora puoi cominciare a configurare il tuo assistente.",
        seemsYouDidntCall: "Sembra che tu non abbia ancora chiamato per la verifica del numero.",
        issuesContactCustomerService: "C'è stato un errore, per favore contatta l'assistenza a customer.service@mrcall.it"
      }
    }

    const serviceNumber = computed(() => business.value.serviceNumber || '') ;

    const isWebView = computed(() => store.state.isWebview)

    const businessPhoneNumberResults = ref() ;
    const businessPhoneNumberValue = computed(() => business.value.businessPhoneNumber) ;

    function telephoneNumberType(number) {
      const phoneNumber = parsePhoneNumber(number)
      const numberType = phoneNumber.getType()
      if(numberType)
        return numberType.toLowerCase()
      return 'unknown'
    }

    let businessPhoneNumber = computed({
          get: () => business.value.businessPhoneNumber,
          set: () => {
            console.log("EVENT1: ", businessPhoneNumberResults)
            console.log("EVENT2: ", businessPhoneNumberResults.value)
            if(businessPhoneNumberResults.value.isValid) {
              const phoneNumber = businessPhoneNumberResults.value.e164
              business.value.businessPhoneNumber = phoneNumber
              business.value.numberType = telephoneNumberType(phoneNumber)
              business.value.emailAddress = user.value.email
              business.value.variables.SMS_TO_NUMBER = phoneNumber
              business.value.variables.EMAIL_TO = user.value.email

              const addPhoneEventData = {
                'user_email': user.value.email,
                'template_name': this.business.template,
                'phone_number': phoneNumber,
                'mode': 'manual'
              }
              console.debug("Submitting fix_phone_number event: ", addPhoneEventData);
              this.$gtag.event("fix_phone_number", addPhoneEventData);
            } else {
              business.value.businessPhoneNumber = null
            }
          }
        }
    )

    const countryCodesMap = [
      {name: 'Italy', flag_code: 'it', country_code: 'IT', lang_code: 'it-IT'},
      {name: 'United Kingdom', flag_code: 'gb', country_code: 'UK', lang_code: 'en-GB'},
      {name: 'Spain', flag_code: 'es', country_code: 'ES', lang_code: 'es-ES'},
      {name: 'France', flag_code: 'fr', country_code: 'FR', lang_code: 'fr-FR'},
      {name: 'Germany', flag_code: 'de', country_code: 'DE', lang_code: 'de-DE'}
    ]

    return {
      t,
      tm,
      business,
      businessPhoneNumber,
      businessPhoneNumberResults,
      businessPhoneNumberValue,
      countryCodesMap,
      store,
      isWebView,
      businessVerified: false,
      showProgressBar: false,
      message: null,
      user,
      serviceNumber,
      pageTexts
    }
  },
  methods: {
    setMessage(severity, content) {
      const id = Date.now()
      this.message = {
        id: id,
        severity: severity,
        content: content,
      }
    },
    personalizeBusiness() {
      this.store.commit('setSelectedBusiness', this.business)
      router.push({
        name: "Business",
        params: {
        }
      })
    },
    setSelectedBusiness() {
      this.store.commit('setSelectedBusiness', this.business)
    },
    saveBusiness() {
      if(! this.business.businessPhoneNumber) {
        this.setMessage("error", this.t('components.businessphonenumberverification.businessPhoneNumberIsNotValid'))
        return
      }

      this.showProgressBar = true
      let headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      console.debug("BUSINESS TO SAVE:", this.business)
      console.debug("Create operation")
      const operation = axios.put(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business",
          {
            businessId: this.business.businessId,
            businessPhoneNumber: this.business.businessPhoneNumber,
            serviceNumber: this.business.serviceNumber,
            languageCountry: this.business.languageCountry,
            variables: {
              SMS_TO_NUMBER: this.business.businessPhoneNumber
            }
          },
          {
            headers: headers
          }
      )
      operation.then((response) => {
        console.debug("Saved Response:", response)
        this.showProgressBar = false
        if(response.status === 201 || response.status === 200) {
          this.business.businessId = response.data.result.businessId
          if(this.isOnboarding) {
            console.debug("Visualizing onboarding modal dialog")
            this.onboardingConfirmEditDialogVisible = true
          } else {
            this.setMessage("success", this.t('components.businessphonenumberverification.settingsSuccessfullySaved'))
          }
        }
      }).catch((error) => {
        this.showProgressBar = false
        this.setMessage("error", this.t('components.businessphonenumberverification.errorSavingSettings') + "(" + error.message + ")")
        console.error(error)
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          router.replace('/signin')
        }
      })
    },
    justTested() {
      this.showProgressBar = true;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      axios.get(
          process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business?id=" + this.business.businessId,
          {
            headers: headers
          }
      ).then((response) => {
        console.debug("Get business: ", response)
        if(response.data) {
          const item = response.data.find(e => typeof e !== 'undefined')
          console.debug("Item: ", item)
          if(item && item.tested && item.tested.replace(" ", "T") !== "1970-01-01T00:00:00") {
            this.businessVerified = true
          } else {
            this.setMessage("error", this.t('components.businessphonenumberverification.seemsYouDidntCall'))
            this.businessVerified = false
          }
          this.store.commit('setSelectedBusiness', item)
          console.debug("Business: ", this.business)
          this.setSelectedBusiness()
        } else {
          this.setMessage("error", this.t('components.businessphonenumberverification.issuesContactCustomerService'))
          this.businessVerified = false
        }
        this.$gtag.event("verified_phone", {
          'user_email': this.user.email,
          'verification_result': this.businessVerified
        });
        this.showProgressBar = false
      }).catch((error) => {
        console.error("Getting business: ", error)
        this.showProgressBar = false
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          router.replace('/signin')
        }
      })
    },
    mounted () {
      console.debug("BusinessPhoneNumberVerification Mounted")
    }
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

.formrow {
  padding: 1em;
}

.title {
  font-size: 1em;
  font-weight: bold;
  color: @mrcall_blue;
}
.subtitle {
  font-size: 1em;
  font-weight: normal;
  color: @mrcall_blue;
}
.underline {
  text-decoration: underline;
}
</style>
