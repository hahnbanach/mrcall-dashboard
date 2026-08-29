<template>
  <ProgressBar v-show="showProgressBar" mode="indeterminate" style="height: .3em"/>
  <div class="whatsappweb-content center">
    <div v-if="(loggedin && socketopen)">
      <p class="title text-center mb-4 md:text-5xl text-4xl">{{ $t('components.whatsappweb.testTitle') }}</p>
      <p class="subtitle text-center mb-1 md:text-2xl text-1xl">{{ $t('components.whatsappweb.testSubtitle') }}</p>
      <br>
      <!--
      <Button
          class="m-2"
          iconPos="right"
          label="Logout" icon="pi pi-sign-out"
          @click="executeLogout()"
      />
      -->
      <Button
          class="m-2"
          iconPos="right"
          label="TestMessage" icon="pi pi-sign-out"
          @click="sendWathsappTest()"
      />
    </div>
    <div v-else-if="qrCode">
      <p class="title text-center mb-4 md:text-5xl text-4xl">{{ $t('components.whatsappweb.accountNotConnectedTitle') }}</p>
      <p class="subtitle text-center mb-1 md:text-2xl text-1xl">{{ $t('components.whatsappweb.accountNotConnectedSubtitle') }}</p>
      <br>
      <img alt=""
           style="margin: auto ; width: 50%; max-width: 90% ;"
           :src="`data:image/png;base64,${qrCode}`" />
    </div>
    <div v-else>
      <p class="title text-center mb-4 md:text-5xl text-4xl">{{ $t('components.whatsappweb.establishingConnectionTitle') }}</p>
      <p class="subtitle text-center mb-1 md:text-2xl text-1xl">{{ $t('components.whatsappweb.establishingConnectionSubtitle') }}</p>
      <br>
      <ProgressSpinner
          style="margin: auto ; width: 50%; max-width: 90% ;"
          strokeWidth="8" fill="var(--surface-ground)"
          animationDuration="2s" aria-label="Custom ProgressSpinner" />
    </div>

  </div>
</template>

<script>
import {useRouter} from "vue-router";
import {useStore} from "vuex";
import {computed} from "vue";
import {interval} from "rxjs";
import {onAuthStateChanged} from "firebase/auth";
import {auth} from "@/firebase/config";

