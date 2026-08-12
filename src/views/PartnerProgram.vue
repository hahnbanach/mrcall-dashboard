<template>
  <div class="center-restrict main-page-content-section">
    <p class="title center">{{ t('views.partnerprogram.mainTitle') }}</p>
    <br>
    <div v-for="(sentence, index) in textBlocks" :key="index">
      <p v-if="sentence.bold" class="highlight center">{{sentence.text}}</p>
      <p v-else class="center">{{sentence.text}}</p>
    </div>
  </div>
  <footer id="pre-footer">
    <PreFooterRequireAssistance/>
  </footer>
</template>

<script>
import router from "@/router";
import {useStore} from "vuex";
import PreFooterRequireAssistance from "@/components/PreFooterRequireAssistance";
import {computed} from "vue";
import {useI18n} from "vue-i18n";

export default {
  components: {PreFooterRequireAssistance},
  data: function () {
    const store = useStore()
    const { t, tm } = useI18n()

    let partnerDiscountCode = "[Your personal partner discount code]"

    const code = this.$route.query?.code;
    if(code) {
      partnerDiscountCode = code;
    }

    const textBlocks = computed(() => [
          {
            bold: false,
            text: t('views.partnerprogram.bringAFriend')
          },
          {
            bold: true,
            text: t('views.partnerprogram.aFreeMonthForYou')
          },
          {
            bold: true,
            text: t('views.partnerprogram.aFreeMonthForYourContact')
          },
          {
            bold: false,
            text: t('views.partnerprogram.yourPersonalCode')
          },
          {
            bold: true,
            text: partnerDiscountCode
          },
          {
            bold: false,
            text: t('views.partnerprogram.yourContactMustUseTheCode')
          },
          {
            bold: false,
            text: t('views.partnerprogram.freeMonthAfterPayment')
          }
        ]
    )

    return {
      t,
      tm,
      store,
      router,
      partnerDiscountCode,
      name: "Partner program page",
      textBlocks
    }
  },
  computed: {
  },
  methods: {
    gotoElement: (id) => {
      var element = document.querySelector(id)
      var top = element.offsetTop;
      window.scrollTo(0, top);
    }
  },
  mounted() {
    window.scrollTo(0, 0);
  }
}
</script>

<style lang="less" scoped>
@import '../assets/style/default';

.main-page-content-section {
  .highlight {
    font-weight: bold;
    color: @mrcall_blue;
  }
}

.cap-element {
  padding: 0.5em;
  background: @mrcall_blue ;
  border-top-left-radius: 25px ;
  border-top-right-radius: 25px;
  width: 100%;
}

.middle-element {
  text-align: left;
  padding: 0.5em;
  background: @mrcall_bluette ;
  margin-top: 0.1em;
  overflow-wrap: break-word;
  width: 100%;
}

.before-closing-element {
  text-align: left;
  padding: 0.5em;
  background: @mrcall_light_grey_2;
  margin-top: 0.1em;
  overflow-wrap: break-word;
  width: 100%;
}

.closing-element {
  text-align: left;
  padding: 0.5em;
  background: @mrcall_salmon ;
  margin-top: 0.1em;
  overflow-wrap: break-word;
  width: 100%;
}

#pre-footer {
  margin-top: auto;
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.center-restrict {
  max-width: 800px;
  margin-bottom: auto;
  margin-left: auto;
  margin-right: auto;
  margin-top: 6em
}
</style>