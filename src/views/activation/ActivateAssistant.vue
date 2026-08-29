<template>
  <OnboardingBase :current-step="0" :total-steps="0">
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
    <template #title>{{ $t('views.activation.titleText') }}</template>
    <template #subtitle>{{ $t('views.activation.subtitleText') }}</template>
    <template #content>
      <div class="item">
        <div class="inputboxtitle">
          {{ $t('views.activation.multilingualQuestion') }}
        </div>
        <SelectButton
            v-model="multilingual"
            :options="multilingualOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full multilingual-toggle"
        />
      </div>
      <div class="item">
        <div class="inputboxtitle">
          {{ $t('views.activation.phoneNationalityTitle') }}
        </div>
        <Dropdown
            v-model="countryAlpha2" :options="isoAlpha2Selection"
            optionLabel="name"
            optionValue="value"
            :placeholder="$t('views.onboarding.language.pickCountryPlaceholder')"
            :filter="true"
            :showClear="false"
            :class="'w-full'"
        >
          <template #option="slotProps">
            <div>
              <span>{{ slotProps.option.name }}</span>
            </div>
          </template>
        </Dropdown>
        <div class="inputboxsubtitle">
          {{ $t('views.activation.phoneNationalitySubtitle') }}
        </div>
      </div>
    </template>
    <template #footer>
      <div class="button-left">
      </div>
      <div class="button-right">
        <Button
            :label="$t('views.activation.continueButton')"
            @click="continueToPlans()"
            :disabled="!countryAlpha2"
            class="p-button-text md:w-auto py-3 w-full"
        />
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
import {useI18n} from "vue-i18n";

export default {
  components: {OnboardingBase},
  name: "ActivateAssistant",
  setup: function () {
    const store = useStore();
    const {t} = useI18n();
    const user = computed(() => store.state.user);

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
    ]);

    return {
      t,
      store,
      user,
      router,
      isoAlpha2Selection,
      businessUtils
    }
  },
  data: function () {
    return {
      showSpinner: false,
      multilingual: false,
      countryAlpha2: null,
      businessId: null,
      business: null
    }
  },
  computed: {
    multilingualOptions() {
      return [
        {label: this.t('views.activation.oneLanguage'), value: false},
        {label: this.t('views.activation.multipleLanguages'), value: true}
      ]
    }
  },
  methods: {
    continueToPlans() {
      // Update countryAlpha2 on the business in onboardingData
      if (this.store.state.onboardingData?.business) {
        this.store.state.onboardingData.business.countryAlpha2 = this.countryAlpha2;
      }
      this.router.push({
        name: "OnboardingChoosePlan",
        query: {
          id: this.businessId,
          multilingual: this.multilingual.toString()
        }
      });
    },
    async initializePage() {
      const businessId = this.$route.query?.id;
      if (businessId) {
        this.businessId = businessId;
        this.showSpinner = true;
        try {
          const item = await businessUtils.getBusiness(this.store, this.user, businessId);
          console.debug("ActivateAssistant - Business loaded:", item);
          this.business = item;
          // Pre-fill countryAlpha2 from business if available
          if (item.countryAlpha2) {
            this.countryAlpha2 = item.countryAlpha2;
          }
          // Ensure onboardingData is set
          this.store.state.onboardingData = {
            business: item,
            enableBackwardButton: true
          };
        } catch (error) {
          console.error("Error loading business:", error);
        } finally {
          this.showSpinner = false;
        }
      } else {
        // No business ID — redirect back to businesses
        this.router.push({name: "Businesses"});
      }
    }
  },
  mounted() {
    this.initializePage();
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';

.multilingual-toggle {
  margin: 0.5em 0;

  :deep(.p-selectbutton) {
    display: flex;
    width: 100%;

    .p-button {
      flex: 1;
      justify-content: center;
    }
  }
}
</style>