export default {
  name: "WhatsAppWeb",
  setup() {
    const router = useRouter()
    const store = useStore()
    return {
      store,
      router,
    }
  },
  data() {
    const businessId = this.$route.query?.businessId ;
    let qrCode = null ;
    let websocket = null ;
    let user = computed(() => this.store.state.user)
    const periodicEvent = null ;
    let lastMsgTimestamp = Date.now();

    return {
      user,
      socketopen: false,
      loggedin: false,
      lastMsgTimestamp,
      periodicEvent,
      qrCode,
      businessId,
      websocket,
      showProgressBar: false
    }
  },
  methods: {
    resetState() {
      this.lastMsgTimestamp = Date.now()
      this.socketopen = false
      this.loggedin = false
      this.qrCode = null
      this.websocket = null
      this.showProgressBar = false
    },
    checkTs() {
      const diffTs = Date.now() - this.lastMsgTimestamp
      // Increased timeout from 10s to 30s to avoid premature disconnections
      if(diffTs > 30000) {
        console.debug("Connection is not responsive:", diffTs)
        this.disconnectSocket()
        this.openWebsocket()
      }
    },
    sendMessage(jsonMsg) {
      //console.debug("Sending message", jsonMsg, this.websocket?.readyState, WebSocket.OPEN)
      this.checkTs();
      if(this.websocket?.readyState === WebSocket.OPEN) {
        const msg = JSON.stringify(jsonMsg);
        this.websocket.send(msg);
      }
    },
    sendWathsappTest() {
      console.debug("Sending message");
      this.sendMessage({command: "sendtest", data: this.businessId});
    },
    sendPing() {
      //console.debug("Sending ping");
      this.sendMessage({command: "ping", data: "fromui"});
    },
    executeLogout() {
      console.debug("Sending logout");
      this.qrCode = null ;
      this.sendMessage({command: "logout"});
    },
    disconnectSocket() {
      if (this.websocket) { // && this.websocket.readyState === WebSocket.OPEN) {
        this.periodicEvent.unsubscribe();
        console.debug("Disconnecting and closing socket");
        this.websocket.close();
      }
      this.resetState();
    },
    async openWebsocket() {
      this.resetState() ;

      // Get fresh token before connecting to prevent authentication failures
      let token = this.user.accessToken
      try {
        if (this.user && typeof this.user.getIdToken === 'function') {
          token = await this.user.getIdToken(true)
          console.log('Using fresh token for WebSocket connection')
        }
      } catch (error) {
        console.error('Failed to get fresh token, using cached token:', error)
      }

      const wsUrl = `wss://${process.env.VUE_APP_MRZ_DOMAIN}/mrcall/v1/mrcall0/whatsappweb/stream?businessId=${this.businessId}&token=${token}`
      console.debug("Starting connection to WebSocket Server: ", wsUrl)
      this.websocket = new WebSocket(wsUrl)

      const self = this ;
      this.periodicEvent = interval(5000).subscribe(() => {
        if(self.websocket)
          self.sendPing();
      });

      this.websocket.onmessage = (event) => {
        this.lastMsgTimestamp = Date.now()
        if(event.data !== '') {
          const msg = JSON.parse(event.data)
          console.log("Message received, updating message", msg);
          switch(msg.command) {
            case "ack":
              if(msg.data === "logout") {
                this.disconnectSocket()
                this.openWebsocket()
              } else {
                console.log("MSG: ", msg)
                const values = msg.data.split(":")
                if(values.length === 3 && values[0] === "ping") {
                  const connected = values[1] === "true"
                  const loggedin = values[2] === "true"
                  this.loggedin = loggedin
                  this.socketopen = loggedin
                  console.debug("Connected and loggedin: ", connected, loggedin)
                } else {
                  console.debug("AckData: ", msg.data)
                }
              }
              break;
            case "ping":
              console.debug("Send Ack")
              this.sendMessage({command: "ack", data: msg.command});
              break;
            case "qrcode":
              this.qrCode = msg.data
              this.sendMessage({command: "ack", data: msg.command});
              break;
            case "socketevent":
              if(msg.data === "OPEN") {
                this.socketopen = true;
              } else if(msg.data === "CLOSE") {
                this.socketopen = close;
                this.disconnectSocket();
                this.openWebsocket();
              }
              break;
            case "loggedin":
              this.loggedin = true
              this.socketopen = true
              break;
            case "disconnected":
              this.socketopen = false;
              this.disconnectSocket();
              this.openWebsocket();
              break;
            default:
              break;
          }
        } else {
          console.debug("Empty message received");
        }
      };

      this.websocket.onabort = (reason) => {
        console.log("Abort:", reason)
      }

      this.websocket.onclose = (reason) => {
        console.log("Closed:", reason)
      }

      this.websocket.onerror = (error) => {
        console.log(error)
      }

      this.websocket.onopen = (event) => {
        console.debug("Successfully connected to the server", event)
      }
    }
  },
  beforeUnmount() {
    console.debug("Before Unmount");
    this.periodicEvent.unsubscribe();
    this.disconnectSocket();
  },
  async created() {
    const self = this
    if(! this.store.state.user) {
      onAuthStateChanged(auth, async (user) => {
        if (user && user.emailVerified && !user.isAnonymous) {
          await self.openWebsocket();
        } /*else {
                    router.replace('/login')
                }*/
      })
    } else {
      await self.openWebsocket();
    }
  },
  mounted() {
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';
@import '../assets/style/components/whatsappweb';

</style>