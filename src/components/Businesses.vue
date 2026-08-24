<template>
  <Toast></Toast>
  <ProgressBar v-show="showProgressBar" mode="indeterminate" style="height: .3em"/>
  <div v-if="user" class="businesses-page">

    <!-- Reseller Owner Selector -->
    <OwnerSelector v-if="isReseller" />

    <!-- Toolbar -->
    <div class="businesses-toolbar">
      <Paginator
          :template="{
            '640px': 'PrevPageLink CurrentPageReport NextPageLink',
            '960px': 'FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
            '1300px': 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink',
            default: 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink JumpToPageDropdown RowsPerPageDropdown'
          }"
          :alwaysShow="false"
          :rows="size"
          v-model:first="first"
          :rowsPerPageOptions="[10,20,30,50,100]"
          :totalRecords="totalHits"
          @page="onPage($event)">
      </Paginator>

      <div v-if="isAdmin" class="toolbar-admin-sort">
        <MultiSelect
            v-model="selectedSubscriptionStatus"
            :options="subscriptionStatusValueLabelMap"
            optionLabel="name"
            @change="onSortFieldsChange"
            :maxSelectedLabels="3"
            placeholder="Select field to sort results"
        />
        <Dropdown v-model="selectedSortOption" :options="sortOptions"
                  @change="onSortOrderChange"
                  optionLabel="name" optionValue="value" placeholder="Sort by" />
      </div>

      <div v-if="isAdmin || totalHits > size" class="toolbar-search">
        <div class="toolbar-search-inputs">
          <Dropdown v-model="matchFieldMapValue" :options="matchFieldMap"
                    optionLabel="name" optionValue="value" placeholder="Filter by" />
          <IconField class="toolbar-search-field">
            <InputText
                class="w-full"
                :disabled="false"
                type="string"
                v-on:keyup.enter="onUpdateMatchFieldMapQueryValue()"
                v-model="matchFieldMapQueryValue"
            />
            <InputIcon class="pi pi-search" />
          </IconField>
          <Button
              :label="$t('components.businesses.addFieldMatch')"
              icon="pi pi-search-plus" iconPos="right"
              @click="onUpdateMatchFieldMapQueryValue()" />
        </div>
        <Button
            v-if="isAdmin"
            :label="$t('components.businesses.platformAnalyticsButtonLabel')"
            icon="pi pi-chart-bar" iconPos="right"
            severity="info"
            @click="router.push('/analytics-admin')" />
      </div>
    </div>

    <!-- Business Cards -->
    <div class="business-cards">
      <div v-for="([key, business], index) in filteredBusinesses" :key="key" class="business-card">

        <!-- Overlay (kept but currently disabled) -->
        <div v-if="showBusinessOverlay(business)" class="business-card-overlay">
          <div class="overlay-button-panel">
            <Button
                :label="$t('components.businesses.onboardinConfigureAndTest')" icon="pi pi-pencil" iconPos="right"
                @click="router.push(`/onboardingmakeatestcall?id=${business.businessId}`)"
            />
            <Button
                :label="$t('components.businesses.onboardingActivateAssistant')" icon="pi pi-pencil" iconPos="right"
                @click="router.push(`/onboardingchooseplan?id=${business.businessId}`)"
            />
          </div>
        </div>

        <!-- Card Header -->
        <div class="card-header">
          <h2 class="card-company-name">{{ business.companyName }}</h2>
          <span v-if="isReseller && getOwnerName(business.owner)" class="owner-badge">
            <i class="pi pi-user"></i> {{ getOwnerName(business.owner) }}
          </span>
          <span v-if="subscriptionInfo[business.businessId]?.status"
                class="status-badge status-clickable"
                :class="'status-' + getStatusSeverity(subscriptionInfo[business.businessId].status)"
                @click="editPlan(key)">
            {{ $t(`components.businesses.form.subscriptionStatusLabels.${subscriptionInfo[business.businessId].status}`) }}
          </span>
        </div>

        <!-- Activation Banner -->
        <div v-if="isActivationPending(business)" class="activation-banner">
          <div class="activation-banner-content">
            <div class="activation-banner-text">
              <div class="activation-banner-title">{{ $t('components.businesses.activationBanner.title') }}</div>
              <div class="activation-banner-subtitle">{{ $t('components.businesses.activationBanner.subtitle') }}</div>
            </div>
            <Button
                :label="$t('components.businesses.activationBanner.cta')"
                icon="pi pi-play" iconPos="right"
                @click="editPlan(key)"
            />
          </div>
        </div>

        <!-- Service Number Banner -->
        <div v-if="business.serviceNumber && !isActivationPending(business)" class="service-number-banner">
          <div class="service-number-content">
            <i class="pi pi-phone service-number-icon"></i>
            <div class="service-number-details">
              <span class="service-number-label">
                {{ $t('components.businesses.form.serviceNumber') }}
              </span>
              <span v-if="isWebView" class="service-number-value">
                {{ getCleanServiceNumber('', business.serviceNumber) }}
              </span>
              <a v-else :href="getCleanServiceNumber('tel:', business.serviceNumber)" class="service-number-value">
                {{ getCleanServiceNumber('', business.serviceNumber) }}
              </a>
            </div>
          </div>
          <span v-if="(subscriptionInfo[business.businessId]?.status === 'TRIALING' ||
                        subscriptionInfo[business.businessId]?.status === 'ACTIVE') &&
                        subscriptionInfo[business.businessId]?.testNumber === true"
                class="service-number-warning">
            {{ $t('components.businesses.numberNotAssignedContactSupport') }}
          </span>
        </div>

        <!-- Info Grid -->
        <div class="info-grid">
          <div v-if="business.businessId && isAdmin" class="info-item">
            <span class="info-label"><i class="pi pi-id-card"></i> {{ $t('components.businesses.form.businessId') }}</span>
            <span class="info-value">{{ business.businessId }}</span>
          </div>
          <div v-if="business.nickname && business.nickname !== business.companyName" class="info-item">
            <span class="info-label"><i class="pi pi-tag"></i> {{ $t('components.businesses.form.nickname') }}</span>
            <span class="info-value">{{ business.nickname }}</span>
          </div>
          <div v-if="business.emailAddress && isAdmin" class="info-item">
            <span class="info-label"><i class="pi pi-envelope"></i> {{ $t('components.businesses.form.email') }}</span>
            <span class="info-value">{{ business.emailAddress }}</span>
          </div>
          <div v-if="business.businessPhoneNumber" class="info-item">
            <span class="info-label">
              <i class="pi pi-mobile"></i> {{ $t('components.businesses.form.businessPhoneNumber') }}
            </span>
            <span class="info-value">{{ business.businessPhoneNumber }}</span>
          </div>
          <div v-if="business.template && templates[business.template]" class="info-item">
            <span class="info-label"><i class="pi pi-box"></i> {{ $t('components.businesses.form.plan') }}</span>
            <span class="info-value">{{ business.template.endsWith('_onboarding') ? 'Onboarding' : templates[business.template].humanName }}</span>
          </div>
          <div v-if="subscriptionInfo[business.businessId]?.status === 'ACTIVE' &&
                      !subscriptionInfo[business.businessId]?.secondsToExpiration &&
                      subscriptionInfo[business.businessId]?.currentPeriodEnd" class="info-item">
            <span class="info-label"><i class="pi pi-calendar"></i> {{ $t('components.businesses.form.renewalDateTime') }}</span>
            <span class="info-value">{{ timestampToDateTime(business) }}</span>
          </div>
          <div v-if="subscriptionInfo[business.businessId]?.secondsToExpiration" class="info-item">
            <span class="info-label"><i class="pi pi-clock"></i> {{ $t('components.businesses.form.trial') }}</span>
            <span class="info-value">{{ Math.round(subscriptionInfo[business.businessId].secondsToExpiration / (24 * 3600)) }}</span>
          </div>
          <div v-if="counterResources[business.businessId]" class="info-item">
            <span class="info-label">
              <i class="pi pi-bolt"></i> {{ $t('mrcallCredits.title') }}
              <i
                class="pi pi-info-circle credits-info-icon"
                v-tooltip.bottom="$t('mrcallCredits.tooltip', { factor: creditTooltipFactor(business) })"
              ></i>
            </span>
            <span class="info-value">{{ creditsToEuro(counterResources[business.businessId]['CALLCREDIT']) }}</span>
          </div>
          <div v-if="counterResources[business.businessId]" class="info-item">
            <span class="info-label"><i class="pi pi-comment"></i> {{ $t('components.businesses.form.resourcesSmsCount') }}</span>
            <span class="info-value">{{ counterResources[business.businessId]['SMS'] }}</span>
          </div>
        </div>

        <!-- Health Summary Strip -->
        <div class="health-strip">
          <span :class="['health-pill', ['ACTIVE','TRIALING','FREE'].includes(subscriptionInfo[business.businessId]?.status) ? 'health-ok' : 'health-warn']">
            <i :class="['ACTIVE','TRIALING','FREE'].includes(subscriptionInfo[business.businessId]?.status) ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"></i>
            {{ ['ACTIVE','TRIALING','FREE'].includes(subscriptionInfo[business.businessId]?.status) ? $t('components.businesses.health.planActive') : $t('components.businesses.health.noPlan') }}
          </span>
          <span v-if="counterResources[business.businessId]" :class="['health-pill', counterResources[business.businessId]['CALLCREDIT'] > 0 ? 'health-ok' : 'health-warn']">
            <i :class="counterResources[business.businessId]['CALLCREDIT'] > 0 ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"></i>
            {{ counterResources[business.businessId]['CALLCREDIT'] > 0 ? $t('components.businesses.health.hasMinutes') : $t('components.businesses.health.noMinutes') }}
          </span>
        </div>

        <!-- Action Buttons -->
        <div v-if="user" class="card-actions">
          <!-- Primary: Configure Assistant -->
          <div class="actions-primary-row">
            <Button
                :label="$t('components.businesses.editAssistant')" icon="pi pi-pencil"
                class="action-primary-btn"
                @click="router.push(`/businessconfiguration?id=${business.businessId}`)"
            />
          </div>

          <!-- Secondary: Messages + WhatsApp + More actions -->
          <div class="actions-secondary-row">
            <Button
                v-if="!isWebView"
                @click="router.push(`/conversations?id=${business.businessId}&${business.languageCountry.replace('_', '-')}`)"
                icon="pi pi-fw pi-table" :label="$t('components.businesses.conversationsViewButtonLabel')"
                outlined
            />
            <Button
                :label="$t('components.businesses.moreActions')"
                icon="pi pi-ellipsis-h"
                outlined
                @click="toggleMoreMenu($event, key)"
                :aria-controls="'more-menu-' + key"
                :aria-haspopup="true"
            />
            <Menu :ref="'moreMenu_' + key" :id="'more-menu-' + key" :model="getMoreMenuItems(key, business)" :popup="true" />
          </div>

          <!-- Test: Voice + Chat -->
          <div class="actions-test-row">
            <DirectVoiceButton
              v-if="user"
              :business-id="business.businessId"
              :encoding="voiceEncoding"
            />
            <TextChatWidget
              v-if="user"
              :business-id="business.businessId"
            />
          </div>

          <!-- Admin tools -->
          <div v-if="user && isAdmin" class="actions-admin-row">
            <WebcallButton
              :username="undefined"
              :password="undefined"
              :business-id="business.businessId"
              :authtoken="user.accessToken"
              :userid="user.id"
              icon="pi pi-phone"
              labelCall="Test webcall"
              labelHangup="Hangup webcall"
            />
          </div>
        </div>

      </div>
    </div>

    <!-- Bottom Paginator -->
    <Paginator
        :template="{
          '640px': 'PrevPageLink CurrentPageReport NextPageLink',
          '960px': 'FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
          '1300px': 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink',
          default: 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink JumpToPageDropdown RowsPerPageDropdown'
        }"
        :alwaysShow="false"
        :rows="size"
        v-model:first="first"
        :rowsPerPageOptions="[10,20,30,50,100]"
        :totalRecords="totalHits"
        @page="onPage($event)">
    </Paginator>
  </div>
