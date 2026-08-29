<template>
  <div class="signin-signup-form">
    <form @submit.prevent="handleSubmit(!v$.$invalid)">
      <div class="p-fluid">
        <div class="p-field">
          <div class="inputboxtitle">
            {{$t('components.templates.sign.signup.emailInputboxTitle')}}
          </div>
          <IconField>
            <InputText id="email" :placeholder="$t('components.templates.sign.signup.emailInputboxPlaceholder')" v-model="v$.email.$model" :class="{'p-invalid':v$.email.$invalid && submitted}" aria-describedby="email-error" class="pl-4 text-sm" />
            <InputIcon class="pi pi-envelope pr-4 text-lg" />
          </IconField>
          <span class="ml-3" v-if="v$.email.$error && submitted">
            <span id="email-error" v-for="(error, index) of v$.email.$errors" :key="index">
              <small class="p-error">{{error.$message}}</small>
            </span>
          </span>
          <small v-else-if="(v$.email.$invalid && submitted) || v$.email.$pending.$response" class="p-error">{{v$.email.required.$message.replace('Value', 'Email')}}</small>
        </div>

        <div class="p-field">
          <div class="inputboxtitle">
            {{$t('components.templates.sign.signup.passwordInputboxTitle')}}
          </div>
          <Password id="password" :placeholder="$t('components.templates.sign.signup.passwordInputboxPlaceholder')" v-model="v$.password.$model" :class="{'p-invalid':v$.password.$invalid && submitted}" :feedback="false" :toggleMask="true" class="text-sm">
            <template #header>
              <h6>Pick a password</h6>
            </template>
          </Password>
          <small v-if="(v$.password.$invalid && submitted) || v$.password.$pending.$response" class="ml-3 p-error">
            <div v-for="error in v$.password.$errors" :key="error">
              {{ error.$message.replace('Value', 'Password') }}
            </div>
          </small>
        </div>
      </div>

      <div class="p-field mb-3">
        <Button class="signin-signup-button-text" type="submit" :label="$t('components.templates.sign.signup.submitButton')" />
      </div>

      <div class="divider">
        <span>{{ t('utils.common.or') }}</span>
      </div>

      <div class="p-field mb-3">
        <GoogleSignIn />
      </div>
    </form>

    <!-- Keep the Dialog -->
    <Dialog :modal="true" :closable="false" :closeOnEscape="false" v-model:visible="showMessage" :breakpoints="{ '960px': '80vw' }" :style="{ width: '40vw' }" position="top">
      <div class="p-d-flex p-ai-center p-dir-col p-pt-6 p-px-3">
        <div v-if="errorDialogTitle === null">
          <div class="text-center mb-4">
            <i id="response-message-success-symbol" class="pi pi-check-circle"></i>
          </div>
          <div class="text-center">
            <h5 class="mb-3 font-bold md:text-3xl text-2xl text-center">{{t('components.templates.sign.signup.registrationSuccess')}}</h5>
            <p :style="{lineHeight: 1.5, textIndent: '1rem'}">
              {{t('components.templates.sign.signup.accountRegistered')}}: <b>{{email}}</b> <br> {{t('components.templates.sign.signup.activationInstructions')}}.
            </p>
          </div>
        </div>
        <div v-else>
          <!-- Error dialog content -->
          <div class="text-center mb-4">
            <i class="pi pi-check-circle" :style="{fontSize: '5rem', color: 'red' }"></i>
          </div>
          <div class="text-center">
            <h5 class="mb-3 font-bold md:text-3xl text-2xl text-center">{{ errorDialogTitle }}</h5>
            <div v-if="errorType === 'USER_ALREADY_EXISTS'">
              <p :style="{lineHeight: 1.5, textIndent: '1rem'}">
                {{errorDialogTextBefore}}: <b>{{email}}</b>
                <br>
                {{errorDialogTextAfter}}
              </p>
              <Button :label="t('components.templates.sign.signup.errorUserAlreadyExistsAccessLink')" @click="router.replace('/login')" class="p-button-text md:w-auto py-3 px-6 w-full"/>
            </div>
            <div v-else>
              <p :style="{lineHeight: 1.5, textIndent: '1rem'}">
                {{errorDialogTextBefore}}: <b>{{email}}</b>
                <br>
                {{errorDialogTextAfter}}
              </p>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div>
          <div v-if="errorDialogTitle === null">
            <Button label="OK" @click="router.replace('/')" class="p-button-text md:w-auto py-3 px-6 w-full" />
          </div>
          <div v-else>
            <Button :label="t('components.templates.sign.signup.errorDismissButton')" @click="toggleDialog" class="p-button-text md:w-auto py-3 px-6 w-full"/>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped lang="less">
