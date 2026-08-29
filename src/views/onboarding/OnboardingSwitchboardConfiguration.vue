<template>
  <OnboardingBase>
    <template #title>{{ $t('views.onboarding.switchboardconfiguration.titleText') }}</template>
    <template #content>
      <div class="item">
        <div class="central-icon">
        </div>
      </div>
      <div class="item">
        {{ $t('views.onboarding.switchboardconfiguration.subtitleText') }}
      </div>
    </template>
    <template #footer>
      <div class="button-left">
        <Button :label="$t('views.onboarding.switchboardconfiguration.moveBackward')" @click="router.push({name: 'OnboardingChooseDevice'})" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-right">
        <Button :label="$t('views.onboarding.switchboardconfiguration.moveForward')" @click="router.push({name: 'CallBooking'})" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
    </template>
  </OnboardingBase>
</template>

<script>
import OnboardingBase from "@/components/templates/onboarding/Base";
import {computed} from "vue";
import router from "@/router";
import {useStore} from "vuex";
import businessUtils from "@/utils/Business";
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/firebase/config";

export default {
  components: {OnboardingBase},
  name: "OnboardingSwitchBoardConfiguration",
  setup: function () {
    const store = useStore();
    const onboardingData = computed(() => store.state.onboardingData)
    return {
      store,
      user: computed(() => store.state.user),
      router,
      onboardingData
    }
  },
  data: function() {
    return {
    }
  },
  methods: {
    submit() {
      console.log("Submit with: ", this.onboardingData);
      const self = this;
      this.$gtag.event("onboarding_choosedevice_submit", {
        'user_email': self.user.email,
      })
      this.router.push({
        name: "CallBooking"
      })
    },
    initializePage() {
      if (!this.onboardingData?.business?.languageCountry) {
        const businessId = this.$route.query?.id;
        if(businessId) {
          businessUtils.getBusiness(this.store, this.user, businessId).then((item) => {
            console.debug("Business: ", item);
            this.store.state.onboardingData = {
              business: item
            }
          })
        } else {
          router.push({
            name: "Businesses"
          });
        }
      }
    }
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
    console.log("PreBookAppointment Called with: ", this.onboardingData);
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';

.item {
  padding: 1em 0 0 0 ;
  margin: auto;
}
.central-icon {
  background: url(../../assets/images/mrcall/icons/man_with_laptop.svg) no-repeat;
  margin-left: auto;
  margin-right: auto;
  width: 10em;
  height: 8em;
}
</style>