</template>

<script>
import {computed, ref} from 'vue'
import {useStore} from 'vuex'
import axios from "axios"
import router from "@/router"
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/firebase/config";
import WebcallButton from "@/components/webcall/WebcallButton.vue";
import DirectVoiceButton from "@/components/webcall/DirectVoiceButton.vue";
import { preferredVoiceEncoding } from '@/utils/VoiceEncoding'
import TextChatWidget from "@/components/webcall/TextChatWidget.vue";
import OwnerSelector from "@/components/reseller/OwnerSelector.vue";
//import Plans from '@/components/Plans'

export default {
  components: {
    WebcallButton,
    DirectVoiceButton,
    TextChatWidget,
    OwnerSelector
    //Plans
  },
  updated() {
  },
  setup: () => {
    return {
    }
  },
  data: () => {
    const store = useStore()
    const sortOptions = [
      {name: 'Ascending', value: 'ASC'},
      {name: 'Descending', value: 'DESC'}
    ];
    const selectedSortOption = ref("DESC");

    const subscriptionStatusValueLabelMap = [
      {name: "creationDateTime", code: "creationDateTime"},
      {name: "companyName", code: "companyName"},
      {name: "delete", code: "delete"},
      {name: "emailAddress", code: "emailAddress"},
      {name: "lastUpdateDateTime", code: "lastUpdateDateTime"},
      {name: "nickname", code: "nickname"},
      {name: "onboarding", code: "onboarding"},
      {name: "subscriptionStatus", code: "subscriptionStatus"},
      {name: "template", code: "template"},
      {name: "trialExpirationDatetime", code: "trialExpirationDatetime"}
    ];
    const selectedSubscriptionStatus = ref([{name: "creationDateTime", code: "creationDateTime"}]);

    const matchFieldMap = [
      {name: "Nickname", value: "nickname"},
      {name: "Business Name", value: "companyName"},
      {name: "Email", value: "emailAddress"}
    ];
    const matchFieldMapValue = ref("companyName");

    const customerRecord = ref({})
    const isMobile = ref(window.innerWidth < 768)
    // Not screen width: a narrow desktop window is not a phone, and a phone
    // with an older browser has no WebCodecs. See @/utils/VoiceEncoding.
    const voiceEncoding = preferredVoiceEncoding()
    const isWebView = computed(() => store.state.isWebview)
    const osName = computed(() => store.state.webviewOsName)
    const isAdmin = computed(() => store.state.role === 'admin')
    const isReseller = computed(() => store.state.role === 'reseller')
    const selectedOwnerId = computed(() => store.state.selectedOwnerId)
    const managedOwners = computed(() => store.state.managedOwners || [])
    return {
      languageCountry: "it-IT",
      store,
      isMobile,
      voiceEncoding,
      isWebView,
      isAdmin,
      isReseller,
      selectedOwnerId,
      managedOwners,
      osName,
      router,
      customerRecord,
      enableSubscriptionButton: false,
      user: computed(() => store.state.user),
      authIsReady: computed(() => store.state.authIsReady),
      showProgressBar: false,
      from: 0,
      totalHits: 0,
      size: 10,
      first: 1,
      counterResources: {},
      subscriptionInfo: {},
      businesses: {},
      templates: {},
      selectedSubscriptionStatus,
      subscriptionStatusValueLabelMap,
      sortOptions,
      selectedSortOption,
      matchFieldMap,
      matchFieldMapValue,
      matchFieldMapQueryValue: null,
      queryAdditionalParameters: {},
      sortFields: ['creationDateTime']
    }
  },
  methods: {
    toggleMoreMenu(event, key) {
      const menuRef = this.$refs['moreMenu_' + key]
      if (menuRef) {
        // In v-for, $refs returns an array
        const menu = Array.isArray(menuRef) ? menuRef[0] : menuRef
        if (menu && menu.toggle) {
          menu.toggle(event)
        }
      }
    },
    getMoreMenuItems(key, business) {
      const items = []

      if (!this.isWebView) {
        items.push({
          label: this.isActivationPending(business) ? this.$t('components.businesses.startFreeTrial') : this.$t('components.businesses.planSubscription'),
          icon: 'pi pi-ticket',
          command: () => this.editPlan(key)
        })
      }
      if (this.enableSubscriptionButton) {
        items.push({
          label: this.$t('components.businesses.plan'),
          icon: 'pi pi-ticket',
          command: () => this.editSubscription(key)
        })
      }
      items.push({
        label: this.$t('components.businesses.gotoCallForwardingInstructionsButtonLabel'),
        icon: 'pi pi-info-circle',
        command: () => this.setBusinessAndOpenForwarding(key)
      })
      if (!this.isWebView) {
        items.push({
          label: this.$t('components.businesses.analyticsButtonLabel'),
          icon: 'pi pi-chart-bar',
          command: () => this.router.push(`/analytics?id=${business.businessId}`)
        })
      }
      items.push({
        label: this.$t('components.businesses.contactsButtonLabel'),
        icon: 'pi pi-users',
        command: () => this.router.push(`/contacts?id=${business.businessId}`)
      })
      if (this.customerRecord.data?.stripePartnerPromotionCode) {
        items.push({
          label: this.$t('components.businesses.partnerProgramButtonLabel'),
          icon: 'pi pi-users',
          command: () => this.router.push('/partnerprogram?code=' + this.customerRecord.data?.stripePartnerPromotionCode)
        })
      }
      items.push({
        label: 'WhatsApp Connect',
        icon: 'pi pi-whatsapp',
        command: () => this.router.push('/whatsappweb?businessId=' + business.businessId)
      })
      if (business.variables.OUTBOUND_CALLS_ENABLED === 'true') {
        items.push({
          label: 'Outbound Calls',
          icon: 'pi pi-phone',
          command: () => this.router.push('/outboundcalls?id=' + business.businessId)
        })
      }
      return items
    },
    getOwnerName(ownerUid) {
      if (!ownerUid || !this.managedOwners) return ''
      const owner = this.managedOwners.find(o => o.uid === ownerUid)
      return owner ? (owner.displayName || owner.email || ownerUid) : ''
    },
    getStatusSeverity(status) {
      const map = {
        'ACTIVE': 'success',
        'FREE': 'success',
        'TRIALING': 'info',
        'ONBOARDING': 'warn',
        'TEST': 'warn',
        'EXPIRING': 'warn',
        'CANCELED': 'danger',
        'EXPIRED': 'danger',
        'SUSPENDED': 'danger',
        'UNPAID': 'danger',
        'EXTERNAL': 'secondary',
        'UNKNOWN': 'secondary'
      }
      return map[status] || 'secondary'
    },
    isActivationPending(business) {
      const status = this.subscriptionInfo[business.businessId]?.status
      return status === 'ONBOARDING' || status === 'TEST'
    },
    showBusinessOverlay(business) {
      return false ; //DISABLED OVERLAY #!this.isAdmin && business.subscriptionStatus === 'TEST'
    },
    onUpdateMatchFieldMapQueryValue() {
      if(this.matchFieldMapValue && this.matchFieldMapQueryValue) {
        this.queryAdditionalParameters = {}
        this.queryAdditionalParameters[this.matchFieldMapValue] =
            this.matchFieldMapQueryValue.replace(/^%/, "").replace(/%$/, "").replace(/^/, "%").replace(/$/, "%");
      } else {
        this.queryAdditionalParameters = {}
      }
      this.fetchBusinessList(this.getBusinessSubscriptionInfo, this.fetchBusinessResources)
    },
    onSortFieldsChange(event) {
      this.sortFields = event.value.map(v => v.code)
      this.fetchBusinessList(this.getBusinessSubscriptionInfo, this.fetchBusinessResources)
    },
    onSortOrderChange(event) {
      this.fetchBusinessList(this.getBusinessSubscriptionInfo, this.fetchBusinessResources)
    },
    onPage(event) {
      //{page: 3, first: 30, rows: 10, pageCount: 6}
      this.from = event.first
      this.size = event.rows
      this.fetchBusinessList(this.getBusinessSubscriptionInfo, this.fetchBusinessResources)
    },
    isBusinesPhoneNumberVerified(business) {
      //console.debug(business.tested)
      return business.tested && !(business.tested === "1970-01-01T00:00:00")
    },
    isTemporaryTestServiceNumber(business) {
      return false
    },
    getCleanServiceNumber(prefix, serviceNumber) {
      if(serviceNumber) {
        if(prefix)
          return prefix + serviceNumber
        else
          return serviceNumber
      } else {
        return ""
      }
    },
    timestampToDateTime(business) {
      const currentPeriodEndTsMillis = this.subscriptionInfo[business.businessId].currentPeriodEnd * 1000
      const date = new Date(currentPeriodEndTsMillis)
      const localizedDate = date.toLocaleString(business.languageCountry, {timeZone: business.timezoneStr })
      return localizedDate
    },
    createBusiness() {
      router.push({
        name: "OnboardingLanguage", //new onboarding
        params: {
        }
      })
    },
    setBusinessAndOpenForwarding(idx) {
      const selectedBusiness = this.businesses.get(idx)
      const onboardingData = {
        business: selectedBusiness,
        enableBackwardButton: true
      }
      this.store.commit('setOnboardingData', onboardingData)
      router.push({
        name: "OnboardingChooseDevice",
        params: {
        }
      })
    },
    selectBusiness(idx, query = {}) {
      const selectedBusiness = this.businesses.get(idx)
      this.store.commit('setSelectedBusiness', selectedBusiness)
      router.push({
        name: "Business",
        query: query
      })
    },
    editPlan(idx) {
      const selectedBusiness = this.businesses.get(idx)
      if(selectedBusiness.template === "generic_onboarding" || selectedBusiness.template === "generic" || selectedBusiness.onboarding) {
        const onboardingData = {
          business: selectedBusiness,
          enableBackwardButton: true
        }
        this.store.commit('setOnboardingData', onboardingData)
        router.push({
          name: "OnboardingChoosePlan",
          params: {
          }
        })
      } else {
        this.store.commit('setSelectedBusiness', selectedBusiness)
        router.push({
          name: "Plan",
          query: { id: selectedBusiness.businessId }
        })
      }
    },
    editSubscription(idx) {
      const selectedBusiness = this.businesses.get(idx)
      this.store.commit('setSelectedBusiness', selectedBusiness)
      router.push("/subscription")
    },
    async getCustomerRecord(){
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/customer/registry?id=" + this.user.uid
      axios.get(url,
          {
            headers: headers
          }
      ).then((response) => {
        if(response.data) {
          this.customerRecord = response.data
        } else {
          this.customerRecord = {}
        }
        console.debug("CustomerRecord:",  this.customerRecord)
      }).catch((error) => {
        if(error.status === 404) {
          console.log("Customer record not yet created")
        } else {
          console.error(error)
        }
      })
    },
    creditsToMinutes(business, callcredits) {
      const callCreditFactorsStr = business.variables["CALLCREDIT_FACTOR"] ?? '{}' ;
      const callCreditFactors = JSON.parse(callCreditFactorsStr) ;
      const factor = callCreditFactors[business.template] ?? 4 ;
      return Math.floor(callcredits / factor)
    },
    creditTooltipFactor(business) {
      // For the credits tooltip: ~N credits/minute on phone calls.
      // Same source-of-truth as creditsToMinutes; default 25 if absent.
      const factorsStr = business.variables["CALLCREDIT_FACTOR"] ?? '{}' ;
      const factors = JSON.parse(factorsStr) ;
      return factors[business.template] ?? 25 ;
    },
    creditsToEuro(callcredits) {
      // 1 credit = €0.01 (Stripe products call50/300/600_euros map 1:100).
      const euro = (callcredits ?? 0) / 100 ;
      return new Intl.NumberFormat(this.$i18n.locale, { style: 'currency', currency: 'EUR' }).format(euro) ;
    },
    async fetchBusinessResources(businessId, subscriptionStatus, category) {
      console.log("Called fetchBusinessResources(" + businessId + ", " + category + ")")
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business/resources/count"

      let subcategoryExclude = ["900-WATERMARK"]
      let subcategory = []
      if(subscriptionStatus === "TEST") {
        subcategory.push("400-TEST")
      } else {
        subcategoryExclude.push("400-TEST")
      }
      axios.post(url,
          {
            businessId: businessId,
            category: category,
            subcategory: subcategory,
            subcategoryExclude: subcategoryExclude
          },
          {
            headers: headers
          }
      ).then((response) => {
        console.debug("Counter:", category, response.data)
        if(response.data >= 0) {
          this.counterResources[businessId] = this.counterResources[businessId] || {}
          this.counterResources[businessId][category] = response.data
        } else {
          this.counterResources[businessId] = this.counterResources[businessId] || {}
          this.counterResources[businessId][category] = undefined
        }
        //console.debug("Resources", this.counterResources)
      }).catch((error) => {
        console.error(error)
      })
    },
    async getBusinessSubscriptionInfo(businessId) {
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }
      const url = process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business/subscription?id=" + businessId
      await axios.get(url,
          {
            headers: headers
          }
      ).then((response) => {
        console.log("Subscription:", response.data)
        if(response.data) {
          this.subscriptionInfo[businessId] = response.data
        } else {
          this.subscriptionInfo[businessId] = undefined
        }
      }).catch((error) => {
        console.error(error)
      })
    },
    async fetchBusinessList(subscriptionFunction, fetchBusinessResourcesFunction) {
      const self = this ;
      self.showProgressBar = true;
      const headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      }

      const request = {
        offset: self.from,
        limit: self.size,
        orderBy: self.sortFields,
        sortOrder: self.selectedSortOption,
        ...self.queryAdditionalParameters
      }
      axios.post(process.env.VUE_APP_STARCHAT_URL + "/mrcall/v1/mrcall0/crm/business/search",
          request,
          {
            headers: headers
          }
      ).then(response => {
        this.store.commit('setRole', response.headers["x-mrcall-role"] || 'owner')
        const map = new Map()
        if(response.data && response.data.length !== 0) {
          //sorted by tested timestamp
          self.totalHits = response.data[0].totalHits
          response.data.map(function(item) {
            const tested = item.creationDateTime
            return [tested, item]
          }).sort((a, b) => a[0] <= b[0]).forEach(function (item) {
            map.set(item[1].businessId, item[1])
          })

          // Unsorted map
          response.data.forEach(async function (item) {
            await self.getBusinessSubscriptionInfo(item.businessId)
            self.fetchBusinessResources(item.businessId, item.subscriptionStatus, "CALLCREDIT")
            self.fetchBusinessResources(item.businessId, item.subscriptionStatus, "CALL")
            self.fetchBusinessResources(item.businessId, item.subscriptionStatus, "SMS")
            map.set(item.businessId, item)
          })
        } else {
          self.showProgressBar = false
          if(! self.isAdmin) {
            self.createBusiness()
          }
        }
        //console.debug("RESULT: ", response.data)
        //console.debug("RESULTMAP: ", map)
        this.businesses = map
        this.showProgressBar = false
      }).catch((error) => {
        console.error(error)
        this.showProgressBar = false
        if(error.response.status === 401) {
          this.store.dispatch('logout')
          router.replace('/login')
        }
      })
    },
    async templateList() {
      this.showProgressBar = true;
      let headers = {
        "Content-type": "application/json; charset=UTF-8",
        "auth": this.user.accessToken
      };
      axios.get(process.env.VUE_APP_STARCHAT_URL +
          `/mrcall/v1/mrcall0/crm/template?language=${this.languageCountry}`,
          {
            headers: headers
          }
      ).then((response) => {
        this.store.commit('setRole', response.headers["x-mrcall-role"] || 'owner')
        this.templates = {}
        let refTemplate = this.templates
        if(response.data) {
          response.data.forEach(function (item) {
            console.log(item.name, item)
            refTemplate[item.name] = item
          })
        }
        this.showProgressBar = false
      }).catch((error) => {
        console.error("Fetching TemplateList: ", error);
        this.showProgressBar = false
        if(error.response?.status && error.response.status === 401) {
          this.store.dispatch('logout')
          router.push('/login')
        }
      })
    }
  },
  watch: {
  },
  computed: {
    filteredBusinesses() {
      if (!this.isReseller || !this.selectedOwnerId || !this.businesses) {
        return this.businesses
      }
      const filtered = new Map()
      if (this.businesses instanceof Map) {
        this.businesses.forEach((business, key) => {
          if (business.owner === this.selectedOwnerId) {
            filtered.set(key, business)
          }
        })
      }
      return filtered
    }
  },
  mounted() {
    this._onResize = () => { this.isMobile = window.innerWidth < 768 }
    window.addEventListener('resize', this._onResize)
    this.store.commit('setCreateBusinessTemplate', null)
    if(! this.store.state.user) {
      onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified && !user.isAnonymous) {
          console.debug("UserStateChanged:", user)
          this.fetchBusinessList()
          this.getCustomerRecord()
        } /*else {
          router.replace('/login')
        }*/
      })
    } else {
      let successPayment = false ;
      if(this.$route.query.success_payment) {
        successPayment = JSON.parse(this.$route.query.success_payment) ;
      }
      let sessionReference = "anonymous"
      if(this.$route.query.session_reference) {
        sessionReference = this.$route.query.session_reference ;
      }
      if(successPayment && sessionReference) {
        this.$gtag.event("payment_success", {
          'user_email': this.store.state.user.email,
          'session_reference': sessionReference
        });
      }
      this.templateList()
      this.fetchBusinessList()
      this.getCustomerRecord()
    }
  },
  beforeUnmount() {
    if (this._onResize) window.removeEventListener('resize', this._onResize)
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

/* Page wrapper */
.businesses-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem;
}