@import "../../../assets/style/colors";
@import '../../../assets/style/components/templates/sign/login';
</style>

<script>
import {email, minLength, required} from "@vuelidate/validators"
import {useVuelidate} from "@vuelidate/core"
import {useRouter} from 'vue-router'
import {useStore} from 'vuex'
import {useI18n} from "vue-i18n"
import Tr from "@/i18n/translation"
import GoogleSignIn from './GoogleSignIn.vue'

export default {
  components: {
    GoogleSignIn
  },
  setup() {
    const v$ = useVuelidate()
    const router = useRouter()
    const store = useStore()
    const { t } = useI18n()
    return {
      t,
      v$,
      store,
      router
    }
  },
  data() {
    return {
      email: '',
      password: '',
      errorType: '',
      errorDialogTitle: null,
      errorDialogTextBefore: null,
      errorDialogTextAfter: null,
      submitted: false,
      showMessage: false,
    }
  },
  validations() {
    return {
      email: {
        required,
        email
      },
      password: {
        required,
        minLengthValue: minLength(8),
      }
    }
  },
  mounted() {
    console.log('Current environment:', process.env.NODE_ENV);
    console.log('Dashboard URL:', process.env.VUE_APP_SERVICE_BASE_URL);
    
    const lang = this.$route.query?.lang;
    if(lang) {
      Tr.switchLanguage(lang)
    }
  },
  methods: {
    async handleSubmit(isFormValid) {
      this.submitted = true;

      if (!isFormValid) {
        return;
      }

      try {
        const actionCodeSettings = {
          url: window.location.origin + '/login?confirm_email=true',
          handleCodeInApp: false
        };
        
        await this.store.dispatch('signup', {
          email: this.email,
          password: this.password,
          actionCodeSettings
        })
        console.debug('Email verification completed - User state:', this.store.state.user)
        console.debug('Email signup successful - pushing to data layer')
        window.dataLayer.push({
          'event': 'sign_up',
          'method': 'Email',
          'user_id': this.store.state.user.uid,
          'user_email': this.email,
          'event_category': 'engagement',
          'event_label': 'Email Sign Up',
          'debug_timestamp': new Date().getTime()
        });
        console.debug('Data layer after email signup:', window.dataLayer)
      } catch (err) {
        console.debug(err)
        if(err.message.includes("auth/email-already-in-use")) {
          this.errorDialogTitle = this.t('components.templates.sign.signup.errorUserAlreadyExistsTitle')
          this.errorDialogTextBefore = this.t('components.templates.sign.signup.errorUserAlreadyExistsMessageFirstPart')
          this.errorDialogTextAfter = this.t('components.templates.sign.signup.errorUserAlreadyExistsMessageSecondPart')
          this.errorType = "USER_ALREADY_EXISTS"
        } else if(err.message.includes("auth/network-request-failed")) {
          this.errorDialogTitle = this.t('components.templates.sign.signup.errorNetworkTitle')
          this.errorDialogTextBefore = this.t('components.templates.sign.signup.errorNetworkMessageFirstPart')
          this.errorDialogTextAfter = this.t('components.templates.sign.signup.errorNetworkMessageSecondPart')
          this.errorType = "NETWORK_ERROR"
        } else {
          this.errorDialogTitle = this.t('components.templates.sign.signup.loginFailedGenericTitle')
          this.errorDialogTextBefore = this.t('components.templates.sign.signup.registrationFailedMessage')
          this.errorDialogTextAfter = err.message
          this.errorType = ""
        }
      }

      this.toggleDialog();
    },
    toggleDialog() {
      this.showMessage = !this.showMessage;

      if(!this.showMessage) {
        this.resetForm();
      }
    },
    resetForm() {
      this.email = '';
      this.password = '';
      this.errorType = '';
      this.errorDialogTitle = null;
      this.errorDialogTextBefore = null;
      this.errorDialogTextAfter = null;
      this.submitted = false;
    }
  }
}
</script>