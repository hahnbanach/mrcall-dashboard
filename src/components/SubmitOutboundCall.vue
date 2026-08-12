<template>
  <Toast></Toast>
  <div class="sumbit-outbound-call-number-form">
    <p class="title mb-4 text-4xl" style="text-align: center;">Insert the number and press submit</p>
    <div class="p-d-flex p-jc-center">
      <div class="card">
        <div class="p-field">
          <IconField>
            <InputText id="outboundPhoneNumber" type="tel" placeholder="Enter phone number" v-model="outboundPhoneNumber" class="pl-4 text-sm"/>
            <InputIcon class="pi pi-phone pr-4 text-lg" />
          </IconField>
        </div>
        <div class="text-center">
          <Button @click="handleSubmit()" label="Submit" class="p-mt-2 md:w-auto py-3 px-6 w-full" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {useRouter} from 'vue-router'
import {useStore} from 'vuex'
import {useToast} from "primevue/usetoast"
import axios from "axios";
import router from "@/router";
import {computed} from "vue";

export default {
  setup() {
    const router = useRouter()
    const store = useStore()
    const toast = useToast()
    return {
      store,
      router,
      toast,
      user: computed(() => store.state.user),
    }
  },
  data() {
    return {
      businessId: '',
      outboundPhoneNumber: '',
      showProgressBar: false
    }
  },
  created() {
  },
  mounted() {
    this.businessId = this.$route.query?.id;
  },
  methods: {
    async handleSubmit() {
      const self = this
      const number = self.outboundPhoneNumber.replace(/[^\d]/g, '');
      const isValid = number && number.startsWith('39') &&
          !/^39(?:199|806|807|840|841|847|848|901|902|905)/.test(number) ;
      console.debug("ISVALID", self.outboundPhoneNumber, number, isValid);
      if(isValid) {
        if(number) {
          let headers = {
            "Content-type": "application/json; charset=UTF-8",
            "auth": self.user.accessToken
          };
          self.showProgressBar = true ;
          axios.post(process.env.VUE_APP_STARCHAT_URL +
              `/mrcall/v1/mrcall0/atom/${self.businessId}/outbound`,
              {
                "toNumber": number
              },
              {
                headers: headers
              }
          ).then((response) => {
            self.showProgressBar = false;
            console.log("SUBMITTED", self.outboundPhoneNumber, number, response.data)
            self.toast.add({severity: 'info', summary: `Number submitted: ${number}`, life: 2000})
            self.outboundPhoneNumber = ''
          }).catch((error) => {
            self.showProgressBar = false;
            if(error.response.status === 401) {
              this.store.dispatch('logout')
              router.push('/signin')
            } else {
              self.toast.add({severity:'error',
                summary: `Failed to submit number: ${self.outboundPhoneNumber}`,
                detail: `${error.message}`, life: 5000})
              console.error(error)
            }
          })
        } else {
          self.toast.add({severity: 'error', summary: `Number submitted is not valid: ${this.outboundPhoneNumber}`, life: 2000})
        }
        self.outboundPhoneNumber = '';
      } else {
        self.toast.add({severity: 'warn', summary: `Insert a valid italian number`, life: 2000})
      }
    },
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

#response-message-success-symbol {
  font-size: 3rem;
  color: @mrcall_blue ;
}

.sumbit-outbound-call-number-form {
  .card {
    width: auto;

    form {
      //margin-top: 2rem;
    }

    .p-field {
      margin-bottom: 1.5rem;
    }
  }
}
</style>