/* Toolbar */
.businesses-toolbar {
  margin-bottom: 1.5rem;
}

.toolbar-admin-sort {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.toolbar-search {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.toolbar-search-inputs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.toolbar-search-field {
  flex: 1;
  min-width: 150px;
}

/* Business cards container */
.business-cards {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Individual card */
.business-card {
  position: relative;
  background: @mrcall_white;
  border: 1px solid @mrcall_borders;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

/* Card overlay (kept for future use) */
.business-card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;

  .overlay-button-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
}

/* Card header */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid @mrcall_borders;
  gap: 0.75rem;
}

.card-company-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: @mrcall_dark_grey_text;
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Status badge */
.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
  flex-shrink: 0;
}

.owner-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #e0edff;
  color: #1a5fb4;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-clickable {
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
}

.status-success {
  background: #e6f7ee;
  color: #1a7d42;
}

.status-info {
  background: #e0edff;
  color: #1a5fb4;
}

.status-warn {
  background: #fff3e0;
  color: #b86e00;
}

.status-danger {
  background: #fde8e8;
  color: #c62828;
}

.status-secondary {
  background: @mrcall_light_grey_2;
  color: @mrcall_grey_text2;
}

/* Activation banner */
.activation-banner {
  padding: 1rem 1.25rem;
  background: fade(@mrcall_blue, 6%);
  border-bottom: 1px solid @mrcall_borders;
}

