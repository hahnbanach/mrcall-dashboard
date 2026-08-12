<template>
  <OnboardingBase :current-step="3" :total-steps="3">
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
    <template #title>
      <i class="pi pi-check-circle success-icon"></i>
      {{ $t('views.onboarding.assistantcreated.titleText') }}
    </template>
    <template #subtitle></template>
    <template #content>
      <div class="contentmessagecentered">
        {{ $t('views.onboarding.assistantcreated.subtitleText')}}
      </div>
      <ul class="benefit-list">
        <li><i class="pi pi-check"></i> {{ $t('views.onboarding.assistantcreated.benefit1') }}</li>
        <li><i class="pi pi-check"></i> {{ $t('views.onboarding.assistantcreated.benefit3') }}</li>
      </ul>
    </template>
    <template #support-large>
      <div class="fun-fact-panel">
        <img src="@/assets/images/mrcall/littleman/little_man_one_phone.svg" alt="MrCall" class="fun-fact-mascot" />
        <div class="fun-fact-title">{{ $t('views.onboarding.assistantcreatedfunfact.funFactTitle') }}</div>
        <p class="fun-fact-text">{{ $t('views.onboarding.assistantcreatedfunfact.funFactText') }}</p>
      </div>
    </template>
    <template #support-small>
      <div class="fun-fact-panel-small">
        <Panel toggleable collapsed>
          <template #header>
            <img src="@/assets/images/mrcall/littleman/little_man_one_phone.svg" alt="MrCall" class="fun-fact-mascot-small" />
            <span class="fun-fact-header">{{ $t('views.onboarding.assistantcreatedfunfact.funFactTitle') }}</span>
          </template>
          <p class="fun-fact-text">{{ $t('views.onboarding.assistantcreatedfunfact.funFactText') }}</p>
        </Panel>
      </div>
    </template>
    <template #footer>
      <div class="button-left">
        <Button :label="$t('views.onboarding.assistantcreated.moveBackward')"
                @click="router.push({name: 'OnboardingSearchBusiness'})"
                class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-right">
        <Button :label="$t('views.onboarding.assistantcreated.moveForward')" @click="moveForward()" class="p-button-text md:w-auto py-3 w-full"/>
      </div>
    </template>
  </OnboardingBase>
</template>

<script>
import OnboardingBase from "@/components/templates/onboarding/Base";
import {computed} from "vue";
import {useStore} from "vuex";
import router from "@/router";
import businessUtils from "@/utils/Business";
export default {
  components: {OnboardingBase},
  name: "OnboardingAssistantCreated",
  setup: function () {
    const store = useStore();
    const user = computed(() => store.state.user)
    const onboardingData = computed(() => store.state.onboardingData)

    return {
      store,
      user,
      router,
      onboardingData
    }
  },
  data: function() {
    return {
      showSpinner: false,
    }
  },
  methods: {
    moveForward() {
      const businessId = this.onboardingData?.business?.businessId || this.$route.query?.id;
      if (!businessId) {
        console.error("No businessId available — redirecting to start of onboarding");
        this.router.push({ name: "OnboardingLanguage" });
        return;
      }
      // Route to wizard if not completed for this business, otherwise straight to config
      const completedFor = this.onboardingData?.wizardCompletedFor || {};
      if (!completedFor[businessId]) {
        this.router.push({ name: 'WizardConfiguration', query: { id: businessId } })
      } else {
        this.router.push({ name: 'BusinessConfiguration', query: { id: businessId } })
      }
    },
    async initializePage() {
      const businessId = this.$route.query?.id;
      if(businessId && !this.onboardingData?.business?.businessId) {
        await businessUtils.getBusiness(this.store, this.user, businessId).then((item) => {
          console.debug("Business: ", item);
          this.store.state.onboardingData = {
            ...this.store.state.onboardingData,
            business: item,
            onboardingRecover: true
          }
        }).catch((error) => {
          console.error("Failed to load business:", error);
          this.router.push({ name: "OnboardingLanguage" });
        })
      } else if (!businessId && !this.onboardingData?.business?.businessId) {
        console.error("No business data and no businessId in URL — redirecting to start");
        this.router.push({ name: "OnboardingLanguage" });
      }
    }
  },
  async mounted() {
    await this.initializePage();
    if (this.onboardingData) {
      this.onboardingData.lastConversation = undefined;
    }
  },
  created() {
    console.log("AssistantCreated Called with: ", this.onboardingData);
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';
@import '../../assets/style/components/templates/onboarding_fun_fact';

.success-icon {
  display: block;
  font-size: 3em;
  color: #43A047;
  margin: 0 auto 0.3em auto;
}

.contentmessagecentered {
  font-family: 'Inter', serif, 'primeicons';
  font-style: normal;
  font-weight: 600;
  font-size: 1.1em;
  text-align: center;
  line-height: 1.4em;
  color: @mrcall_grey_text;
  margin: 0 auto 1em auto;
}

.benefit-list {
  list-style: none;
  padding: 0;
  margin: 0 auto;
  max-width: 400px;

  li {
    display: flex;
    align-items: center;
    gap: 0.6em;
    font-family: 'Inter', serif;
    font-weight: 500;
    font-size: 0.95em;
    color: @mrcall_dark_grey_text;
    padding: 0.6em 0;

    .pi-check {
      color: #43A047;
      font-size: 0.9em;
      flex-shrink: 0;
    }
  }
}

</style>
