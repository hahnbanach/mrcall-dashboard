<template>
  <div>
    <div id="footer-large-container" v-show="!isFooterClosed">
      <button class="absolute top-0 right-0 pointer" @click="toggleFooter(true)">
        <i class="pi pi-times"></i>
      </button>
      <div class="mt-0 mx-0 w-full grid">
        <div class="md:col-10 md:col-offset-1 col-12">
          <div class="mt-0 mx-0 w-full grid align-items-center">
            <div class="mt-0 mx-0 w-full grid align-items-center lg:flex-row flex-column">
              <img class="lg:max-w-6rem max-w-3rem footer-logo lg:absolute relative" src="@/assets/images/mrcall/littleman/assistance.svg"/>
              <div class="footer-element text-center text-sm md:text-base">
                <p class="title md:mb-3 mb-0 md:text-4xl text-lg">{{pageTexts.it.doYouNeedAssistance}}</p>
                <p class="md:text-base text-sm">
                  {{pageTexts.it.callTheNumber}}
                  <a :href="'tel:' + pageTexts.it.number">{{pageTexts.it.number}}</a>
                  {{pageTexts.it.mailUsTo}} <a href="mailto:support@mrcall.ai">support@mrcall.ai</a>
                </p>
                <p class="md:text-base text-sm margin-left--3 mb-3">
                  <a style="cursor: pointer" @click="goToWebsiteRoute('/callbooking')">{{pageTexts.it.bookAnAppointment}}</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-show="isFooterClosed">
      <button class="pointer fixed bottom-0 pl-5 pb-5 bg-transparent border-none" @click="toggleFooter(false)">
        <img class="w-5rem" src="@/assets/images/mrcall/littleman/assistance.svg"/>
      </button>
    </div>

  </div>
</template>

<script>
import router from "@/router";

export default {
  data: () => {
    const isFooterClosed = true;
    const pageTexts = {
      it: {
        doYouNeedAssistance: "Hai bisogno di assistenza?",
        bookAnAppointment: "Oppure clicca qui per prenotare un incontro con i nostri esperti.",
        callTheNumber: "Chiamaci al numero",
        number: "+390221102420",
        mailUsTo: "o scrivi a"
      }
    }
    return {
      isFooterClosed,
      pageTexts
    }
  },
  methods: {
    goToWebsiteRoute: (route) => {
      window.location.href = process.env.VUE_APP_WEBSITE_BASE_URL + route
    },
    gotoRoute: (route) => {
      router.push(route)
    },
    toggleFooter(state) {
      this.isFooterClosed = state;
    }
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/colors';
@import '../assets/style/fonts';

.pointer {
  cursor: pointer;
}

#footer-large-container {
  display: flex;
  width: 100%;
  background: @mrcall_blue;
  flex-flow: row wrap;

  .title {
    font-family: Montserrat, serif ;
    font-size: 2em;
    font-weight: bold;
    color: @mrcall_light_grey_1;
  }

  .footer-element {
    align-self: center;
    flex: 1;
    padding: 0.5em ;
  }

  .footer-logo {
    padding: 1% 0 0 1%;
  }

  a {
    font-family: Montserrat, serif;
    font-size: 1em;
    font-weight: normal;
    text-decoration-line: unset;
    color: @mrcall_white;
  }

  p, i {
    font-size: 1em;
    font-weight: normal;
    color: @mrcall_white;
  }

  p.title {
    font-weight: bold;
  }

  .center {
    margin-left: auto;
    margin-right: auto;
    text-align: center;
  }
}
</style>
