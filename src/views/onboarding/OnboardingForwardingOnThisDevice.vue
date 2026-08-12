<template>
  <OnboardingBase>
    <template #title>{{ $t('views.onboarding.forwardingonthisdevice.titleText') }}</template>
    <template #subtitle>{{ $t('views.onboarding.forwardingonthisdevice.subtitleText') }}</template>
    <template #content>
      <div class="item">
        <Dropdown
            :disabled="false"
            v-model="selectedOperator"
            :options="phoneOperators.operators(t)"
            optionLabel="name"
            :filter="true"
            :placeholder="t('views.onboarding.forwardinggeneric.selectOperator')" :showClear="true"
            class="w-full"
        >
          <template #option="slotProps">
            <div>
              <span>{{slotProps.option.name}}</span>
            </div>
          </template>
        </Dropdown>
      </div>
      <div class="item" v-if="selectedOperatorValue">
        <div class="inputboxtitle">
          {{$t('views.onboarding.forwardingonthisdevice.activateItemTitle')}}
        </div>
        <Button :label="$t('views.onboarding.forwardingonthisdevice.activateCode')" @click="setActivate()" class="p-button-phonecode-enable p-button-phonecode w-full"/>
        <div class="inputboxsubtitle">
          {{$t('views.onboarding.forwardingonthisdevice.activateItemSubtitle')}}
        </div>
        <div class="inputboxtitle">
          {{$t('views.onboarding.forwardingonthisdevice.deactivateItemTitle')}}
        </div>
        <Button :label="$t('views.onboarding.forwardingonthisdevice.deactivateCode')" @click="setDeactivate()" class="p-button-phonecode-disable p-button-phonecode w-full" severity="danger"/>
        <div class="inputboxsubtitle">
          {{$t('views.onboarding.forwardingonthisdevice.deactivateItemSubtitle')}}
        </div>
      </div>
    </template>
    <template #footer>
      <div class="button-left">
        <Button :label="$t('views.onboarding.forwardingonthisdevice.moveBackward')" @click="router.push({name: 'OnboardingChooseDevice'})" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-right">
        <Button :label="$t('views.onboarding.forwardingonthisdevice.moveForward')" @click="router.push({name: 'OnboardingPreBookAppointment'})" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
    </template>
  </OnboardingBase>
</template>

<script>
import OnboardingBase from "@/components/templates/onboarding/Base";
import {computed, ref} from "vue";
import router from "@/router";
import {useStore} from "vuex";
import businessUtils from "@/utils/Business";
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/firebase/config";
import {useI18n} from "vue-i18n";
import phoneOperators from "../../utils/PhoneOperators";

export default {
  components: {OnboardingBase},
  name: "OnboardingMobileForwardingConfiguration",
  setup: function () {
    const store = useStore();
    const onboardingData = computed(() => store.state.onboardingData)
    const { t, tm } = useI18n()
    let yourPhoneNumber = ref("[Your phone number]")

    const selectedOperatorValue = ref()
    return {
      t,
      tm,
      store,
      user: computed(() => store.state.user),
      router,
      phoneOperators,
      selectedOperatorValue,
      onboardingData,
      enabledPhoneLinks: true,
      yourPhoneNumber
    }
  },
  data: function() {
    return {
    }
  },
  computed: {
    selectedOperator: {
      set(value) {
        this.selectedOperatorValue = value ;
      },
      get() {
        return this.selectedOperatorValue ;
      }
    }
  },
  methods: {
    setActivate() {
      this.phoneOperators.procedure(
          this.t,
          this.yourPhoneNumber,
          this.selectedOperatorValue.value,
          "mobile"
      ).map((value) => {
        location.href=`tel:${value.activationCode}` ;
      })
    },
    setDeactivate() {
      this.phoneOperators.procedure(
          this.t,
          this.yourPhoneNumber,
          this.selectedOperatorValue.value,
          "mobile"
      ).map((value) => {
        location.href=`tel:${value.deactivationCode}` ;
      })
    },
    submit() {
      console.log("Submit with: ", this.onboardingData);
      this.router.push({
        name: "CallBooking"
      })
    },
    initializePage() {
      const self = this;
      if (!this.onboardingData?.business?.languageCountry) {
        const businessId = this.$route.query?.id;
        if(businessId) {
          businessUtils.getBusiness(this.store, this.user, businessId).then((item) => {
            console.debug("Business: ", item);
            self.yourPhoneNumber = item.serviceNumber ;
            self.store.state.onboardingData = {
              business: item
            }
          })
        } else {
          router.push({
            name: "Businesses"
          });
        }
      } else {
        self.yourPhoneNumber = self.store.state.onboardingData.business.serviceNumber ;
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
    console.log("ForwardingOnThisDevice Called with: ", this.onboardingData);
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';

.p-button-phonecode-enable.p-button {
  color: @mrcall_white;
  background: @mrcall_blue;
}

.p-button-phonecode-disable.p-button {
  color: @mrcall_white;
  background: @mrcall_orange;
}

.p-button-phonecode.p-button {
  font-family: 'Inter',serif;
  font-style: normal;
  font-weight: 700;
  font-size: 1em;
  line-height: 1em;

  //color: @mrcall_grey_text2;
  //background: transparent;
  border: 1px solid @mrcall_grey_text2;
  padding: 0.5rem 1em;
  margin: 0.2em 0.2em 0.2em auto;
  border-radius: 33px;
}

.p-button-phonecode.p-button:hover {
  background: @mrcall_grey_text2;
  color: @mrcall_white;
}

.item {
  padding: 1em 0 0 0 ;
  margin: auto;
  width: 100%;
}
</style>
