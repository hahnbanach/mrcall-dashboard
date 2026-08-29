<template>
  <BlockUI :blocked="blocked" fullScreen>
    <OnboardingBase :current-step="0" :total-steps="0" :wide="true">
      <template #spinner>
        <Toast />
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
      <template #title>{{ t('views.onboarding.chooseplan.title') }}</template>
      <template #subtitle>{{ t('views.onboarding.chooseplan.subtitle') }}</template>
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
        <div class="plan-advisor">
          <div class="advisor-toggle" @click="advisorOpen = !advisorOpen">
            <i :class="advisorOpen ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"></i>
            <span>{{ advisorOpen ? t('views.onboarding.chooseplan.advisor.toggleLabelCollapse') : t('views.onboarding.chooseplan.advisor.toggleLabel') }}</span>
          </div>
          <div v-show="advisorOpen" class="advisor-body">
            <div class="advisor-section">
              <div class="advisor-section-title">{{ t('views.onboarding.chooseplan.advisor.callVolumeTitle') }}</div>
              <SelectButton
                  v-model="selectedCallVolume"
                  :options="callVolumeOptions"
                  optionLabel="label"
                  optionValue="value"
                  :allowEmpty="true" />
            </div>
            <div class="advisor-section">
              <div class="advisor-section-title">{{ t('views.onboarding.chooseplan.advisor.featuresTitle') }}</div>
              <div class="advisor-chips">
                <div v-for="key in featureKeys" :key="key"
                     class="advisor-chip"
                     :class="{ active: selectedFeatures.includes(key), locked: lockedFeatures.includes(key) }"
                     @click="toggleFeature(key)">
                  <i :class="lockedFeatures.includes(key) ? 'pi pi-lock' : (selectedFeatures.includes(key) ? 'pi pi-check' : 'pi pi-plus')"></i>
                  <span>{{ t('views.onboarding.chooseplan.advisor.features.' + key) }}</span>
                </div>
              </div>
            </div>
            <div v-if="advisorIsFiltering" class="advisor-reset">
              <Button :label="t('views.onboarding.chooseplan.advisor.resetLabel')"
                      @click="resetAdvisor()"
                      class="p-button-text p-button-sm" />
            </div>
          </div>
        </div>

        <div v-if="noPlansMatch" class="no-match-message">
          <i class="pi pi-exclamation-triangle"></i>
          <div>
            <div class="no-match-title">{{ t('views.onboarding.chooseplan.advisor.noMatchTitle') }}</div>
            <div>{{ t('views.onboarding.chooseplan.advisor.noMatchMessage') }}</div>
          </div>
        </div>

        <div v-if="planRecommendation" class="plan-recommendation-banner">
          <i class="pi pi-info-circle"></i>
          <div class="banner-content">
            <span class="banner-title">{{ t('views.onboarding.chooseplan.recommendedPlanTitle') }}</span>
            <span class="banner-why">{{ planRecommendation.why }}</span>
          </div>
        </div>

        <div class="plans-body">
          <div v-for="item in tm('views.onboarding.chooseplan.plans')" :key="item.id"
               class="plan-card-wrapper"
               :class="{ 'plan-hidden': advisorIsFiltering && !qualifyingPlanIds.has(item.id) }">
            <div class="plan-card"
                 :class="{
                   recommended: item.id === 'starter' && !advisorIsFiltering && !planRecommendation,
                   'best-match': bestMatchPlanId === item.id,
                   'recommended-by-agent': planRecommendation && planRecommendation.plan === item.id
                 }">
              <div v-if="planRecommendation && planRecommendation.plan === item.id" class="recommended-by-agent-badge">
                {{ t('views.onboarding.chooseplan.recommendedLabel') }}
              </div>
              <div v-else-if="bestMatchPlanId === item.id" class="best-match-badge">
                {{ t('views.onboarding.chooseplan.advisor.bestMatchBadge') }}
              </div>
              <div v-else-if="item.id === 'starter' && !advisorIsFiltering && !planRecommendation" class="recommended-badge">
                {{ t('views.onboarding.chooseplan.recommendedLabel') }}
              </div>
              <div class="plan-title">{{ item.title }}</div>
              <div class="plan-highlight">{{ item.highlight }}</div>
              <div class="plan-pricing">
                <span class="currency">{{ item.pricing.currency }}</span>
                <span class="amount">{{ item.pricing.number }}</span>
                <span class="period">{{ item.pricing.periodicity }}</span>
              </div>
              <div class="plan-button">
                <Button :label="item.buttonLabel"
                        @click="paymentSession(item.id)"
                        :class="item.id === 'starter' ? 'py-2 w-full' : 'py-2 w-full p-button-outlined'"/>
              </div>
              <div class="plan-features">
                <div class="features-title">{{ item.functionalities.title }}</div>
                <div v-if="item.functionalities.includesFrom" class="includes-from">
                  <i class="pi pi-check-circle"></i>
                  <span>{{ item.functionalities.includesFrom }}</span>
                </div>
                <div v-for="functionality in item.functionalities.items" :key="functionality.value" class="feature-row">
                  <i class="pi pi-check"></i>
                  <span class="feature-text">{{ functionality.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="trust-signals">
          <div class="trust-signal">
            <i class="pi pi-lock"></i>
            <span>{{ t('views.onboarding.chooseplan.trustSignals.securePayment') }}</span>
          </div>
          <div class="trust-signal">
            <i class="pi pi-times-circle"></i>
            <span>{{ t('views.onboarding.chooseplan.trustSignals.cancelAnytime') }}</span>
          </div>
          <div class="trust-signal">
            <i class="pi pi-shield"></i>
            <span>{{ t('views.onboarding.chooseplan.trustSignals.noChargesDuringTrial') }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="button-left">
        </div>
        <div class="button-right">
        </div>
      </template>
      <template #support-large>
        <div class="chooseplan-support">
          <div class="chooseplan-support-title">{{ t('components.templates.onboarding.supportsection.doYouNeedAssistance') }}</div>
          <div class="chooseplan-support-text">
            {{ t('views.onboarding.chooseplan.supportWriteUs', { email: 'support@mrcall.ai' }) }}
          </div>
          <div class="chooseplan-support-text">
            {{ t('views.onboarding.chooseplan.supportBookMeeting') }}
          </div>
          <Button
              :label="t('components.templates.onboarding.supportsection.bookAppointmentButtonLabel')"
              class="p-button-outlined chooseplan-support-btn"
              @click="$router.push('/callbooking')"
          />
        </div>
      </template>
    </OnboardingBase>
  </BlockUI>
</template>

<script>

import {useStore} from "vuex";
import {computed, ref} from "vue";
import businessUtils from "@/utils/Business";
import businessVariablesUtils from "@/utils/BusinessVariables";
import stripeUtils from "@/utils/Stripe";
import router from "@/router";
import {useI18n} from "vue-i18n";
import {useToast} from "primevue/usetoast";
import OnboardingBase from "@/components/templates/onboarding/Base";

export default {
  name: "OnboardingChoosePlan",
  components: {OnboardingBase},
  setup: function() {
    const store = useStore();
    const user = computed(() => store.state.user)
    const onboardingData = computed(() => store.state.onboardingData)
    const { t, tm } = useI18n()
    const toast = useToast()
    return {
      t,
      tm,
      store,
      user,
      onboardingData,
      toast,
    }
  },
  data: function() {
    return {
      showSpinner: false,
      blocked: false,
      enableBackwardButton: ref(false),
      modalDialogVisible: ref(false),
      modalDialogTitle: null,
      modalDialogIconClass: 'error-icon',
      modalDialogSubTitle: null,
      modalDialogBodyMessage: null,
      modalDialogLeftButtonLabel: null,
      modalDialogRightButtonLabel: null,
      modalDialogLeftRedirectComponentName: null,
      modalDialogRightRedirectComponentName: null,
      advisorOpen: window.innerWidth > 640,
      selectedCallVolume: null,
      selectedFeatures: [],
      lockedFeatures: [],
      featureKeys: [
        'smart_response', 'multilingual', 'dynamic_whatsapp', 'booking',
        'voip_sip', 'webhook', 'call_transfer', 'call_transcription',
        'external_sources', 'custom_extraction'
      ],
      featurePlanMap: {
        smart_response:     ['starter', 'professional'],
        multilingual:       ['starter', 'professional'],
        dynamic_whatsapp:   ['starter', 'professional'],
        booking:            ['starter', 'professional'],
        voip_sip:           ['starter', 'professional'],
        webhook:            ['starter', 'professional'],
        call_transfer:      ['starter', 'professional'],
        call_transcription: ['professional'],
        external_sources:   ['professional'],
        custom_extraction:  ['professional']
      },
      callVolumePlanMap: {
        low:    ['essential', 'starter', 'professional'],
        medium: ['starter', 'professional'],
        high:   ['professional']
      }
    }
  },
  computed: {
    callVolumeOptions() {
      return [
        { label: this.t('views.onboarding.chooseplan.advisor.callVolumeOptions.low'), value: 'low' },
        { label: this.t('views.onboarding.chooseplan.advisor.callVolumeOptions.medium'), value: 'medium' },
        { label: this.t('views.onboarding.chooseplan.advisor.callVolumeOptions.high'), value: 'high' }
      ]
    },
    advisorIsFiltering() {
      return this.advisorOpen && (this.selectedCallVolume !== null || this.selectedFeatures.length > 0)
    },
    qualifyingPlanIds() {
      const allPlanIds = ['essential', 'starter', 'professional']
      let result = new Set(allPlanIds)

      if (this.selectedCallVolume) {
        const volumePlans = new Set(this.callVolumePlanMap[this.selectedCallVolume])
        result = new Set([...result].filter(id => volumePlans.has(id)))
      }

      for (const feature of this.selectedFeatures) {
        const featurePlans = new Set(this.featurePlanMap[feature])
        result = new Set([...result].filter(id => featurePlans.has(id)))
      }

      return result
    },
    bestMatchPlanId() {
      if (!this.advisorIsFiltering) return null
      if (this.qualifyingPlanIds.size === 1) {
        return [...this.qualifyingPlanIds][0]
      }
      return null
    },
    noPlansMatch() {
      return this.advisorIsFiltering && this.qualifyingPlanIds.size === 0
    },
    planRecommendation() {
      const businessId = this.$route.query?.id
      if (!businessId) return null
      return this.onboardingData?.planRecommendation?.[businessId] || null
    }
  },
  methods: {
    toggleFeature(key) {
      if (this.lockedFeatures.includes(key)) return;
      const index = this.selectedFeatures.indexOf(key)
      if (index === -1) {
        this.selectedFeatures.push(key)
      } else {
        this.selectedFeatures.splice(index, 1)
      }
    },
    resetAdvisor() {
      this.selectedCallVolume = null
      this.selectedFeatures = [...this.lockedFeatures]
    },
    goBack() {
      if(this.enableBackwardButton) {
        router.push({ name: "Businesses" });
      } else {
        router.push({ name: "OnboardingMakeATestCall" });
      }
    },
    async paymentSession(template) {
      console.debug("Payment Session: ", this.onboardingData);
      this.showSpinner = true ;
      const self = this;
      const businessId = this.onboardingData.business.businessId ;
      const isWebview = this.store.state.isWebview ;
      const apple = false ;

      const now = Date.now() ;
      const sessionReference = `${businessId}_${now}` ;
      const successUrl = process.env.VUE_APP_SERVICE_BASE_URL + process.env.VUE_APP_PUBLIC_PATH +
          `/success_payment?id=${businessId}&template=${template}&session_reference=${sessionReference}` ;
      const cancelUrl =
          process.env.VUE_APP_SERVICE_BASE_URL + process.env.VUE_APP_PUBLIC_PATH +
          `/onboardingchooseplan?id=${businessId}&success_payment=false&session_reference=${sessionReference}` ;


      let business = this.onboardingData.business ;
      business.template = template ;
      self.blocked = true ;

      const convertedBusiness = businessVariablesUtils.businessVariablesToSerializable(business)
      await businessUtils.chooseBusinessTemplate(this.user, convertedBusiness).then(() => {
        self.showSpinner = false ;
        if(isWebview && apple) {
          self.blocked = true ;
        } else {
          return stripeUtils.createSession(this.user, template, businessId, successUrl, cancelUrl)
              .then((session) => {
                this.$gtag.event("begin_checkout", {
                  'user_email': this.user.email,
                  'business_id': businessId,
                  'session_id': session.id,
                  'session_reference': sessionReference,
                  'expires_at': session.expires_at,
                  'currency': session.currency,
                  'amount_total': session.amount_total,
                  'amount_subtotal': session.amount_subtotal
                });
                self.blocked = false ;
                window.location.href = session.url;
              })
        }
      }).catch((error) => {
        console.error(error);
        self.showSpinner = false ;
        self.blocked = false ;
        self.modalDialogTitle = self.tm('views.onboarding.chooseplan.errorDialogUnknownErrorTitle') ;
        self.modalDialogBodyMessage = self.tm('views.onboarding.chooseplan.errorDialogUnknownErrorBody') ;
        self.modalDialogRightButtonLabel = self.t('views.onboarding.chooseplan.unknownErrorBusinessErrorRightButtonLabel');
        self.modalDialogVisible = true ;
        self.toast.add({ severity: 'error', summary: self.tm('views.onboarding.chooseplan.errorDialogUnknownErrorTitle')[0], life: 5000 });
      })
    },
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
      if(redirectComponent) {
        router.push({
          name: redirectComponent
        });
      }
    },
    initializePage() {
      const self = this;
      const businessId = this.$route.query?.id;
      let sessionReference = "anonymous" ;
      if(this.$route.query.session_reference) {
        sessionReference = this.$route.query.session_reference ;
      }
      let successPayment = false ;
      if(this.$route.query.success_payment) {
        successPayment = JSON.parse(this.$route.query.success_payment) ;
      }
      if(! successPayment) {
        this.$gtag.event("payment_failed", {
          'business_id': businessId,
          'user_email': this.store.state.user.email,
          'session_reference': sessionReference
        });
      }
      if (!this.onboardingData?.business?.languageCountry) {
        if(businessId) {
          businessUtils.getBusiness(this.store, this.user, businessId).then((item) => {
            console.debug("Business: ", item);
            this.store.state.onboardingData = {
              business: item
            }
          })
        } else {
          router.push({
            name: "OnboardingLanguage"
          });
        }
      }

      if(self.store.state.onboardingData?.enableBackwardButton) {
        self.enableBackwardButton = self.store.state.onboardingData.enableBackwardButton ;
      }

      // Auto-filter and lock features based on active business variables
      const multilingual = this.$route.query?.multilingual;
      if (multilingual === 'true') {
        if (!this.selectedFeatures.includes('multilingual')) {
          this.selectedFeatures.push('multilingual');
        }
        if (!this.lockedFeatures.includes('multilingual')) {
          this.lockedFeatures.push('multilingual');
        }
        this.advisorOpen = true;
      }

      const booking = this.$route.query?.booking;
      if (booking === 'true') {
        if (!this.selectedFeatures.includes('booking')) {
          this.selectedFeatures.push('booking');
        }
        if (!this.lockedFeatures.includes('booking')) {
          this.lockedFeatures.push('booking');
        }
        this.advisorOpen = true;
      }
    }
  },
  mounted() {
    this.initializePage();
  },
  created() {
    console.log("SelectPlan Called with: ", this.onboardingData);
  }
}

</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding_modal_dialog';

.plan-advisor {
  width: 100%;
  border: 1px solid @mrcall_light_grey_1;
  border-radius: 12px;
  margin-bottom: 1.5em;

  .advisor-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    padding: 0.8em 1em;
    cursor: pointer;
    color: @mrcall_blue;
    font-weight: 600;
    font-size: 0.9em;
    user-select: none;

    &:hover {
      background: fade(@mrcall_blue, 5%);
    }

    i {
      font-size: 0.8em;
    }
  }

  .advisor-body {
    padding: 0 1.5em 1.5em 1.5em;
    border-top: 1px solid @mrcall_light_grey_1;

    .advisor-section {
      margin-top: 1.2em;

      .advisor-section-title {
        font-weight: 600;
        font-size: 0.9em;
        color: @mrcall_dark_grey_text;
        margin-bottom: 0.6em;
      }
    }

    .advisor-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5em;

      .advisor-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
        padding: 0.4em 0.8em;
        border: 1px solid @mrcall_light_grey_1;
        border-radius: 20px;
        font-size: 0.8em;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s ease;
        color: @mrcall_grey_text;

        i {
          font-size: 0.75em;
        }

        &:hover {
          border-color: @mrcall_blue;
          color: @mrcall_blue;
          background: fade(@mrcall_blue, 6%);
        }

        &.active {
          background: @mrcall_blue;
          border-color: @mrcall_blue;
          color: @mrcall_white;
        }

        &.locked {
          cursor: not-allowed;
          opacity: 0.85;

          &:hover {
            background: @mrcall_blue;
            border-color: @mrcall_blue;
            color: @mrcall_white;
          }
        }
      }
    }

    .advisor-reset {
      margin-top: 1em;
      text-align: center;
    }
  }
}