.activation-banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.activation-banner-text {
  flex: 1;
  min-width: 0;
}

.activation-banner-title {
  font-size: 1rem;
  font-weight: 700;
  color: @mrcall_blue;
  margin-bottom: 0.25rem;
}

.activation-banner-subtitle {
  font-size: 0.85rem;
  color: @mrcall_grey_text;
  line-height: 1.4;
}

/* Service number banner */
.service-number-banner {
  padding: 0.875rem 1.25rem;
  background: @mrcall_light_grey_2;
  border-bottom: 1px solid @mrcall_borders;
}

.service-number-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.service-number-icon {
  font-size: 1.25rem;
  color: @mrcall_blue;
}

.service-number-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.service-number-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: @mrcall_grey_text2;
}

.service-number-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: @mrcall_blue;
  text-decoration: none;
}

a.service-number-value:hover {
  text-decoration: underline;
}

.service-number-warning {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: @mrcall_orange;
  font-weight: 500;
}

.warning-text {
  color: @mrcall_orange;
  font-weight: 500;
}

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 0.5rem 0;
}

.info-item {
  display: flex;
  flex-direction: column;
  padding: 0.625rem 1.25rem;
  border-bottom: 1px solid @mrcall_borders;
}

.info-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: @mrcall_grey_text2;
  margin-bottom: 0.2rem;

  i {
    font-size: 0.7rem;
    margin-right: 0.25rem;
  }
}

