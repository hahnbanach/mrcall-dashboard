<template>
  <div class="onboarding-prepayment-container main-page-content-section text-center">
    <div class="text-lg mb-4">
      <p class="title md:text-5xl text-4xl">
        <span class="block">{{ $t('views.onboardingprepayment.title1') }}</span>
        {{ $t('views.onboardingprepayment.title2') }}
      </p>
    </div>

    <p class="text-base subtitle font-bold mb-2">{{ $t('views.onboardingprepayment.subtitle') }}</p>
    <p class="text-base">
      {{$t('views.onboardingprepayment.textTrialPeriod')}}
    </p>
    <template v-if="isBusinessPlus()">
      <p class="text-base">{{$t('views.onboardingprepayment.voipMessageText')}}</p>
    </template>
    <template v-else>
      <p class="text-base">{{$t('views.onboardingprepayment.numberForwardingMessageText')}}</p>
    </template>


    <Button class="md:w-auto w-full px-6 mt-4 py-3" @click="gotoPayment()"
            icon="pi pi-shopping-cart" :label="$t('views.onboardingprepayment.okMoveOnButtonText')" />
  </div>
</template>

<script>
import router from "@/router";
import {computed} from 'vue';
import {useStore} from 'vuex';

export default {
  data: function () {
    const store = useStore()
    const business = computed(() => store.state.selectedBusiness)
    return {
      router,
      business
    }
  },
  methods: {
    isBusinessPlus() {
      console.log("BUSINESS PRE PAYMENT: ", this.business);
      let templatematch = this.business.template.match(/^businessplus/)
      if(templatematch) {
        const value = templatematch.find(e => typeof e !== 'undefined');
        return value === "businessplus"
      }
      return false ;
    },
    gotoPayment() {
      this.$gtag.event("onboarding_pre_payment", {
        'user_email': this.business.emailAddress,
        'business_id': this.business.businessId
      });
      router.push({
        name: "Payment",
        params: {
        }
      })
    }
  },
  mounted() {
    window.scrollTo(0, 0);
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

</style>