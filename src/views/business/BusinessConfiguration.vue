<template>
  <BusinessFrame :class="{ 'configure-ai-active': selectedMenupage?.collection?.id === '__CONFIGURE_AI__' }">
    <template #spinner>
      <ProgressBar v-show="showProgressBar" mode="indeterminate" style="height: 0.3em ; border-radius: 0;"/>
    </template>
    <template #messages>
      <Message v-if="message" :severity="message.severity" :sticky="message.sticky" :life="message.life"
               :key="message.id">{{message.content}}</Message>
    </template>
    <template #menu-large>
      <div class="tiered-menu-wrapper">
        <TieredMenu :model="itemsMenu">
        </TieredMenu>
      </div>
    </template>
    <template #menu-small>
      <div class="tiered-menu-wrapper">
        <TieredMenu TieredMenu ref="tieredmenu" id="overlay_tiered_menu" :model="itemsMenu" popup>
        </TieredMenu>
      </div>
      <div class="header_buttonbar">
        <div style="margin-left: auto">
          <Button type="button" :label="selectedMenupage?.collection.humanName || 'Menu'" icon="pi pi-bars" @click="toggle" aria-haspopup="true" aria-controls="overlay_tiered_menu" />
        </div>
      </div>
    </template>
    <template #beforetitle>
    </template>
    <template #title>
      {{selectedMenupage?.collection.humanName}}
    </template>
    <template #subtitle>
      {{selectedMenupage?.collection.description}}
    </template>
    <template #content>
      <ConfigureAIPanel
          v-if="selectedMenupage?.collection.id === '__CONFIGURE_AI__' && businessId"
          :business-id="businessId"
      />
      <div v-if="selectedMenupage?.collection.id === '__SEND_DATA__'" class="mb-4">
        <ConnectCalendar />
      </div>
      <template v-for="(page, index) in selectedMenupage?.variables" :key="index">
        <div v-if="hasVisibleVariables(page)" :class="page.length > 1 ? 'pageblock' : 'pageblock-noborder'">
          <template v-for="(variable, index) in page" :key="index">
            <template v-if="variable.name === 'serviceNumber'">
            </template>
            <template v-else-if="variable.name === 'emailAddress'">
            </template>
            <template v-else-if="variable.name === 'numberType'">
            </template>
            <template v-else-if="variable.name === 'businessPhoneNumber' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div class="mb-4 col-12">
                <label class="inputboxtitle"
                       :for="variable.name"
                       v-text="mandatoryParameterHumanName(variable)"
                ></label>
                <MazPhoneNumberInput
                    v-model="business.businessPhoneNumber"
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
                    :default-country-code="business.countryAlpha2"
                    :noFlags="false"
                    :noExample="false"
                    :preferred-countries="countryCodesMap.map((v) => v.country_code)"
                    :custom-countries-list="countryCodesMap.map((v) => v.country_code)"
                    :ignored-countries="['AC']"
                    @update="validatePhone"
                />
                <span class="inputboxsubtitle" v-html="variable.description"></span>
                <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                </div>
              </div>
            </template>
            <template v-else-if="variable.name === 'phoneProvider' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div class="mb-4 col-12">
                <label class="inputboxtitle"
                       :for="variable.name"
                       v-text="mandatoryParameterHumanName(variable)"
                ></label>
                <Dropdown
                    :disabled="!businessVariablesUtils.checkModifiable(variable, isAdmin)"
                    v-model="business.phoneProvider" :options="phoneOperators.operators(t)"
                    optionLabel="name"
                    optionValue="value"
                    :filter="true"
                    v-model:placeholder="variable.humanName" :showClear="true"
                    class="w-full"
                >
                  <template #option="slotProps">
                    <div>
                      <span>{{slotProps.option.name}}</span>
                    </div>
                  </template>
                </Dropdown>
                <span class="inputboxsubtitle" v-html="variable.description"></span>
                <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                </div>
              </div>
            </template>
            <template v-else-if="variable.type === 'meta:title'">
              <div
                  v-if="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="col-12 mb-4"
                  :class="{'hidden': !businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)}"
              >
                <div class="text-center mb-4">
                  <label class="inputboxtitle"
                         :for="variable.name"
                         v-text="mandatoryParameterHumanName(variable)"
                  ></label>
                  <span class="font-normal font-italic title text-sm" v-html="variable.description"></span>
                  <div v-if="variable.upgradeInformation">
                    <span  class="font-normal font-italic upgradeInformation text-sm" v-html="variable.upgradeInformation"></span>
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="variable.type === 'enum'">
              <div class="mb-4 col-12" :class="{'hidden': !businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode) || !businessVariablesUtils.shouldShowInput(business, variable)}">
                <label class="inputboxtitle"
                       :for="variable.name"
                       v-text="mandatoryParameterHumanName(variable)"
                ></label>
                <Dropdown :disabled="!businessVariablesUtils.checkModifiable(variable, isAdmin)"
                          v-model="business.variables[variable.name]" :options="variable.valuesSelection"
                          optionLabel="label"
                          optionValue="value"
                          :filter="true"
                          class="w-full"
                          v-model:placeholder="variable.humanName" :showClear="true"
                >
                  <template #option="slotProps">
                    <div>
                      <span>{{slotProps.option.label}}</span>
                    </div>
                  </template>
                </Dropdown>
                <span class="inputboxsubtitle" v-html="variable.description"></span>
                <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                </div>
              </div>
            </template>
            <template v-else-if="variable.type === 'string'">
              <div
                  v-if="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="col-12 mb-4"
                  :class="{'hidden': !businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)}"
              >
                <label class="inputboxtitle"
                       :for="variable.name"
                       v-text="mandatoryParameterHumanName(variable)"
                       :class="{'mb-1': variable.description}"
                ></label>
                <InputText v-if="variable['class'] === 'base'"
                           class="w-full"
                           :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                           :id="variable.name" type="text"
                           v-model="business[variable.name]"
                />
                <InputText v-else
                           class="w-full"
                           :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                           :id="variable.name" type="text"
                           v-model="business.variables[variable.name]"
                />
                <span class="inputboxsubtitle" v-html="variable.description"></span>
                <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                </div>
              </div>
            </template>
            <template v-else-if="variable.type === 'tuples' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div
                  v-if="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="col-12 mb-4"
                  :class="{'hidden': !businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)}"
              >
                <div>
                  <label class="inputboxtitle"
                         :for="variable.name"
                         v-text="mandatoryParameterHumanName(variable)"
                         :class="{'mb-1': variable.description}"
                  ></label>
                </div>
                <div>
                  <span class="inputboxsubtitle" v-html="variable.description"></span>
                </div>
                <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                </div>
                <TupleVariable v-model:recipient="business.variables[variable.name]" :variable="variable"></TupleVariable>
              </div>
            </template>
            <template v-else-if="variable.type === 'multiselect' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div
                  v-if="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="col-12 mb-4"
                  :class="{'hidden': !businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)}"
              >
                <div>
                  <label class="inputboxtitle"
                         :for="variable.name"
                         v-text="mandatoryParameterHumanName(variable)"
                         :class="{'mb-1': variable.description}"
                  ></label>
                </div>
                <div>
                  <span class="inputboxsubtitle" v-html="variable.description"></span>
                </div>
                <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                </div>
                <MultiselectVariable :business="business" :variable="variable"></MultiselectVariable>
              </div>
            </template>
            <template v-else-if="variable.type === 'templated' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div
                  v-if="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="col-12 mb-4"
                  :class="{'hidden': !businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)}"
              >
                <div>
                  <label class="inputboxtitle"
                         :for="variable.name"
                         v-text="mandatoryParameterHumanName(variable)"
                         :class="{'mb-1': variable.description}"
                  ></label>
                </div>
                <div>
                  <span class="inputboxsubtitle" v-html="variable.description"></span>
                </div>
                <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                </div>
                <TemplatedVariable :business="business" :variable="variable"></TemplatedVariable>
              </div>
            </template>
            <template v-else-if="variable.type === 'boolean' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div
                  v-if="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="mb-4 col-12"
              >
                <div style="display: flex; flex-direction: row;">
                  <div style="display: flex; flex-direction: column; padding: 0 1em 0 0;">
                    <div>
                      <ToggleSwitch v-if="variable['class'] === 'base'"
                                    :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                                    v-model="business[variable.name]"
                      />
                      <ToggleSwitch v-else
                                    :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                                    v-model="business.variables[variable.name]"
                      />
                    </div>
                    <div style="flex-grow: 1;"></div>
                  </div>
                  <div style="display: flex; flex-direction: column; margin-right: auto;">
                    <div>
                      <label class="inputboxtitle"
                             :for="variable.name"
                             v-text="mandatoryParameterHumanName(variable)"
                             :class="{'mb-1': variable.description}"
                      ></label>
                    </div>
                    <div>
                      <span class="inputboxsubtitle" v-html="variable.description"></span>
                    </div>
                    <div>
                      <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                      </div>
                    </div>
                    <div style="flex-grow: 1;"></div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="variable.type === 'number' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div
                  v-if="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="col-12 mb-4"
                  :class="{'hidden': !businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)}"
              >
                <label class="inputboxtitle"
                       :for="variable.name"
                       v-text="mandatoryParameterHumanName(variable)"
                       :class="{'mb-1': variable.description}"
                ></label>
                <Textarea v-if="variable['class'] === 'base'"
                          :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                          v-model="business[variable.name]"
                          class="w-full"
                />
                <InputNumber
                    v-else
                    class="w-full"
                    :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                    v-model="business.variables[variable.name]" mode="decimal"
                />
                <span class="inputboxsubtitle" v-html="variable.description"></span>
                <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                </div>
              </div>
            </template>
            <template v-else-if="variable.type === 'text' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div
                  v-if="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="col-12 mb-4"
                  :class="{'hidden': !businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)}"
              >
                <label class="inputboxtitle"
                       :for="variable.name"
                       v-text="mandatoryParameterHumanName(variable)"
                       :class="{'mb-1': variable.description}"
                ></label>
                <Textarea v-if="variable['class'] === 'base'"
                          :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                          v-model="business[variable.name]"
                          class="w-full"
                />
                <Textarea v-else
                          :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                          v-model="business.variables[variable.name]"
                          class="w-full"
                />
                <span class="inputboxsubtitle" v-html="variable.description"></span>
                <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                </div>
              </div>
            </template>
            <template v-else-if="variable.type === 'verbatim' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div
                  v-if="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="col-12 mb-4"
                  :class="{'hidden': !businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)}"
              >
                <label class="inputboxtitle"
                       :for="variable.name"
                       v-text="mandatoryParameterHumanName(variable)"
                       :class="{'mb-1': variable.description}"
                ></label>
                <Textarea v-if="variable['class'] === 'base'"
                          :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                          v-model="business[variable.name]"
                          class="w-full"
                />
                <Textarea v-else
                          :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                          v-model="business.variables[variable.name]"
                          class="w-full"
                />
                <span class="inputboxsubtitle" v-html="variable.description"></span>
                <div v-if="variable.upgradeInformation" class="inputboxsubtitle" v-html="variable.upgradeInformation">
                </div>
              </div>
            </template>
            <!-- BOOKING_HOURS, TALK_AND_HANGUP_HOURS widgect selected directly-->
            <template v-else-if="variable.name === 'BOOKING_HOURS' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <TimeSlotsEditor :business="business" :variable="variable" :slotDuration="Number(business.variables['BOOKING_EVENTS_MINUTES']) || 45"></TimeSlotsEditor>
            </template>
            <template v-else-if="variable.name === 'TALK_AND_HANGUP_HOURS' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <TimeSlotsEditor :business="business" :variable="variable" :slotDuration="60"></TimeSlotsEditor>
            </template>
            <!-- Agent Skills configurator (type: agent_skills) -->
            <template v-else-if="variable.type === 'agent_skills' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div
                  v-show="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="mb-4 col-12"
              >
                <label class="inputboxtitle"
                       :for="variable.name"
                       v-text="mandatoryParameterHumanName(variable)"
                ></label>
                <AgentSkillsConfigurator
                    v-model="business.variables[variable.name]"
                    :businessId="business.businessId || ''"
                    :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                />
                <span class="font-normal font-italic title text-sm" v-html="variable.description"></span>
              </div>
            </template>
            <template v-else-if="variable.type === 'json' && businessVariablesUtils.isVariableVisible(variable, isAdmin, advancedMode)">
              <div
                  v-show="businessVariablesUtils.shouldShowInput(business, variable)"
                  class="mb-4 col-12"
              >
                <label class="inputboxtitle"
                       :for="variable.name"
                       v-text="mandatoryParameterHumanName(variable)"
                ></label>
                <JsonEditorVue  v-if="variable['class'] === 'base'"
                                :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                                v-model="business[variable.name]"
                                v-bind="{/* local config */}"
                                mode="text"
                                class="w-full"
                />
                <JsonEditorVue  v-else
                                :disabled="businessVariablesUtils.checkIfDisabledByParentsDecorator(business, variable, isAdmin)"
                                v-model="business.variables[variable.name]"
                                v-bind="{/* local config */}"
                                mode="text"
                                class="w-full"
                />
                <span class="font-normal font-italic title text-sm" v-html="variable.description"></span>
                <div v-if="variable.upgradeInformation">
                  <span  class="font-normal font-italic upgradeInformation text-sm" v-html="variable.upgradeInformation"></span>
                </div>
              </div>
            </template>
          </template>
        </div>
      </template>
    </template>
    <template #footer>
      <div class="footer_buttonbar">
        <div class="footer-left-buttons">
          <Button
              v-if="isAdmin"
              @click="goToAladminConfigurator()" icon="pi pi-bolt"
              :label="t('components.business.aladminAI')"
              class="p-button-outlined"
          />
        </div>
        <div style="margin-left: auto">
          <Button
              @click="saveBusiness()" icon="pi pi-save"
              :label="t('components.business.saveButtonText')"
          />
        </div>
      </div>
    </template>
    <template #action-panel-large>
      <ActionPanel :business-id="businessId" :business="business" />
    </template>
    <template #action-panel-small>
      <ActionPanel :business-id="businessId" :business="business" />
    </template>
  </BusinessFrame>
