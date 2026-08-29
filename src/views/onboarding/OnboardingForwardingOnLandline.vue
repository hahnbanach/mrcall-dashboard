<template>
  <OnboardingBase>
    <template #title>{{ t('views.onboarding.forwardingonlandline.titleText') }}</template>
    <template #subtitle>{{ t('views.onboarding.forwardingonlandline.subtitleText') }}</template>
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
      <div class="item">
        <div v-for="(block, index) in procedures()" :key="index" style="padding-bottom: 2em ; ">
          <div class="cap-element">
            <p class="title-white center">{{ block.title }}</p>
          </div>
          <div v-for="(row, rowidx) in block.middle.rows" :key="rowidx">
            <div class="middle-element">
              <div style="padding: 1em ;">
                <div v-for="(textElement, textidx) in row" :key="textidx" style="display: inline;">
                  <p v-if="textElement.phoneNumberHref && enabledPhoneLinks" :style="textElement.style">
                    <a :href="'tel:' + textElement.phoneNumberHref" target='_self'>{{textElement.phoneNumberHref}}</a>
                  </p>
                  <p v-else-if="textElement.phoneNumberHref" :style="textElement.style">
                    {{textElement.phoneNumberHref}}
                  </p>
                  <p v-else-if="textElement.href && textElement.text" :style="textElement.style">
                    <a :href="textElement.href" target='_blank'>{{textElement.text}}</a>
                  </p>
                  <p v-else-if="textElement.href" :style="textElement.style">
                    <a :href="textElement.href" target='_blank'>{{textElement.href}}</a>
                  </p>
                  <p v-else :style="textElement.style">{{textElement.text}}</p>
                </div>
              </div>
            </div>
          </div>
          <template v-if="block.beforeClosing">
            <div v-for="(row, rowidx) in block.beforeClosing.rows" :key="rowidx">
              <div class="before-closing-element">
                <div style="padding: 1em ;">
                  <div v-for="(textElement, textidx) in row" :key="textidx" style="display: inline;">
                    <p v-if="textElement.phoneNumberHref && enabledPhoneLinks" :style="textElement.style">
                      <a :href="'tel:' + textElement.phoneNumberHref" target='_self'>{{textElement.phoneNumberHref}}</a>
                    </p>
                    <p v-else-if="textElement.phoneNumberHref" :style="textElement.style">
                      {{textElement.phoneNumberHref}}
                    </p>
                    <p v-else-if="textElement.href && textElement.text" :style="textElement.style">
                      <a :href="textElement.href" target='_blank'>{{textElement.text}}</a>
                    </p>
                    <p v-else-if="textElement.href" :style="textElement.style">
                      <a :href="textElement.href" target='_blank'>{{textElement.href}}</a>
                    </p>
                    <p v-else :style="textElement.style">{{textElement.text}}</p>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-for="(row, rowidx) in block.closing.rows" :key="rowidx">
            <div class="closing-element">
              <div style="flex-flow: initial; display: flex; padding: 1em;">
                <div style="width: 90%; padding-left: 1em;" class="left">
                  <div v-for="(textElement, textidx) in row" :key="textidx" style="display: inline;">
                    <p v-if="textElement.phoneNumberHref && enabledPhoneLinks" :style="textElement.style">
                      <a :href="'tel:' + textElement.phoneNumberHref" target='_self'>{{textElement.phoneNumberHref}}</a>
                    </p>
                    <p v-else-if="textElement.phoneNumberHref" :style="textElement.style">
                      {{textElement.phoneNumberHref}}
                    </p>
                    <p v-else-if="textElement.href && textElement.text" :style="textElement.style">
                      <a :href="textElement.href" target='_blank'>{{textElement.text}}</a>
                    </p>
                    <p v-else-if="textElement.href" :style="textElement.style">
                      <a :href="textElement.href" target='_blank'>{{textElement.href}}</a>
                    </p>
                    <p v-else :style="textElement.style">{{textElement.text}}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="button-left">
        <Button :label="t('views.onboarding.forwardingonlandline.moveBackward')" @click="router.push({name: 'OnboardingChooseDevice'})" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
      </div>
      <div class="button-right">
        <Button :label="t('views.onboarding.forwardingonlandline.moveForward')" @click="router.push({name: 'OnboardingPreBookAppointment'})" class="p-button-text md:w-auto py-3 w-full p-button-left"/>
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
  name: "ForwardingOnLandline",
  setup: function () {
    const store = useStore();
    const onboardingData = computed(() => store.state.onboardingData)
    const user = computed(() => store.state.user)
    const { t, tm } = useI18n()
    let yourPhoneNumber = ref("[Your phone number]")

    const selectedOperatorValue = ref()
    return {
      t,
      tm,
      store,
      user,
      router,
      phoneOperators,
      onboardingData,
      selectedOperatorValue,
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
    procedures() {
      if(this.selectedOperatorValue) {
        const procedure = this.phoneOperators.procedure(
            this.t,
            this.yourPhoneNumber,
            this.selectedOperatorValue.value,
            "fixed_line"
        )
        return procedure ;
      } else {
        return []
      }
    },
    submit() {
      console.log("Submit with: ", this.onboardingData);
      router.push({
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
    console.log("ForwardingOnLandline Called with: ", this.onboardingData);
  }
}
</script>

<style scoped lang="less">
@import '../../assets/style/colors';
@import '../../assets/style/components/templates/onboarding';
@import '../../assets/style/views/forwardingprocedures';

.item {
  padding: 1em 0 0 0 ;
  margin: auto;
}

</style>
