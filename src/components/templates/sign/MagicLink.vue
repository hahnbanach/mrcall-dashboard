<template>
  <div class="signin-signup-form">
    <Dialog :modal="true" :closable="false" :closeOnEscape="false" v-model:visible="showMessage" :breakpoints="{ '960px': '80vw' }" :style="{ width: '30vw' }" position="top">
      <div class="p-d-flex p-ai-center p-dir-col p-pt-6 p-px-3">
        <div v-if="error === null">
          <div class="text-center mb-4">
            <i id="response-message-success-symbol" class="pi pi-check-circle"></i>
          </div>

          <div class="text-center">
            <h5 class="mb-3 font-bold md:text-3xl text-2xl text-center">{{$t('components.templates.sign.magicklink.successSent')}}</h5>
            <p :style="{lineHeight: 1.5, textIndent: '1rem'}">{{$t('components.templates.sign.magicklink.magicLinkSentMessage')}}: <b>{{email}}</b> ; {{$t('components.templates.sign.magicklink.checkYourMagicLinkMessage')}}</p>
          </div>
        </div>
        <div v-else>
          <div class="text-center mb-4">
            <i id="response-message-failed-symbol" class="pi pi-check-circle"></i>
          </div>
          <div class="text-center">
            <h5 class="mb-3 font-bold md:text-3xl text-2xl text-center">{{$t('components.templates.sign.magicklink.failedSent')}}</h5>
            <p :style="{lineHeight: 1.5, textIndent: '1rem'}">{{$t('components.templates.sign.magicklink.magicLinkErrorMessage')}}: <b>{{email}}</b>: {{error}}</p>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="text-center">
          <template v-if="error === null">
            <Button
                label="OK"
                @click="router.replace('/')"
                class="p-button-text md:w-auto py-3 px-6 w-full"
                autofocus
            />
          </template>
          <template v-else>
            <Button
                label="Dismiss"
                @click="toggleDialog"
                class="p-button-text md:w-auto py-3 px-6 w-full"
                autofocus
            />
          </template>
        </div>
      </template>
    </Dialog>

    <div class="p-d-flex p-jc-center">
      <form @submit.prevent="handleSubmit(!v$.$invalid)" class="p-fluid">

        <div class="card">
          <div class="p-field mb-3">
            <div class="inputboxtitle">
              {{$t('components.templates.sign.magicklink.emailInputboxTitle')}}
            </div>
            <IconField>
              <InputText
                  id="magic-link-email"
                  v-model="v$.email.$model"
                  :class="{'p-invalid':v$.email.$invalid && submitted}"
                  aria-describedby="email-error"
                  :placeholder="$t('components.templates.sign.magicklink.emailInputboxPlaceholder')"
                  class="pl-4 text-sm"
              />
              <InputIcon class="pi pi-envelope pr-4 text-lg" />
            </IconField>
            <span v-if="v$.email.$error && submitted">
                <span id="email-error" v-for="(error, index) of v$.email.$errors" :key="index">
                <small class="p-error">{{error.$message}}</small>
                </span>
              </span>
            <small v-else-if="(v$.email.$invalid && submitted) || v$.email.$pending.$response" class="p-error">{{v$.email.required.$message.replace('Value', 'Email')}}</small>
          </div>
          <div class="p-field mb-3">
            <Button :disabled="showMessage" type="submit" :label="$t('components.templates.sign.magicklink.submitButton')" class="signin-signup-button-text"/>
          </div>
          <div class="p-field mb-3">
            <p class="title md:text-5xl text-4xl text-center mb-4">{{ $t('components.templates.sign.magicklink.attention') }}</p>
            <p class="text-center">{{ $t('components.templates.sign.magicklink.checkSpamFolder') }}</p>
          </div>
        </div>
      </form>

    </div>
  </div>
</template>

<style scoped lang="less">
@import "../../../assets/style/colors";
@import '../../../assets/style/components/templates/sign/login';
</style>

<script>
import { email, required} from "@vuelidate/validators"
import { useVuelidate } from "@vuelidate/core"
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import router from "@/router";

export default {
  setup() {
    const v$ = useVuelidate()
    const router = useRouter()
    const store = useStore()
    return {
      v$,
      store,
      router
    }
  },
  data() {
    return {
      email: '',
      error: null,
      submitted: false,
      showMessage: false
    }
  },
  validations() {
    return {
      email: {
        required,
        email
      },
    }
  },
  created() {
  },
  async mounted() {
    if(await this.store.dispatch('completeEmailLinkSignIn', {})) {
      router.replace("/businesses")
    }
  },
  methods: {
    async handleSubmit(isFormValid) {
      this.submitted = true;

      if (!isFormValid) {
        return;
      }
      try {
        console.debug("Calling store dispatch: emailLinkSignup")
        const cleanEmail = this.email.replace(" ", "")
        await this.store.dispatch('emailLinkSignup', {
          email: cleanEmail,
        })

      } catch (err) {
        this.error = err.message
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
      this.error = null ;
      this.submitted = false;
    }
  }
}
</script>

<style lang="less" scoped>
@import '../../../assets/style/colors';
@import '../../../assets/style/fonts';

#response-message-success-symbol {
  font-size: 3rem;
  color: @mrcall_blue ;
}

#response-message-failed-symbol {
  font-size: 3rem;
  color: red ;
}

.emaillink-login-form {
  .card {
    width: auto;

    form {
    }

    .p-field {
      margin-bottom: 1.5rem;
    }
  }
}
</style>