</template>

<script>
import BusinessFrame from "@/components/templates/business/BusinessFrame";
import {computed, ref} from "vue";
import router from "@/router";
import {useStore} from "vuex";
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/firebase/config";
import {useI18n} from "vue-i18n";
import businessUtils from "@/utils/Business";
import businessVariablesUtils from "@/utils/BusinessVariables";
import Tr from "@/i18n/translation"
import parsePhoneNumber from "libphonenumber-js";
import phoneOperators from "@/utils/PhoneOperators";
import axios from "axios";
import TupleVariable from "../../components/widgets/TupleVariable.vue";
import TemplatedVariable from "../../components/widgets/TemplatedVariable.vue";
import MultiselectVariable from "../../components/widgets/MultiselectVariable.vue";
import TimeSlotsEditor from "@/components/widgets/TimeSlotsEditor.vue";
import AgentSkillsConfigurator from "@/components/widgets/AgentSkillsConfigurator.vue";
import ConnectCalendar from "@/components/ConnectCalendar.vue";
import ActionPanel from "@/components/ActionPanel.vue";
import ConfigureAIPanel from "@/components/ConfigureAIPanel.vue";
import SupportSection from "@/components/templates/support/SupportSection.vue";

export default {
  components: { TimeSlotsEditor, AgentSkillsConfigurator, TupleVariable, TemplatedVariable, MultiselectVariable, BusinessFrame, ConnectCalendar, SupportSection, ActionPanel, ConfigureAIPanel},
  name: "OnboardingChooseDevice",
  setup: function () {
    const store = useStore();
    const isWebView = computed(() => store.state.isWebview) ;
    const isMobile = computed(() =>
            (screen.width <= 640) || (window.matchMedia &&
                window.matchMedia('only screen and (max-width: 640px)').matches
            )
    ) ;

    const tieredmenu = ref()
    const toggle = (event) => {
      tieredmenu.value.toggle(event);
    };

    const itemsMenu = ref()
    const showProgressBar = ref(false)

    return {
      router,
      phoneOperators,
      user: computed(() => store.state.user),
      userVerified: computed(() => store.state.userVerified),
      authIsReady: computed(() => store.state.authIsReady),
      isAdmin: computed(() => store.state.role === 'admin'),
      showProgressBar,
      tieredmenu,
      toggle,
      itemsMenu,
      store,
      isMobile,
      isWebView,
      businessVariablesUtils
    }
  },
  computed: {
    pageSelection: {
      set(value) {
        this.selectedMenupage = value ;
      },
      get() {
        console.debug("Annotations: ", this.variablesAnnotations)
        return this.selectedMenupage ;
      }
    },
  },
  data: function() {
    const { t } = useI18n()
    const message = undefined
    let selectedMenupage = ref()

    const countryCodesMap = [
      {name: 'Italy', flag_code: 'it', country_code: 'IT', lang_code: 'it-IT'},
      {name: 'United Kingdom', flag_code: 'gb', country_code: 'GB', lang_code: 'en-GB'},
      {name: 'United States', flag_code: 'us', country_code: 'US', lang_code: 'en-US'},
      {name: 'Spain', flag_code: 'es', country_code: 'ES', lang_code: 'es-ES'},
      {name: 'France', flag_code: 'fr', country_code: 'FR', lang_code: 'fr-FR'},
      {name: 'Germany', flag_code: 'de', country_code: 'DE', lang_code: 'de-DE'}
    ]

    const businessId = ref()
    const business = ref()
    const variablesAnnotations = ref({})
    const langCode = computed(() => Tr.getLocale()) ; //UI language 
    const allowedLangs = ["it", "en", "de", "es", "pt", "fr"];
    const variablesLangCode = computed(() => {
      const bizLang = business.value?.languageCountry ?? "";
      const bizPrefix = bizLang.slice(0, 2).toLowerCase();

      if (allowedLangs.includes(bizPrefix)) {
        return bizLang;
      }

      const lc = (langCode?.value ?? "").toString(); // if langCode is a Ref, use .value
      const codePrefix = lc.slice(0, 2).toLowerCase();
      if (allowedLangs.includes(codePrefix)) {
        return lc;
      }

      return "en-US";
    });


    const serviceNumber = computed(() => business.value.serviceNumber || '')
    let businessPhoneNumberValid = false ;
    const isOnboarding = computed(() =>
        business.value ? business.value.onboarding : false
    )

    return {
      t,
      advancedMode: true, //TODO: implement the toggle
      langCode,
      variablesLangCode,
      businessId,
      business,
      variablesAnnotations,
      serviceNumber,
      businessPhoneNumberValid,
      isOnboarding,
      selectedMenupage,
      message,
      countryCodesMap,
    }
  },
  methods: {
    validatePhone(value) {
      if(value.isValid) {
        const phoneNumber = value.e164
        this.business.businessPhoneNumber = phoneNumber
        this.business.numberType = this.telephoneNumberType(phoneNumber)
        this.businessPhoneNumberValid = true ;
      } else {
        this.businessPhoneNumberValid = false ;
      }
    },
    hasVisibleVariables(page) {
      if (!page || !this.business) return false
      return page.some(v =>
        !v.type.startsWith('meta:') &&
        this.businessVariablesUtils.isVariableVisible(v, this.isAdmin, this.advancedMode) &&
        this.businessVariablesUtils.shouldShowInput(this.business, v)
      )
    },
    telephoneNumberType(number) {
      const phoneNumber = parsePhoneNumber(number)
      const numberType = phoneNumber.getType()
      if(numberType)
        return numberType.toLowerCase()
      return 'unknown'
    },
    mandatoryParameterHumanName(variable) {
      var suffix = ""
      if (variable.admin && variable.mandatory) {
        suffix = " (ADMIN)*"
      } else if (variable.admin) {
        suffix = " (ADMIN)"
      } else if(variable.mandatory) {
        suffix = "*"
      }

      if(! variable.modifiable && this.isAdmin) {
        suffix += ' (__not_modifiable__)'
      }

      if(variable.type.startsWith("meta") && this.isAdmin) {
        suffix += ' (__meta__)'
      }

      if(! variable.visible && this.isAdmin) {
        suffix += ' (__hidden__)'
      }

      return variable.humanName + suffix
    },
    verifyVariables(business) {
      let errors = []
      this.variablesAnnotations.map((collection) => {
        collection.variables.flat().map((variable) => {
          const businessValue =
              variable.class === 'base' ? business[variable.name] : business.variables[variable.name]
          if(variable.mandatory &&
              (businessValue === "" ||
                  businessValue === undefined ||
                  businessValue === null
              )) {
            errors.push({ variable: variable })
          }
        })
      })
      return errors
    },
    goToAladminConfigurator() {
      this.$router.push({
        name: 'AladminConfigurator',
        query: { id: this.businessId }
      });
    },
    saveBusiness() {
      this.showProgressBar = true
      if(!this.businessPhoneNumberValid) {
        this.business.businessPhoneNumber = null;
      }
      if(this.business === null) {
        this.setMessage("error", this.t("components.business.unableToSave"))
        console.error("Impossible to save the plan")
        this.showProgressBar = false
        return
      }

      const varErrors = this.verifyVariables(this.business)
      if(varErrors.length > 0) {
        const head = varErrors[0]

        if(head.variable.class === 'base') {
          this.activeIndexTabPanel = 0
          this.activeIndexAccordionTab = 0
        } else {
          this.activeIndexTabPanel = 1
          this.activeIndexAccordionTab = 1
        }
        this.setMessage("error",
            this.t("components.business.mandatoryParameterMissing", {param: head.variable.humanName})
        )
        console.error("Impossible to save the plan because of missing mandatory variables:", varErrors)
        this.showProgressBar = false
        return
      }

      let headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      const convertedBusiness = businessVariablesUtils.businessVariablesToSerializable(this.business)
      console.debug("BUSINESS TO SAVE:", convertedBusiness)
      let operation = undefined
      if(this.business.businessId) {
        console.debug("Update operation: ", this.business.businessId)
        operation = axios.put(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business", //FIXME: this is for CORS, use different configuration in production
            convertedBusiness,
            {
              headers: headers
            }
        )
      } else {
        console.debug("Create operation")
        operation = axios.post(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business",
            convertedBusiness,
            {
              headers: headers
            }
        )
      }
      operation.then((response) => {
        console.debug("Saved Response:", response)
        this.showProgressBar = false
        if(response.headers["x-mrcall-role"] === "admin") {
          this.store.commit('setRole', 'admin')
        } else {
          this.store.commit('setRole', 'owner')
        }
        if(response.status === 201 || response.status === 200) {
          this.business.businessId = response.data.result.businessId
          this.setMessage("success", this.t('components.business.settingsSuccessfullySaved'), false, 5000)
        }
        //this.selectVariables()
      }).catch((error) => {
        this.showProgressBar = false
        this.setMessage("error", this.t('components.business.errorSavingSettings') + "(" + error.message + ")")
        console.error(error)
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          router.replace('/login')
        }
      })
    },
    ///
    async switchToMenupage(id = undefined) {
      const CONFIGURE_AI_ID = '__CONFIGURE_AI__'
      const resolvedId = id ?? CONFIGURE_AI_ID
      if (resolvedId === CONFIGURE_AI_ID) {
        console.log("Switch to Configure AI Menupage")
        this.pageSelection = {
          collection: {
            id: CONFIGURE_AI_ID,
            humanName: this.t('components.business.configureViaChat'),
            description: '',
          },
          variables: [],
        }
      } else {
        console.log("Switch to Menupage:", resolvedId)
        this.pageSelection = this.variablesAnnotations.find((obj) => {
          return obj.collection.id === resolvedId ;
        });
      }
      if (this.itemsMenu) {
        await this.updateMenu()
      }
    },
    async updateMenu() {
      const menuGroups = {
        '__CONVERSATION__': 'assistant',
        '__KNOWLEDGE_BASE__': 'assistant',
        '__BOOKING__': 'assistant',
        '__DONT_DISTURB__': 'assistant',
        '__MRCALL_FORWARDING__': 'calls',
        '__NOTIFICATIONS__': 'calls',
        '__CALLER_FOLLOWUP__': 'calls',
        '__SEND_DATA__': 'calls',
        '__BUSINESS_DATA__': 'business',
        '__INVOICING__': 'business',
        '__GENERAL__': 'business',
        '__RUNTIME_DATA_MANAGEMENT__': 'advanced',
        '__OSCAR__': 'advanced',
        '__FORWARDING_PROBLEMS__': 'advanced',
        '__LANGUAGE__': 'advanced',
      }

      const selectedId = this.selectedMenupage?.collection?.id
      const CONFIGURE_AI_ID = '__CONFIGURE_AI__'
      const configureAiItem = {
        label: this.t('components.business.configureViaChat'),
        icon: 'pi pi-fw pi-comments',
        _collectionId: CONFIGURE_AI_ID,
        class: selectedId === CONFIGURE_AI_ID ? 'active-menu-item' : undefined,
        command: () => {
          this.switchToMenupage(CONFIGURE_AI_ID)
        },
        visible: () => true,
      }
      const rawItems = this.variablesAnnotations.map((item) => {
            console.debug("Collection: ", item)
            let icon = "pi pi-fw pi-box"
            if(item.collection.defaultValue) {
              icon = `pi pi-fw ${item.collection.defaultValue}`
            }
            return {
              label: item.collection.humanName,
              icon: icon,
              _collectionId: item.collection.id,
              class: item.collection.id === selectedId ? 'active-menu-item' : undefined,
              command: () => {
                this.switchToMenupage(item.collection.id)
              },
              visible: () => {
                return true ;
              }
            }
          }
      )

      // Insert separators between groups
      const result = [configureAiItem]
      let lastGroup = 'assistant'
      for (const item of rawItems) {
        const group = menuGroups[item._collectionId] || 'other'
        if (lastGroup && group !== lastGroup) {
          result.push({ separator: true })
        }
        result.push(item)
        lastGroup = group
      }
      this.itemsMenu = result
    },
    async initializePage() {
      console.debug("Called selectVariables");
      this.showProgressBar = true
      this.businessId = this.$route.query?.id;
      businessUtils.getBusiness(this.store, this.user, this.businessId) //1- fetch business
          .then(business => { //2- fetch variables
            this.business = business
            if(! business) {
              const message = this.t("components.business.configuration.businessNotFound")
              throw new Error(message)
            }
            const templateName = business.template
            this.businessPhoneNumberValid = true
            return businessUtils.selectVariables(this.user, this.variablesLangCode, this.langCode, templateName)
                .catch((error) => {
                  this.showProgressBar = false
                  this.setMessage("error", `${this.t("components.business.configuration.errorRetrievingDataMessage")} : ${error.message}`)
                  console.error(error)
                })
          }).then(async (variablesAnnotations) => { //3- populate local business
        this.variablesAnnotations = variablesAnnotations
        this.showProgressBar = false
        businessUtils.setBusinessDefaultValues(this.business,
            this.business.template,
            this.user.email,
            this.variablesAnnotations
        )
        await this.updateMenu() //set menu values
        await this.switchToMenupage()
        console.debug("VariablesAnnotations: ", this.variablesAnnotations)
      }).catch((error) => {
        this.showProgressBar = false
        this.setMessage("error", `${this.t("components.business.configuration.errorRetrievingDataMessage")} : ${error.message}`)
        console.error(error)
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          //router.push('/login')
        }
      })
    },
    async setMessage(severity, content, sticky = true, life = 0) {
      //severity: success, info, warn, error
      const id = Date.now()
      this.message = {
        id: id,
        severity: severity,
        content: content,
        sticky: sticky,
        life: life
      }
    },
  },
  mounted() {
    const self = this;
    if(! self.store.state.user) {
      onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified && !user.isAnonymous) {
          console.debug("UserStateChanged:", user)
          self.initializePage();
        }
      })
    } else {
      self.initializePage();
    }
  },
  created() {
    console.log("BusinessConfiguration Called");
  },
  beforeUnmount() {
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/configuration_items';

.pageblock {
  padding: 2em;
  border: 1px;
  margin: 0 0 1em 0;
  border-radius: 6px;
  border-color: @mrcall_borders;
  border-style: solid;

  //phone number inputbox
  --maz-font-family: 'Inter',serif, 'primeicons';
  --maz-border-radius: 3px;
  --maz-border-width: 1px;
}

.pageblock-noborder {
  padding: 2em;
  border: 0;
  margin: 0 0 1em 0;

  //phone number inputbox
  --maz-font-family: 'Inter',serif, 'primeicons';
  --maz-border-radius: 3px;
  --maz-border-width: 1px;
}

.header_buttonbar {
  width: 100%;
  display: flex;
  flex-direction: row;
}

.footer_buttonbar {
  width: 100%;
  display: flex;
  flex-direction: row;
}

.footer-left-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tiered-menu-wrapper {
  overflow: scroll;

  :deep(.p-tieredmenu-item.active-menu-item) > .p-tieredmenu-item-content {
    background: #e9ecef;
    border-radius: 4px;
  }
}

.configure-ai-active {
  :deep(#mrcall-configuration-central-section #content) {
    max-width: none !important;
    padding: 0 !important;
    overflow: hidden !important;
  }
  :deep(#footer) {
    display: none !important;
  }
}

@media screen and (max-width: 640px) {
  .pageblock-noborder {
    padding: 0.5em;
  }

  .pageblock {
    padding: 0.5em;
  }
}

@media screen and (min-width: 640px) {
}

.mrCallLogo {
  width: 12rem;
  height: 4rem;
}



</style>