.info-value {
  font-size: 0.95rem;
  font-weight: 500;
  color: @mrcall_dark_grey_text;
  word-break: break-word;
}

/* Action buttons */
.health-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
}

.health-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: 500;

  &.health-ok {
    background: #e8f5e9;
    color: #2e7d32;
  }

  &.health-warn {
    background: #fff3e0;
    color: #e65100;
  }

  i {
    font-size: 0.85rem;
  }
}

.card-actions {
  padding: 1rem 1.25rem;
  border-top: 1px solid @mrcall_borders;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.actions-primary-row {
  .action-primary-btn {
    width: 100%;
    font-size: 1rem;
    padding: 0.75rem 1.5rem;
  }
}

.actions-secondary-row {
  display: flex;
  gap: 0.5rem;

  .p-button {
    flex: 1;
    margin: 0;
  }
}

.actions-test-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;

  .p-button,
  :deep(.p-button) {
    margin: 0;
  }
}

.actions-admin-row {
  display: flex;
  gap: 0.5rem;
  border-top: 1px dashed @mrcall_borders;
  padding-top: 0.75rem;

  .p-button,
  :deep(.p-button) {
    margin: 0;
  }
}

/* Mobile responsive */
@media screen and (max-width: 640px) {
  .businesses-page {
    padding: 0.5rem;
  }

  .card-header {
    flex-wrap: wrap;
  }

  .card-company-name {
    font-size: 1.1rem;
    white-space: normal;
  }

  .activation-banner-content {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-search {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-search-inputs {
    flex-direction: column;
  }

  .toolbar-admin-sort {
    flex-direction: column;
  }

  .actions-secondary-row {
    flex-direction: column;

    .p-button {
      width: 100%;
      flex: none;
    }
  }

  .actions-test-row,
  .actions-admin-row {
    flex-direction: column;

    .p-button,
    :deep(.p-button) {
      width: 100%;
    }
  }
}
</style>