.no-match-message {
  display: flex;
  align-items: flex-start;
  gap: 0.8em;
  width: 100%;
  padding: 1em 1.2em;
  margin-bottom: 1.5em;
  background: #FFF8E1;
  border: 1px solid #FFE082;
  border-radius: 6px;
  font-size: 0.85em;
  color: #5D4037;

  .pi-exclamation-triangle {
    color: #F9A825;
    font-size: 1.2em;
    margin-top: 0.1em;
    flex-shrink: 0;
  }

  .no-match-title {
    font-weight: 700;
    margin-bottom: 0.3em;
  }
}

.plan-recommendation-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.8em;
  width: 100%;
  padding: 1em 1.2em;
  margin-bottom: 1.5em;
  background: #E3F2FD;
  border: 1px solid #90CAF9;
  border-radius: 6px;
  font-size: 0.9em;
  color: #1565C0;

  i {
    color: #1976D2;
    font-size: 1.2em;
    margin-top: 0.1em;
    flex-shrink: 0;
  }

  .banner-content {
    display: flex;
    flex-direction: column;
    gap: 0.3em;

    .banner-title {
      font-weight: 700;
    }

    .banner-why {
      line-height: 1.5;
    }
  }
}

.plans-body {
  display: flex;
  gap: 1em;
  width: 100%;

  .plan-card-wrapper {
    flex: 1;
    max-height: 800px;
    opacity: 1;
    overflow: hidden;
    transition: max-height 0.4s ease, opacity 0.3s ease, flex 0.4s ease;

    &.plan-hidden {
      max-height: 0;
      opacity: 0;
      flex: 0;
      overflow: hidden;
    }
  }

  .plan-card {
    border: 1px solid @mrcall_light_grey_1;
    border-radius: 12px;
    padding: 1.5em 1em 1em 1em;
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;

    &.recommended {
      border-top: 3px solid @mrcall_blue;
    }

    &.best-match {
      border-top: 3px solid #43A047;
    }

    &.recommended-by-agent {
      border-top: 3px solid #7B1FA2;
    }

    .recommended-badge {
      position: absolute;
      top: -0.7em;
      left: 50%;
      transform: translateX(-50%);
      background: @mrcall_blue;
      color: @mrcall_white;
      font-size: 0.7em;
      font-weight: 700;
      padding: 0.3em 0.8em;
      border-radius: 3px;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .best-match-badge {
      position: absolute;
      top: -0.7em;
      left: 50%;
      transform: translateX(-50%);
      background: #43A047;
      color: @mrcall_white;
      font-size: 0.7em;
      font-weight: 700;
      padding: 0.3em 0.8em;
      border-radius: 3px;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .recommended-by-agent-badge {
      position: absolute;
      top: -0.7em;
      left: 50%;
      transform: translateX(-50%);
      background: #7B1FA2;
      color: @mrcall_white;
      font-size: 0.7em;
      font-weight: 700;
      padding: 0.3em 0.8em;
      border-radius: 3px;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .plan-title {
      font-family: 'Inter', serif;
      font-weight: 600;
      font-size: 1.5em;
      color: @mrcall_dark_grey_text;
      margin-bottom: 0.3em;
    }

    .plan-highlight {
      color: @mrcall_blue;
      font-size: 0.8em;
      font-weight: 600;
    }

    .plan-pricing {
      display: flex;
      align-items: baseline;
      margin: 1em 0;
      color: @mrcall_dark_grey_text;

      .currency {
        font-size: 1.8em;
        font-weight: 700;
      }

      .amount {
        font-size: 1.8em;
        font-weight: 700;
        margin: 0 0.1em;
      }

      .period {
        font-size: 0.8em;
        font-weight: 400;
        color: @mrcall_grey_text;
      }
    }

    .plan-button {
      margin-bottom: 1em;

      .p-button {
        font-family: 'Inter', serif;
        font-weight: 700;
        font-size: 0.8em;
      }
    }

    .plan-features {
      color: @mrcall_grey_text;

      .features-title {
        font-size: 1em;
        font-weight: 600;
        margin-bottom: 0.8em;
        color: @mrcall_dark_grey_text;
      }

      .includes-from {
        display: flex;
        align-items: center;
        gap: 0.5em;
        margin-bottom: 0.8em;
        padding: 0.5em 0.7em;
        background: fade(@mrcall_blue, 8%);
        border-radius: 4px;
        font-size: 0.85em;
        font-weight: 600;
        color: @mrcall_blue;

        .pi-check-circle {
          font-size: 0.9em;
          flex-shrink: 0;
        }
      }

      .feature-row {
        display: flex;
        align-items: flex-start;
        gap: 0.5em;
        margin-bottom: 0.5em;
        font-size: 0.9em;
        font-weight: 400;
        line-height: 1.4em;

        .pi-check {
          color: @mrcall_blue;
          font-size: 0.9em;
          margin-top: 0.2em;
          flex-shrink: 0;
        }

        .feature-text {
          flex: 1;
        }
      }
    }
  }

  @media screen and (max-width: 640px) {
    flex-direction: column;

    .plan-card-wrapper.plan-hidden {
      max-height: 0;
      flex: 0;
    }
  }

  @media screen and (min-width: 640px) {
    flex-direction: row;
  }
}

.trust-signals {
  display: flex;
  justify-content: center;
  gap: 2em;
  margin-top: 1.5em;
  padding: 1em 0;

  .trust-signal {
    display: flex;
    align-items: center;
    gap: 0.5em;
    font-size: 0.85em;
    color: @mrcall_grey_text;

    i {
      color: @mrcall_blue;
      font-size: 1em;
    }
  }

  @media screen and (max-width: 640px) {
    flex-direction: column;
    align-items: center;
    gap: 0.8em;
  }
}

.button-left {
  flex: 1;
}

.button-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
}

.chooseplan-support {
  display: flex;
  flex-direction: column;
  gap: 0.8em;
  padding: 1em 0;

  .chooseplan-support-title {
    font-family: 'Inter', serif;
    font-weight: 600;
    font-size: 1.1em;
    color: @mrcall_dark_grey_text;
  }

  .chooseplan-support-text {
    font-family: 'Inter', serif;
    font-weight: 400;
    font-size: 1em;
    line-height: 1.4;
    color: @mrcall_grey_text;
  }

  .chooseplan-support-btn {
    margin-top: 0.5em;
    border-radius: 33px;
    width: fit-content;
  }
}
</style>
